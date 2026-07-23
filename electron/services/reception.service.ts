import { and, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db/index'
import {
  receptions, receptionItems, stockMovements,
  purchaseOrderItems, cartonSizeCompositions, purchaseOrders, products,
} from '../db/schema'
import type { ReceptionInsert } from '../types'

type ReceptionItemInput = { orderItemId: string; cartonsReceived: number }

// Handle de transaction Drizzle (le paramètre passé au callback de db.transaction).
// Toutes les opérations d'écriture de create()/update() passent par ce handle.
type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0]

export class ReceptionService {
  getAll() {
    return getDb().select().from(receptions)
  }

  // Liste enrichie : totalCartons + CA estimé + coût total par réception
  getEnrichedList() {
    return getDb()
      .select({
        id:            receptions.id,
        orderId:       receptions.orderId,
        warehouseId:   receptions.warehouseId,
        receptionDate: receptions.receptionDate,
        notes:         receptions.notes,
        createdAt:     receptions.createdAt,
        totalCartons:  sql<number>`COALESCE(SUM(${receptionItems.cartonsReceived}), 0)`,
        caEstimeFcfa:  sql<number>`COALESCE(SUM(${receptionItems.cartonsReceived} * COALESCE(${products.sellingPricePerCarton}, 0)), 0)`,
        coutTotalFcfa: sql<number>`COALESCE(SUM(${receptionItems.cartonsReceived} * ${purchaseOrderItems.unitCostPerCartonFcfa}), 0)`,
      })
      .from(receptions)
      .leftJoin(receptionItems, eq(receptionItems.receptionId, receptions.id))
      .leftJoin(purchaseOrderItems, eq(purchaseOrderItems.id, receptionItems.orderItemId))
      .leftJoin(products, eq(products.id, purchaseOrderItems.productId))
      .groupBy(receptions.id)
      .orderBy(sql`${receptions.receptionDate} DESC`)
      .all()
  }

  // Détail enrichi : items avec nom produit, coût et prix de vente
  getById(id: string) {
    const reception = getDb().select().from(receptions).where(eq(receptions.id, id)).get()
    if (!reception) return null

    const items = getDb()
      .select({
        id:                    receptionItems.id,
        receptionId:           receptionItems.receptionId,
        orderItemId:           receptionItems.orderItemId,
        cartonsReceived:       receptionItems.cartonsReceived,
        productId:             purchaseOrderItems.productId,
        productName:           products.name,
        productReference:      products.reference,
        unitCostPerCartonFcfa: purchaseOrderItems.unitCostPerCartonFcfa,
        pairsPerCarton:        purchaseOrderItems.pairsPerCarton,
        sellingPricePerCarton: products.sellingPricePerCarton,
      })
      .from(receptionItems)
      .innerJoin(purchaseOrderItems, eq(purchaseOrderItems.id, receptionItems.orderItemId))
      .innerJoin(products, eq(products.id, purchaseOrderItems.productId))
      .where(eq(receptionItems.receptionId, id))
      .all()

    return { ...reception, items }
  }

  create(data: ReceptionInsert & { items: ReceptionItemInput[] }) {
    const db = getDb()
    const receptionId = randomUUID()

    db.transaction((tx) => {
      tx.insert(receptions).values({
        id:            receptionId,
        orderId:       data.orderId,
        warehouseId:   data.warehouseId,
        receptionDate: data.receptionDate,
        notes:         data.notes,
      }).run()

      for (const item of data.items) {
        tx.insert(receptionItems).values({
          id:              randomUUID(),
          receptionId,
          orderItemId:     item.orderItemId,
          cartonsReceived: item.cartonsReceived,
        }).run()
      }

      this.generateStockMovements(tx, receptionId, data.warehouseId, data.receptionDate, data.items)
      this.updateOrderStatus(tx, data.orderId)
    })

    return this.getById(receptionId)
  }

  // Modification d'un arrivage (réservée au super-admin, garde vérifiée côté handler).
  // La commande d'origine (orderId) reste figée : on ne peut ajuster que la
  // destination, la date, les notes et les quantités reçues par article.
  // Tout se joue en transaction : régénération des mouvements de stock + garde
  // anti-stock-négatif (impossible de réduire une réception sous ce qui a déjà
  // été vendu / transféré ailleurs).
  update(id: string, data: {
    warehouseId:   string
    receptionDate: string
    notes:         string | null
    items:         ReceptionItemInput[]
  }) {
    const db = getDb()

    db.transaction((tx) => {
      const current = tx.select().from(receptions).where(eq(receptions.id, id)).get()
      if (!current) throw new Error("Cette réception n'existe plus.")

      this.assertStockStaysPositive(tx, id, data.warehouseId, data.receptionDate, data.items)

      // Purge des effets de l'ancienne réception, puis régénération à l'identique
      // de la logique de création.
      tx.delete(stockMovements)
        .where(and(eq(stockMovements.referenceId, id), eq(stockMovements.referenceType, 'reception')))
        .run()
      tx.delete(receptionItems).where(eq(receptionItems.receptionId, id)).run()

      for (const item of data.items) {
        tx.insert(receptionItems).values({
          id:              randomUUID(),
          receptionId:     id,
          orderItemId:     item.orderItemId,
          cartonsReceived: item.cartonsReceived,
        }).run()
      }

      tx.update(receptions)
        .set({
          warehouseId:   data.warehouseId,
          receptionDate: data.receptionDate,
          notes:         data.notes,
          updatedAt:     sql`CURRENT_TIMESTAMP`, // bump manuel : SQLite ne le fait pas à l'UPDATE
        })
        .where(eq(receptions.id, id))
        .run()

      this.generateStockMovements(tx, id, data.warehouseId, data.receptionDate, data.items)
      this.updateOrderStatus(tx, current.orderId)
    })

    return this.getById(id)
  }

  // Insère un mouvement `reception` (positif) par pointure de chaque article reçu.
  // Partagé entre create() et update() pour garantir une régénération identique.
  private generateStockMovements(
    tx: Tx, receptionId: string, warehouseId: string, receptionDate: string, items: ReceptionItemInput[],
  ): void {
    for (const item of items) {
      const orderItem = tx
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.id, item.orderItemId))
        .get()
      if (!orderItem) continue

      const sizes = tx
        .select()
        .from(cartonSizeCompositions)
        .where(eq(cartonSizeCompositions.orderItemId, item.orderItemId))
        .all()

      const unitCostFcfa = Math.round(orderItem.unitCostPerCartonFcfa / orderItem.pairsPerCarton)

      for (const size of sizes) {
        tx.insert(stockMovements).values({
          id:            randomUUID(),
          productId:     orderItem.productId,
          warehouseId,
          size:          size.size,
          quantity:      size.pairsCount * item.cartonsReceived,
          movementType:  'reception',
          referenceId:   receptionId,
          referenceType: 'reception',
          unitCostFcfa,
          movementDate:  receptionDate,
        }).run()
      }
    }
  }

  // Refuse une modification qui rendrait le stock négatif quelque part : on
  // compare, par (produit, entrepôt, pointure), le stock actuel diminué de la
  // contribution actuelle de CETTE réception et augmenté de la nouvelle.
  private assertStockStaysPositive(
    tx: Tx, receptionId: string, warehouseId: string, _receptionDate: string, items: ReceptionItemInput[],
  ): void {
    const key = (productId: string, wId: string, size: string) => `${productId}|${wId}|${size}`

    // Contribution actuelle de cette réception (mouvements existants).
    const oldMovements = tx
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.referenceId, receptionId), eq(stockMovements.referenceType, 'reception')))
      .all()
    const oldByKey = new Map<string, number>()
    for (const m of oldMovements) {
      oldByKey.set(key(m.productId, m.warehouseId, m.size), (oldByKey.get(key(m.productId, m.warehouseId, m.size)) ?? 0) + m.quantity)
    }

    // Contribution visée par la nouvelle version.
    const newByKey = new Map<string, number>()
    for (const item of items) {
      const orderItem = tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, item.orderItemId)).get()
      if (!orderItem) continue
      const sizes = tx.select().from(cartonSizeCompositions).where(eq(cartonSizeCompositions.orderItemId, item.orderItemId)).all()
      for (const size of sizes) {
        const k = key(orderItem.productId, warehouseId, size.size)
        newByKey.set(k, (newByKey.get(k) ?? 0) + size.pairsCount * item.cartonsReceived)
      }
    }

    // Vérifie chaque clé touchée (ancienne ou nouvelle).
    const touched = new Set<string>([...oldByKey.keys(), ...newByKey.keys()])
    for (const k of touched) {
      const [productId, wId, size] = k.split('|')
      const totalRow = tx
        .select({ total: sql<number>`COALESCE(SUM(${stockMovements.quantity}), 0)` })
        .from(stockMovements)
        .where(and(
          eq(stockMovements.productId, productId),
          eq(stockMovements.warehouseId, wId),
          eq(stockMovements.size, size),
        ))
        .get()

      const currentTotal = totalRow?.total ?? 0
      const projected = currentTotal - (oldByKey.get(k) ?? 0) + (newByKey.get(k) ?? 0)
      if (projected < 0) {
        throw new Error(
          `Modification impossible : la pointure ${size} de ce produit passerait à ${projected} paire(s) en stock. ` +
          `Une partie de la marchandise reçue a déjà été vendue ou transférée.`,
        )
      }
    }
  }

  private updateOrderStatus(tx: Tx, orderId: string): void {
    const db = tx
    const allItems = db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.orderId, orderId))
      .all()

    const receivedItems = db
      .select()
      .from(receptionItems)
      .innerJoin(receptions, eq(receptionItems.receptionId, receptions.id))
      .where(eq(receptions.orderId, orderId))
      .all()

    const totalOrdered  = allItems.reduce((s, i) => s + i.cartonsOrdered, 0)
    const totalReceived = receivedItems.reduce((s, i) => s + i.reception_items.cartonsReceived, 0)

    const status = totalReceived === 0
      ? 'confirmed'
      : totalReceived >= totalOrdered
        ? 'complete'
        : 'partial'

    db.update(purchaseOrders).set({ status }).where(eq(purchaseOrders.id, orderId)).run()
  }
}

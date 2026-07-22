import { eq, isNull, inArray, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db/index'
import { purchaseOrders, purchaseOrderItems, cartonSizeCompositions, orderPayments, suppliers, products, receptionItems } from '../db/schema'
import type { PurchaseOrderInsert, OrderPaymentInsert } from '../types'

/** Ligne de commande telle que soumise par le formulaire (création ou édition). */
export interface OrderItemPayload {
  /** Absent = nouvelle ligne. Présent = ligne existante à mettre à jour. */
  id?:                    string
  productId:              string
  cartonsOrdered:         number
  pairsPerCarton:         number
  unitCostPerCartonFcfa:  number
  notes?:                 string | null
  sizes:                  Array<{ size: string; pairsCount: number }>
}

export class PurchaseOrderService {
  getAll() {
    return getDb().select().from(purchaseOrders).where(isNull(purchaseOrders.deletedAt))
  }

  getAllEnriched() {
    const db = getDb()

    const orders = db
      .select({
        id:                   purchaseOrders.id,
        reference:            purchaseOrders.reference,
        supplierId:           purchaseOrders.supplierId,
        supplierName:         suppliers.name,
        supplierPhone:        suppliers.phone,
        supplierWhatsapp:     suppliers.whatsapp,
        supplierEmail:        suppliers.email,
        supplierCountry:      suppliers.country,
        supplierCity:         suppliers.city,
        supplierAddress:      suppliers.address,
        orderDate:            purchaseOrders.orderDate,
        expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
        status:               purchaseOrders.status,
        totalCostFcfa:        purchaseOrders.totalCostFcfa,
        notes:                purchaseOrders.notes,
        createdAt:            purchaseOrders.createdAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(isNull(purchaseOrders.deletedAt))
      .all()

    if (orders.length === 0) return []

    const orderIds = orders.map((o) => o.id)

    const items = db
      .select({
        id:                   purchaseOrderItems.id,
        orderId:              purchaseOrderItems.orderId,
        productId:            purchaseOrderItems.productId,
        productName:          products.name,
        productReference:     products.reference,
        productImageData:     products.imageData,
        cartonsOrdered:       purchaseOrderItems.cartonsOrdered,
        pairsPerCarton:       purchaseOrderItems.pairsPerCarton,
        unitCostPerCartonFcfa: purchaseOrderItems.unitCostPerCartonFcfa,
      })
      .from(purchaseOrderItems)
      .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
      .where(inArray(purchaseOrderItems.orderId, orderIds))
      .all()

    const payments = db
      .select()
      .from(orderPayments)
      .where(inArray(orderPayments.orderId, orderIds))
      .all()

    return orders.map((order) => ({
      ...order,
      items:    items.filter((i) => i.orderId === order.id),
      payments: payments.filter((p) => p.orderId === order.id),
    }))
  }

  getById(id: string) {
    const order = getDb().select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).get()
    if (!order) return null

    const items    = getDb().select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id)).all()
    const payments = getDb().select().from(orderPayments).where(eq(orderPayments.orderId, id)).all()

    return { ...order, items, payments }
  }

  create(data: PurchaseOrderInsert & { items: Array<{ productId: string; cartonsOrdered: number; pairsPerCarton: number; unitCostPerCartonFcfa: number; sizes: Array<{ size: string; pairsCount: number }> }> }) {
    const db = getDb()
    const orderId = randomUUID()
    const reference = `CMD-${Date.now()}`

    const totalCost =
      (data.productCostFcfa  ?? 0) +
      (data.freightCostFcfa  ?? 0) +
      (data.customsCostFcfa  ?? 0) +
      (data.otherCostsFcfa   ?? 0)

    db.insert(purchaseOrders).values({
      ...data,
      id:            orderId,
      reference,
      totalCostFcfa: totalCost,
    }).run()

    for (const item of data.items) {
      const itemId = randomUUID()
      db.insert(purchaseOrderItems).values({ ...item, id: itemId, orderId }).run()

      for (const size of item.sizes) {
        db.insert(cartonSizeCompositions).values({
          id:          randomUUID(),
          orderItemId: itemId,
          size:        size.size,
          pairsCount:  size.pairsCount,
        }).run()
      }
    }

    return this.getById(orderId)
  }

  /**
   * Nombre de cartons déjà réceptionnés par ligne de commande.
   * Une ligne réceptionnée est « verrouillée » : les réceptions et les
   * mouvements de stock qu'elles ont générés pointent dessus (reception_items
   * .order_item_id), donc la supprimer ou changer sa quantité casserait la
   * traçabilité du stock.
   */
  private receivedCartonsByItem(itemIds: string[]): Map<string, number> {
    if (itemIds.length === 0) return new Map()

    const rows = getDb()
      .select({
        orderItemId: receptionItems.orderItemId,
        cartons:     sql<number>`SUM(${receptionItems.cartonsReceived})`,
      })
      .from(receptionItems)
      .where(inArray(receptionItems.orderItemId, itemIds))
      .groupBy(receptionItems.orderItemId)
      .all()

    return new Map(rows.map((r) => [r.orderItemId, r.cartons ?? 0]))
  }

  /**
   * Commande complète pour le formulaire d'édition : entête, lignes avec leurs
   * pointures, et pour chaque ligne le nombre de cartons déjà reçus (0 = ligne
   * librement modifiable).
   */
  getForEdit(id: string) {
    const db = getDb()

    const order = db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).get()
    if (!order) return null

    const items = db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.orderId, id))
      .all()

    const itemIds = items.map((i) => i.id)
    const sizes = itemIds.length
      ? db.select().from(cartonSizeCompositions).where(inArray(cartonSizeCompositions.orderItemId, itemIds)).all()
      : []
    const received = this.receivedCartonsByItem(itemIds)

    return {
      ...order,
      items: items.map((item) => ({
        ...item,
        sizes:           sizes.filter((s) => s.orderItemId === item.id),
        receivedCartons: received.get(item.id) ?? 0,
      })),
    }
  }

  /**
   * Met à jour une commande. Si `items` est fourni, les lignes sont
   * réconciliées (mise à jour / ajout / suppression) ; sinon seul l'entête
   * change.
   *
   * Les lignes déjà réceptionnées sont protégées : suppression refusée, et
   * quantité commandée jamais réduite en dessous du déjà reçu.
   */
  update(id: string, data: Partial<PurchaseOrderInsert> & { items?: OrderItemPayload[] }) {
    const db = getDb()
    const { items, ...header } = data

    db.transaction((tx) => {
      const current = tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).get()
      if (!current) throw new Error("Cette commande n'existe plus.")

      // Le total doit rester cohérent avec les postes de coût : on le recalcule
      // à partir des valeurs finales plutôt que de faire confiance à l'appelant.
      const merged = { ...current, ...header }
      const totalCostFcfa =
        (merged.productCostFcfa ?? 0) +
        (merged.freightCostFcfa ?? 0) +
        (merged.customsCostFcfa ?? 0) +
        (merged.otherCostsFcfa  ?? 0)

      tx.update(purchaseOrders)
        .set({ ...header, totalCostFcfa })
        .where(eq(purchaseOrders.id, id))
        .run()

      if (!items) return

      const existing = tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id)).all()
      const received = this.receivedCartonsByItem(existing.map((i) => i.id))
      const keptIds  = new Set(items.map((i) => i.id).filter(Boolean) as string[])

      // ── Suppressions ────────────────────────────────────────────────────
      for (const row of existing) {
        if (keptIds.has(row.id)) continue

        const alreadyReceived = received.get(row.id) ?? 0
        if (alreadyReceived > 0) {
          throw new Error(
            `Impossible de supprimer une ligne déjà réceptionnée (${alreadyReceived} carton(s) reçu(s)). ` +
            `Annulez d'abord la réception correspondante.`,
          )
        }
        tx.delete(cartonSizeCompositions).where(eq(cartonSizeCompositions.orderItemId, row.id)).run()
        tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, row.id)).run()
      }

      // ── Mises à jour et ajouts ──────────────────────────────────────────
      for (const item of items) {
        const isNew  = !item.id || !existing.some((e) => e.id === item.id)
        const itemId = isNew ? randomUUID() : item.id!

        if (isNew) {
          tx.insert(purchaseOrderItems).values({
            id:                    itemId,
            orderId:               id,
            productId:             item.productId,
            cartonsOrdered:        item.cartonsOrdered,
            pairsPerCarton:        item.pairsPerCarton,
            unitCostPerCartonFcfa: item.unitCostPerCartonFcfa,
            notes:                 item.notes ?? null,
          }).run()
        } else {
          const alreadyReceived = received.get(itemId) ?? 0
          if (alreadyReceived > 0 && item.cartonsOrdered < alreadyReceived) {
            throw new Error(
              `Cette ligne a déjà reçu ${alreadyReceived} carton(s) : la quantité commandée ` +
              `ne peut pas être inférieure (${item.cartonsOrdered} demandé).`,
            )
          }
          tx.update(purchaseOrderItems).set({
            productId:             item.productId,
            cartonsOrdered:        item.cartonsOrdered,
            pairsPerCarton:        item.pairsPerCarton,
            unitCostPerCartonFcfa: item.unitCostPerCartonFcfa,
            notes:                 item.notes ?? null,
          }).where(eq(purchaseOrderItems.id, itemId)).run()
        }

        // Les pointures n'ont pas d'identité propre : on les remplace en bloc.
        tx.delete(cartonSizeCompositions).where(eq(cartonSizeCompositions.orderItemId, itemId)).run()
        for (const size of item.sizes) {
          tx.insert(cartonSizeCompositions).values({
            id:          randomUUID(),
            orderItemId: itemId,
            size:        size.size,
            pairsCount:  size.pairsCount,
          }).run()
        }
      }
    })

    return this.getById(id)
  }

  delete(id: string) {
    const now = new Date().toISOString()
    getDb().update(purchaseOrders).set({ deletedAt: now }).where(eq(purchaseOrders.id, id)).run()
  }

  addPayment(orderId: string, data: OrderPaymentInsert) {
    getDb().insert(orderPayments).values({ ...data, id: randomUUID(), orderId }).run()
    return this.getById(orderId)
  }

  deletePayment(paymentId: string) {
    getDb().delete(orderPayments).where(eq(orderPayments.id, paymentId)).run()
  }

  simulateProfit(data: { totalCostFcfa: number; totalCartons: number; salePricePerCartonFcfa: number }) {
    const totalRevenue    = data.salePricePerCartonFcfa * data.totalCartons
    const grossProfit     = totalRevenue - data.totalCostFcfa
    const marginPct       = data.totalCostFcfa > 0 ? (grossProfit / data.totalCostFcfa) * 100 : 0
    const costPerCarton   = data.totalCartons > 0 ? Math.round(data.totalCostFcfa / data.totalCartons) : 0

    return { totalRevenue, grossProfit, marginPct, costPerCarton }
  }
}

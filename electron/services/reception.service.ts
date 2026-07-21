import { eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db/index'
import {
  receptions, receptionItems, stockMovements,
  purchaseOrderItems, cartonSizeCompositions, purchaseOrders, products,
} from '../db/schema'
import type { ReceptionInsert } from '../types'

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

  create(data: ReceptionInsert & {
    items: Array<{ orderItemId: string; cartonsReceived: number }>
  }) {
    const db = getDb()
    const receptionId = randomUUID()

    db.insert(receptions).values({
      id:            receptionId,
      orderId:       data.orderId,
      warehouseId:   data.warehouseId,
      receptionDate: data.receptionDate,
      notes:         data.notes,
    }).run()

    for (const item of data.items) {
      db.insert(receptionItems).values({
        id:              randomUUID(),
        receptionId,
        orderItemId:     item.orderItemId,
        cartonsReceived: item.cartonsReceived,
      }).run()

      const sizes = db
        .select()
        .from(cartonSizeCompositions)
        .where(eq(cartonSizeCompositions.orderItemId, item.orderItemId))
        .all()

      const orderItem = db
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.id, item.orderItemId))
        .get()

      if (!orderItem) continue

      const unitCostFcfa = Math.round(orderItem.unitCostPerCartonFcfa / orderItem.pairsPerCarton)

      for (const size of sizes) {
        db.insert(stockMovements).values({
          id:            randomUUID(),
          productId:     orderItem.productId,
          warehouseId:   data.warehouseId,
          size:          size.size,
          quantity:      size.pairsCount * item.cartonsReceived,
          movementType:  'reception',
          referenceId:   receptionId,
          referenceType: 'reception',
          unitCostFcfa,
          movementDate:  data.receptionDate,
        }).run()
      }
    }

    this.updateOrderStatus(data.orderId)
    return this.getById(receptionId)
  }

  private updateOrderStatus(orderId: string): void {
    const db = getDb()
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

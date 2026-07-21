import { eq, isNull, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db/index'
import { purchaseOrders, purchaseOrderItems, cartonSizeCompositions, orderPayments, suppliers, products } from '../db/schema'
import type { PurchaseOrderInsert, OrderPaymentInsert } from '../types'

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

  update(id: string, data: Partial<PurchaseOrderInsert>) {
    getDb().update(purchaseOrders).set(data).where(eq(purchaseOrders.id, id)).run()
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

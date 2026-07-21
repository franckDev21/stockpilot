import { eq, isNull } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db/index'
import { sales, saleItems, salePayments, stockMovements } from '../db/schema'
import type { SaleInsert, SalePaymentInsert } from '../types'


export class SaleService {
  getAll() {
    return getDb().select().from(sales).where(isNull(sales.deletedAt))
  }

  getById(id: string) {
    const sale = getDb().select().from(sales).where(eq(sales.id, id)).get()
    if (!sale) return null
    const items    = getDb().select().from(saleItems).where(eq(saleItems.saleId, id)).all()
    const payments = getDb().select().from(salePayments).where(eq(salePayments.saleId, id)).all()
    return { ...sale, items, payments }
  }

  create(data: SaleInsert & {
    items: Array<{ productId: string; size: string; quantity: number; unitPriceFcfa: number }>
    paidAmountFcfa?: number
  }) {
    const db = getDb()
    const saleId    = randomUUID()
    const reference = `VTE-${Date.now()}`

    const totalAmountFcfa = data.items.reduce(
      (sum, i) => sum + i.quantity * i.unitPriceFcfa,
      0,
    )
    const paidAmountFcfa = data.paidAmountFcfa ?? 0
    const status = paidAmountFcfa === 0
      ? 'pending'
      : paidAmountFcfa >= totalAmountFcfa
        ? 'paid'
        : 'partial'

    db.insert(sales).values({
      id: saleId,
      reference,
      customerId:       data.customerId,
      warehouseId:      data.warehouseId,
      saleDate:         data.saleDate,
      saleType:         data.saleType,
      totalAmountFcfa,
      paidAmountFcfa,
      status,
      notes:            data.notes,
    }).run()

    for (const item of data.items) {
      db.insert(saleItems).values({
        id:            randomUUID(),
        saleId,
        productId:     item.productId,
        size:          item.size,
        quantity:      item.quantity,
        unitPriceFcfa: item.unitPriceFcfa,
      }).run()

      // Sortie de stock
      db.insert(stockMovements).values({
        id:            randomUUID(),
        productId:     item.productId,
        warehouseId:   data.warehouseId,
        size:          item.size,
        quantity:      -item.quantity,
        movementType:  'sale',
        referenceId:   saleId,
        referenceType: 'sale',
        movementDate:  data.saleDate,
      }).run()
    }

    return this.getById(saleId)
  }

  delete(id: string) {
    const db  = getDb()
    const now = new Date().toISOString()
    const sale = db.select().from(sales).where(eq(sales.id, id)).get()
    if (!sale) return

    // Reverse stock movements — re-add all pairs that were deducted
    const items = db.select().from(saleItems).where(eq(saleItems.saleId, id)).all()
    const today = now.slice(0, 10)
    for (const item of items) {
      db.insert(stockMovements).values({
        id:            randomUUID(),
        productId:     item.productId,
        warehouseId:   sale.warehouseId,
        size:          item.size,
        quantity:      item.quantity, // +qty cancels the original -qty
        movementType:  'adjustment',
        referenceId:   id,
        referenceType: 'sale',
        movementDate:  today,
        notes:         `Annulation vente`,
      }).run()
    }

    db.update(sales).set({ deletedAt: now }).where(eq(sales.id, id)).run()
  }

  addPayment(saleId: string, data: SalePaymentInsert) {
    const db   = getDb()
    const sale = db.select().from(sales).where(eq(sales.id, saleId)).get()
    if (!sale) return null

    db.insert(salePayments).values({ ...data, id: randomUUID(), saleId }).run()

    const newPaid  = sale.paidAmountFcfa + data.amountFcfa
    const status   = newPaid >= sale.totalAmountFcfa ? 'paid' : 'partial'
    db.update(sales).set({ paidAmountFcfa: newPaid, status }).where(eq(sales.id, saleId)).run()

    return this.getById(saleId)
  }
}

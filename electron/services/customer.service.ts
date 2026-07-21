import { eq, isNull, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db/index'
import { customers, sales } from '../db/schema'
import type { CustomerInsert } from '../types'

export class CustomerService {
  getAll() {
    return getDb().select().from(customers).where(isNull(customers.deletedAt))
  }

  getById(id: string) {
    return getDb().select().from(customers).where(eq(customers.id, id)).get()
  }

  create(data: CustomerInsert) {
    const id = randomUUID()
    getDb().insert(customers).values({ ...data, id }).run()
    return this.getById(id)
  }

  update(id: string, data: Partial<CustomerInsert>) {
    getDb().update(customers).set(data).where(eq(customers.id, id)).run()
    return this.getById(id)
  }

  delete(id: string) {
    const now = new Date().toISOString()
    getDb().update(customers).set({ deletedAt: now }).where(eq(customers.id, id)).run()
  }

  getBalance(customerId: string) {
    // Montant dû = total des ventes non intégralement payées
    const result = getDb()
      .select({
        totalDue: sql<number>`SUM(${sales.totalAmountFcfa} - ${sales.paidAmountFcfa})`,
      })
      .from(sales)
      .where(eq(sales.customerId, customerId))
      .get()
    return { balanceDueFcfa: result?.totalDue ?? 0 }
  }
}

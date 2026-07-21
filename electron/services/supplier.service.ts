import { eq, isNull } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db/index'
import { suppliers } from '../db/schema'
import type { SupplierInsert } from '../types'

export class SupplierService {
  getAll() {
    return getDb().select().from(suppliers).where(isNull(suppliers.deletedAt))
  }

  getById(id: string) {
    return getDb().select().from(suppliers).where(eq(suppliers.id, id)).get()
  }

  create(data: SupplierInsert) {
    const id = randomUUID()
    getDb().insert(suppliers).values({ ...data, id }).run()
    return this.getById(id)
  }

  update(id: string, data: Partial<SupplierInsert>) {
    getDb().update(suppliers).set(data).where(eq(suppliers.id, id)).run()
    return this.getById(id)
  }

  delete(id: string) {
    const now = new Date().toISOString()
    getDb().update(suppliers).set({ deletedAt: now }).where(eq(suppliers.id, id)).run()
  }
}

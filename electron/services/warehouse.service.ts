import { eq, isNull } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db/index'
import { warehouses } from '../db/schema'
import type { WarehouseInsert } from '../types'

export class WarehouseService {
  getAll() {
    return getDb().select().from(warehouses).where(isNull(warehouses.deletedAt))
  }

  create(data: WarehouseInsert) {
    const id = randomUUID()
    getDb().insert(warehouses).values({ ...data, id }).run()
    return this.getAll()
  }

  update(id: string, data: Partial<WarehouseInsert>) {
    getDb().update(warehouses).set(data).where(eq(warehouses.id, id)).run()
    return this.getAll()
  }

  delete(id: string) {
    const now = new Date().toISOString()
    getDb().update(warehouses).set({ deletedAt: now }).where(eq(warehouses.id, id)).run()
    return this.getAll()
  }
}

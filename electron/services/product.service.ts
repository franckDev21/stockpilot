import { and, eq, isNull, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db/index'
import { products, stockMovements, purchaseOrderItems, receptionItems } from '../db/schema'
import type { ProductInsert } from '../types'

export class ProductService {
  getAll() {
    return getDb().select().from(products).where(isNull(products.deletedAt))
  }

  getById(id: string) {
    return getDb().select().from(products).where(eq(products.id, id)).get()
  }

  /**
   * A reference must stay unique among *active* products. Checked here rather
   * than left to the DB so the user gets a French message naming the product
   * that already holds it, instead of a raw SQLite constraint error.
   * The partial unique index remains the last line of defence.
   */
  private assertReferenceAvailable(reference: string, excludeId?: string) {
    const clash = getDb()
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.reference, reference), isNull(products.deletedAt)))
      .get()

    if (clash && clash.id !== excludeId) {
      throw new Error(
        `La référence « ${reference} » est déjà utilisée par le produit « ${clash.name} ».`,
      )
    }
  }

  create(data: ProductInsert) {
    this.assertReferenceAvailable(data.reference)
    const id = randomUUID()
    getDb().insert(products).values({ ...data, id }).run()
    return this.getById(id)
  }

  update(id: string, data: Partial<ProductInsert>) {
    if (data.reference !== undefined) {
      this.assertReferenceAvailable(data.reference, id)
    }
    getDb().update(products).set(data).where(eq(products.id, id)).run()
    return this.getById(id)
  }

  delete(id: string) {
    const now = new Date().toISOString()
    getDb().update(products).set({ deletedAt: now }).where(eq(products.id, id)).run()
  }

  getCartonStats(productId: string) {
    const db = getDb()
    const result = db
      .select({
        totalCartons:        sql<number>`SUM(${receptionItems.cartonsReceived})`,
        totalPairsFromCartons: sql<number>`SUM(${receptionItems.cartonsReceived} * ${purchaseOrderItems.pairsPerCarton})`,
        pairsPerCarton:      purchaseOrderItems.pairsPerCarton,
      })
      .from(receptionItems)
      .innerJoin(purchaseOrderItems, eq(receptionItems.orderItemId, purchaseOrderItems.id))
      .where(eq(purchaseOrderItems.productId, productId))
      .groupBy(purchaseOrderItems.pairsPerCarton)
      .all()

    const totalCartons = result.reduce((s, r) => s + (r.totalCartons ?? 0), 0)
    const totalPairs   = result.reduce((s, r) => s + (r.totalPairsFromCartons ?? 0), 0)
    return { totalCartons, totalPairsFromCartons: totalPairs }
  }

  getStock(warehouseId?: string) {
    const db = getDb()
    const query = db
      .select({
        productId:   stockMovements.productId,
        warehouseId: stockMovements.warehouseId,
        size:        stockMovements.size,
        totalPairs:  sql<number>`SUM(${stockMovements.quantity})`,
      })
      .from(stockMovements)
      .groupBy(stockMovements.productId, stockMovements.warehouseId, stockMovements.size)

    // Filtrage optionnel par entrepôt
    if (warehouseId) {
      return query.where(eq(stockMovements.warehouseId, warehouseId)).all()
    }
    return query.all()
  }
}

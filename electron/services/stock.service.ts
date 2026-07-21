import { eq, and, sql, gt } from 'drizzle-orm'
import { getDb } from '../db/index'
import { stockMovements, products } from '../db/schema'

export class StockService {
  getCurrent(warehouseId?: string) {
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

    if (warehouseId) {
      return query.where(eq(stockMovements.warehouseId, warehouseId)).all()
    }
    return query.all()
  }

  getMovements(productId: string, warehouseId?: string) {
    return getDb()
      .select()
      .from(stockMovements)
      .where(
        warehouseId
          ? and(eq(stockMovements.productId, productId), eq(stockMovements.warehouseId, warehouseId))
          : eq(stockMovements.productId, productId),
      )
      .all()
  }

  getLowStock() {
    // Produits dont le stock en cartons est inférieur au seuil d'alerte (en cartons)
    return getDb()
      .select({
        productId:      stockMovements.productId,
        totalPairs:     sql<number>`SUM(${stockMovements.quantity})`,
        pairsPerCarton: products.pairsPerCarton,
        threshold:      products.alertThreshold,
        productName:    products.name,
        reference:      products.reference,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .where(gt(products.alertThreshold, 0))
      .groupBy(stockMovements.productId)
      .having(sql`CAST(SUM(${stockMovements.quantity}) / NULLIF(${products.pairsPerCarton}, 0) AS INTEGER) < ${products.alertThreshold}`)
      .all()
  }
}

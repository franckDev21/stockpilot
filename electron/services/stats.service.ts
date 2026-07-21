import { sql, gte, lte, and, eq, isNull } from 'drizzle-orm'
import { getDb } from '../db/index'
import { sales, saleItems, stockMovements, products, customers, purchaseOrders, suppliers, orderPayments } from '../db/schema'




export class StatsService {
  getDashboard() {
    const db  = getDb()
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString().slice(0, 10)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      .toISOString().slice(0, 10)

    const caToday = db
      .select({ total: sql<number>`COALESCE(SUM(${sales.totalAmountFcfa}), 0)` })
      .from(sales)
      .where(and(isNull(sales.deletedAt), gte(sales.saleDate, todayStr)))
      .get()

    const caThisMonth = db
      .select({ total: sql<number>`COALESCE(SUM(${sales.totalAmountFcfa}), 0)` })
      .from(sales)
      .where(and(isNull(sales.deletedAt), gte(sales.saleDate, monthStart)))
      .get()

    const caLastMonth = db
      .select({ total: sql<number>`COALESCE(SUM(${sales.totalAmountFcfa}), 0)` })
      .from(sales)
      .where(and(isNull(sales.deletedAt), gte(sales.saleDate, lastMonthStart), lte(sales.saleDate, lastMonthEnd)))
      .get()

    const totalReceivables = db
      .select({ total: sql<number>`COALESCE(SUM(${sales.totalAmountFcfa} - ${sales.paidAmountFcfa}), 0)` })
      .from(sales)
      .where(and(isNull(sales.deletedAt), sql`${sales.paidAmountFcfa} < ${sales.totalAmountFcfa}`))
      .get()

    const pendingOrders = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(purchaseOrders)
      .where(sql`${purchaseOrders.status} IN ('confirmed', 'partial')`)
      .get()

    // Total stock en cartons : pour chaque produit, totalPaires / pairesParCarton
    const stockByProduct = db
      .select({
        productId:      stockMovements.productId,
        totalPairs:     sql<number>`COALESCE(SUM(${stockMovements.quantity}), 0)`,
        pairsPerCarton: products.pairsPerCarton,
        alertThreshold: products.alertThreshold,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .where(isNull(products.deletedAt))
      .groupBy(stockMovements.productId)
      .all()

    const totalStockCartons = stockByProduct.reduce((sum, row) => {
      const ppc = row.pairsPerCarton > 0 ? row.pairsPerCarton : 12
      return sum + Math.floor(row.totalPairs / ppc)
    }, 0)

    const lowStockCount = stockByProduct.filter((row) => {
      if (!row.alertThreshold || row.alertThreshold <= 0) return false
      const ppc = row.pairsPerCarton > 0 ? row.pairsPerCarton : 12
      return Math.floor(row.totalPairs / ppc) < row.alertThreshold
    }).length

    return {
      caToday:            caToday?.total         ?? 0,
      caThisMonth:        caThisMonth?.total      ?? 0,
      caLastMonth:        caLastMonth?.total      ?? 0,
      totalReceivables:   totalReceivables?.total ?? 0,
      pendingOrdersCount: pendingOrders?.count    ?? 0,
      totalStockPairs:    totalStockCartons,
      lowStockCount,
    }
  }

  getSalesPeriod(data: { from: string; to: string }) {
    return getDb()
      .select({
        date:     sales.saleDate,
        total:    sql<number>`SUM(${sales.totalAmountFcfa})`,
        count:    sql<number>`COUNT(*)`,
      })
      .from(sales)
      .where(and(gte(sales.saleDate, data.from), gte(sales.saleDate, data.to)))
      .groupBy(sales.saleDate)
      .all()
  }

  getTopProducts(data: { limit?: number }) {
    return getDb()
      .select({
        productId:   saleItems.productId,
        productName: products.name,
        reference:   products.reference,
        totalPairs:  sql<number>`SUM(${saleItems.quantity})`,
        totalRevenue: sql<number>`SUM(${saleItems.quantity} * ${saleItems.unitPriceFcfa})`,
      })
      .from(saleItems)
      .innerJoin(products, eq(saleItems.productId, products.id))
      .groupBy(saleItems.productId)
      .orderBy(sql`SUM(${saleItems.quantity}) DESC`)
      .limit(data.limit ?? 10)
      .all()
  }

  getStockForecast() {
    const db    = getDb()
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    // Vitesse de vente sur 30 jours (paires/jour par produit)
    const velocity = db
      .select({
        productId:       stockMovements.productId,
        dailySalesRate:  sql<number>`ABS(SUM(${stockMovements.quantity})) / 30.0`,
      })
      .from(stockMovements)
      .where(and(
        sql`${stockMovements.movementType} = 'sale'`,
        gte(stockMovements.movementDate, since),
      ))
      .groupBy(stockMovements.productId)
      .all()

    // Stock actuel par produit
    const currentStock = db
      .select({
        productId:  stockMovements.productId,
        totalPairs: sql<number>`SUM(${stockMovements.quantity})`,
      })
      .from(stockMovements)
      .groupBy(stockMovements.productId)
      .all()

    return currentStock.map((s) => {
      const v        = velocity.find((v) => v.productId === s.productId)
      const rate     = v?.dailySalesRate ?? 0
      const daysLeft = rate > 0 ? Math.round(s.totalPairs / rate) : null
      return { ...s, dailySalesRate: rate, daysUntilStockout: daysLeft }
    })
  }

  getSalesTimeline(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return getDb()
      .select({
        date:  sales.saleDate,
        total: sql<number>`COALESCE(SUM(${sales.totalAmountFcfa}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(sales)
      .where(gte(sales.saleDate, since))
      .groupBy(sales.saleDate)
      .orderBy(sales.saleDate)
      .all()
  }

  getReceivables() {
    return getDb()
      .select({
        customerId:    sales.customerId,
        customerName:  customers.name,
        customerPhone: customers.phone,
        totalDue:      sql<number>`SUM(${sales.totalAmountFcfa} - ${sales.paidAmountFcfa})`,
        salesCount:    sql<number>`COUNT(*)`,
      })
      .from(sales)
      .innerJoin(customers, eq(sales.customerId, customers.id))
      .where(sql`${sales.paidAmountFcfa} < ${sales.totalAmountFcfa}`)
      .groupBy(sales.customerId)
      .orderBy(sql`SUM(${sales.totalAmountFcfa} - ${sales.paidAmountFcfa}) DESC`)
      .all()
  }

  getSupplierPayables() {
    return getDb()
      .select({
        orderId:       purchaseOrders.id,
        reference:     purchaseOrders.reference,
        supplierId:    purchaseOrders.supplierId,
        supplierName:  suppliers.name,
        totalCostFcfa: purchaseOrders.totalCostFcfa,
        paidAmountFcfa: sql<number>`COALESCE(SUM(${orderPayments.amountFcfa}), 0)`,
        orderDate:     purchaseOrders.orderDate,
        status:        purchaseOrders.status,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(orderPayments, eq(purchaseOrders.id, orderPayments.orderId))
      .where(and(isNull(purchaseOrders.deletedAt), sql`${purchaseOrders.status} != 'cancelled'`))
      .groupBy(purchaseOrders.id)
      .having(sql`${purchaseOrders.totalCostFcfa} > COALESCE(SUM(${orderPayments.amountFcfa}), 0)`)
      .orderBy(sql`COALESCE(SUM(${orderPayments.amountFcfa}), 0) ASC`)
      .all()
  }
}

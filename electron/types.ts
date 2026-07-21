import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import type {
  warehouses, products, suppliers, customers,
  purchaseOrders, purchaseOrderItems, cartonSizeCompositions,
  orderPayments, receptions, receptionItems,
  transfers, transferItems, stockMovements,
  sales, saleItems, salePayments,
} from './db/schema'

// ─── Select types (lecture depuis la DB) ─────────────────────────────────────
export type Warehouse         = InferSelectModel<typeof warehouses>
export type Product           = InferSelectModel<typeof products>
export type Supplier          = InferSelectModel<typeof suppliers>
export type Customer          = InferSelectModel<typeof customers>
export type PurchaseOrder     = InferSelectModel<typeof purchaseOrders>
export type PurchaseOrderItem = InferSelectModel<typeof purchaseOrderItems>
export type CartonSizeComposition = InferSelectModel<typeof cartonSizeCompositions>
export type OrderPayment      = InferSelectModel<typeof orderPayments>
export type Reception         = InferSelectModel<typeof receptions>
export type ReceptionItem     = InferSelectModel<typeof receptionItems>
export type Transfer          = InferSelectModel<typeof transfers>
export type TransferItem      = InferSelectModel<typeof transferItems>
export type StockMovement     = InferSelectModel<typeof stockMovements>
export type Sale              = InferSelectModel<typeof sales>
export type SaleItem          = InferSelectModel<typeof saleItems>
export type SalePayment       = InferSelectModel<typeof salePayments>

// ─── Insert types (écriture vers la DB) ──────────────────────────────────────
export type WarehouseInsert         = Omit<InferInsertModel<typeof warehouses>, 'id' | 'createdAt' | 'updatedAt'>
export type ProductInsert           = Omit<InferInsertModel<typeof products>, 'id' | 'createdAt' | 'updatedAt'>
export type SupplierInsert          = Omit<InferInsertModel<typeof suppliers>, 'id' | 'createdAt' | 'updatedAt'>
export type CustomerInsert          = Omit<InferInsertModel<typeof customers>, 'id' | 'createdAt' | 'updatedAt'>
export type PurchaseOrderInsert     = Omit<InferInsertModel<typeof purchaseOrders>, 'id' | 'reference' | 'totalCostFcfa' | 'createdAt' | 'updatedAt'>
export type OrderPaymentInsert      = Omit<InferInsertModel<typeof orderPayments>, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>
export type ReceptionInsert         = Omit<InferInsertModel<typeof receptions>, 'id' | 'createdAt' | 'updatedAt'>
export type TransferInsert          = Omit<InferInsertModel<typeof transfers>, 'id' | 'createdAt' | 'updatedAt'>
export type SaleInsert              = Omit<InferInsertModel<typeof sales>, 'id' | 'reference' | 'totalAmountFcfa' | 'paidAmountFcfa' | 'status' | 'createdAt' | 'updatedAt'>
export type SalePaymentInsert       = Omit<InferInsertModel<typeof salePayments>, 'id' | 'saleId' | 'createdAt' | 'updatedAt'>

// ─── Types composites retournés par les services ──────────────────────────────
export type StockEntry = {
  productId:   string
  warehouseId: string
  size:        string
  totalPairs:  number
}

export type DashboardStats = {
  caToday:            number
  caThisMonth:        number
  caLastMonth:        number
  totalReceivables:   number
  pendingOrdersCount: number
  totalStockPairs:    number
}

export type StockForecastEntry = {
  productId:          string
  totalPairs:         number
  dailySalesRate:     number
  daysUntilStockout:  number | null
}

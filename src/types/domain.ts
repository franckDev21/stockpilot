// Types domaine pour le renderer (pas d'import Node.js/Drizzle ici)

export interface Warehouse {
  id: string
  name: string
  type: 'warehouse' | 'boutique'
  address: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Product {
  id: string
  reference: string
  name: string
  brand: string | null
  category: string | null
  description: string | null
  imageData: string | null
  pairsPerCarton: number
  alertThreshold: number
  sellingPricePerCarton: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Supplier {
  id: string
  name: string
  country: string | null
  city: string | null
  phone: string | null
  email: string | null
  whatsapp: string | null
  address: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  whatsapp: string | null
  address: string | null
  type: 'wholesale' | 'retail'
  notes: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface PurchaseOrder {
  id: string
  reference: string
  supplierId: string
  orderDate: string
  expectedDeliveryDate: string | null
  status: 'draft' | 'confirmed' | 'partial' | 'complete' | 'cancelled'
  productCostFcfa: number
  freightCostFcfa: number
  customsCostFcfa: number
  otherCostsFcfa: number
  totalCostFcfa: number
  simulatedSalePricePerCartonFcfa: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface PurchaseOrderItem {
  id: string
  orderId: string
  productId: string
  cartonsOrdered: number
  pairsPerCarton: number
  unitCostPerCartonFcfa: number
  notes: string | null
}

export interface CartonSizeComposition {
  id: string
  orderItemId: string
  size: string
  pairsCount: number
}

export interface OrderPayment {
  id: string
  orderId: string
  amountFcfa: number
  paymentDate: string
  type: 'deposit' | 'balance' | 'full'
  notes: string | null
  createdAt: string
}

export interface Reception {
  id: string
  orderId: string
  warehouseId: string
  receptionDate: string
  notes: string | null
}

export interface Transfer {
  id: string
  fromWarehouseId: string
  toWarehouseId: string
  transferDate: string
  notes: string | null
}

export interface Sale {
  id: string
  reference: string
  customerId: string | null
  warehouseId: string
  saleDate: string
  saleType: 'wholesale' | 'retail'
  totalAmountFcfa: number
  paidAmountFcfa: number
  status: 'pending' | 'partial' | 'paid'
  notes: string | null
}

export interface SaleItem {
  id: string
  saleId: string
  productId: string
  size: string
  quantity: number
  unitPriceFcfa: number
}

export interface EnrichedOrderItem {
  id: string
  orderId: string
  productId: string
  productName: string | null
  productReference: string | null
  productImageData: string | null
  cartonsOrdered: number
  pairsPerCarton: number
  unitCostPerCartonFcfa: number
}

export interface EnrichedPurchaseOrder {
  id: string
  reference: string
  supplierId: string
  supplierName: string | null
  supplierPhone: string | null
  supplierWhatsapp: string | null
  supplierEmail: string | null
  supplierCountry: string | null
  supplierCity: string | null
  supplierAddress: string | null
  orderDate: string
  expectedDeliveryDate: string | null
  status: PurchaseOrder['status']
  totalCostFcfa: number
  notes: string | null
  createdAt: string
  items: EnrichedOrderItem[]
  payments: OrderPayment[]
}

export interface ProfitSimulation {
  totalRevenue:  number
  grossProfit:   number
  marginPct:     number
  costPerCarton: number
}

export interface StockEntry {
  productId: string
  warehouseId: string
  size: string
  totalPairs: number
}

export interface StockForecastItem {
  productId: string
  totalPairs: number
  dailySalesRate: number
  daysUntilStockout: number | null
}

export interface ReceivableItem {
  customerId: string
  customerName: string
  customerPhone: string | null
  totalDue: number
  salesCount: number
}

export interface DashboardStats {
  caToday: number
  caThisMonth: number
  caLastMonth: number
  totalReceivables: number
  pendingOrdersCount: number
  totalStockPairs: number
}

interface SalesTimelinePoint  { date: string; total: number; count: number }
interface TopProductStat       { productName: string; reference: string; totalPairs: number; totalRevenue: number }
interface StockForecastItem    { productId: string; totalPairs: number; dailySalesRate: number; daysUntilStockout: number | null }
interface ReceivableItem       { customerId: string; customerName: string; customerPhone: string | null; totalDue: number; salesCount: number }
interface LowStockItem         { productId: string; productName: string; reference: string; totalPairs: number; threshold: number }
interface SupplierPayableItem  { orderId: string; reference: string; supplierId: string; supplierName: string | null; totalCostFcfa: number; paidAmountFcfa: number; orderDate: string; status: string }

/** Part d'un versement imputée à une commande précise. */
interface PaymentAllocation {
  orderId:             string
  reference:           string
  orderDate:           string
  totalCostFcfa:       number
  paidBeforeFcfa:      number
  remainingBeforeFcfa: number
  allocatedFcfa:       number
  type:                'deposit' | 'balance' | 'full'
  isTargetOrder:       boolean
  settled:             boolean
}
/** Répartition d'un versement fournisseur, avant écriture. */
interface PaymentPlan {
  supplierId:       string
  supplierName:     string | null
  amountFcfa:       number
  supplierDebtFcfa: number
  allocations:      PaymentAllocation[]
  overflow:         boolean
  excessFcfa:       number
}
/** Un versement du fournisseur, avec le détail des commandes servies. */
interface SupplierPaymentGroup {
  groupId:      string
  supplierId:   string
  supplierName: string | null
  paymentDate:  string
  createdAt:    string
  totalFcfa:    number
  notes:        string | null
  lines: Array<{
    paymentId:      string
    orderId:        string
    orderReference: string
    amountFcfa:     number
    type:           'deposit' | 'balance' | 'full'
  }>
}
interface SyncSummary {
  success:    boolean
  online:     boolean
  configured: boolean
  pushed:     number
  pulled:     number
  errors:     string[]
  reason?:    'not_configured' | 'offline' | 'already_running'
}
interface SyncStatus {
  online:       boolean
  configured:   boolean
  lastSyncedAt: string | null
  pending:      number
}

declare interface Window {
  api: {
    auth: {
      login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
      getSession: () => Promise<{ authenticated: boolean }>
      logout:     () => Promise<{ success: boolean }>
      verifySuperAdmin: (password: string) => Promise<{ ok: boolean }>
    }

    warehouses: {
      getAll:  () => Promise<unknown[]>
      create:  (data: unknown) => Promise<unknown>
      update:  (id: string, data: unknown) => Promise<unknown>
      delete:  (id: string) => Promise<void>
    }
    products: {
      getAll:        () => Promise<unknown[]>
      getById:       (id: string) => Promise<unknown>
      create:        (data: unknown) => Promise<unknown>
      update:        (id: string, data: unknown) => Promise<unknown>
      delete:        (id: string) => Promise<void>
      getStock:      (warehouseId?: string) => Promise<unknown[]>
      getCartonStats:(id: string) => Promise<{ totalCartons: number; totalPairsFromCartons: number }>
    }
    suppliers: {
      getAll:  () => Promise<unknown[]>
      getById: (id: string) => Promise<unknown>
      create:  (data: unknown) => Promise<unknown>
      update:  (id: string, data: unknown) => Promise<unknown>
      delete:  (id: string) => Promise<void>
    }
    customers: {
      getAll:     () => Promise<unknown[]>
      getById:    (id: string) => Promise<unknown>
      create:     (data: unknown) => Promise<unknown>
      update:     (id: string, data: unknown) => Promise<unknown>
      delete:     (id: string) => Promise<void>
      getBalance: (id: string) => Promise<unknown>
    }
    purchaseOrders: {
      getAll:         () => Promise<unknown[]>
      getById:        (id: string) => Promise<unknown>
      getForEdit:     (id: string) => Promise<unknown>
      create:         (data: unknown) => Promise<unknown>
      update:         (id: string, data: unknown) => Promise<unknown>
      delete:         (id: string) => Promise<void>
      addPayment:     (orderId: string, data: unknown) => Promise<unknown>
      simulateProfit: (data: unknown) => Promise<unknown>
      getAllEnriched:  () => Promise<unknown[]>
      deletePayment:  (paymentId: string) => Promise<void>
      previewPayment: (orderId: string, amountFcfa: number) => Promise<PaymentPlan>
      addSupplierPayment: (orderId: string, data: {
        amountFcfa: number; paymentDate: string; notes?: string | null
      }) => Promise<PaymentPlan & { paymentGroupId: string }>
      getSupplierPaymentHistory: (supplierId: string) => Promise<SupplierPaymentGroup[]>
      getPaymentHistory: (supplierId?: string | null) => Promise<SupplierPaymentGroup[]>
    }
    receptions: {
      getAll:          () => Promise<unknown[]>
      getEnrichedList: () => Promise<unknown[]>
      getById:         (id: string) => Promise<unknown>
      create:          (data: unknown) => Promise<unknown>
      update:          (id: string, data: unknown) => Promise<unknown>
    }
    transfers: {
      getAll:  () => Promise<unknown[]>
      getById: (id: string) => Promise<unknown>
      create:  (data: unknown) => Promise<unknown>
    }
    sales: {
      getAll:     () => Promise<unknown[]>
      getById:    (id: string) => Promise<unknown>
      create:     (data: unknown) => Promise<unknown>
      delete:     (id: string) => Promise<void>
      addPayment: (saleId: string, data: unknown) => Promise<unknown>
    }
    stock: {
      getCurrent:   (warehouseId?: string) => Promise<unknown[]>
      getMovements: (productId: string, warehouseId?: string) => Promise<unknown[]>
      getLowStock:  () => Promise<LowStockItem[]>
    }
    stats: {
      getDashboard:        () => Promise<unknown>
      getSalesPeriod:      (data: unknown) => Promise<unknown[]>
      getTopProducts:      (data: unknown) => Promise<TopProductStat[]>
      getStockForecast:    () => Promise<StockForecastItem[]>
      getReceivables:      () => Promise<ReceivableItem[]>
      getSalesTimeline:    (days?: number) => Promise<SalesTimelinePoint[]>
      getSupplierPayables: () => Promise<SupplierPayableItem[]>
    }
    dialog: {
      pickImage: () => Promise<string | null>
    }
    seed: {
      demo:     () => Promise<{ inserted: number }>
      isSeeded: () => Promise<boolean>
      reset:    () => Promise<{ success: boolean }>
    }
    backup: {
      save:    () => Promise<{ success: boolean; path?: string }>
      restore: () => Promise<{ success: boolean }>
    }
    print: {
      toPDF: (options?: { filename?: string }) => Promise<{ success: boolean; path?: string }>
    }
    update: {
      check:   () => Promise<{ ok: boolean; version?: string | null; error?: string }>
      install: () => Promise<void>
      on: (channel: string, cb: (payload: unknown) => void) => (() => void)
    }
    sync: {
      now:            () => Promise<SyncSummary>
      getStatus:      () => Promise<SyncStatus>
      configure:      (data: { apiUrl: string; email: string; password: string }) => Promise<{ success: boolean; message?: string }>
      getConfig:      () => Promise<{ apiUrl: string; email: string; configured: boolean } | null>
      getDevDefaults: () => Promise<{ apiUrl: string; email: string; password: string }>
      logout:         () => Promise<{ success: boolean }>
    }
  }
}

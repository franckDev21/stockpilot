import { contextBridge, ipcRenderer } from 'electron'

// Helper typé pour tous les appels invoke
const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args)

const api = {
  auth: {
    login: (email: string, password: string) =>
      invoke<{ success: boolean; message?: string }>('auth:login', email, password),
    getSession: () => invoke<{ authenticated: boolean }>('auth:getSession'),
    logout:     () => invoke<{ success: boolean }>('auth:logout'),
    verifySuperAdmin: (password: string) => invoke<{ ok: boolean }>('auth:verifySuperAdmin', password),
  },

  warehouses: {
    getAll:  ()                        => invoke('warehouses:getAll'),
    create:  (data: unknown)           => invoke('warehouses:create', data),
    update:  (id: string, data: unknown) => invoke('warehouses:update', id, data),
    delete:  (id: string)              => invoke('warehouses:delete', id),
  },

  products: {
    getAll:   ()                           => invoke('products:getAll'),
    getById:  (id: string)                 => invoke('products:getById', id),
    create:   (data: unknown)              => invoke('products:create', data),
    update:   (id: string, data: unknown)  => invoke('products:update', id, data),
    delete:   (id: string)                 => invoke('products:delete', id),
    getStock:       (warehouseId?: string) => invoke('products:getStock', warehouseId),
    getCartonStats: (id: string)           => invoke<{ totalCartons: number; totalPairsFromCartons: number }>('products:getCartonStats', id),
  },

  suppliers: {
    getAll:  ()                           => invoke('suppliers:getAll'),
    getById: (id: string)                 => invoke('suppliers:getById', id),
    create:  (data: unknown)              => invoke('suppliers:create', data),
    update:  (id: string, data: unknown)  => invoke('suppliers:update', id, data),
    delete:  (id: string)                 => invoke('suppliers:delete', id),
  },

  customers: {
    getAll:     ()                           => invoke('customers:getAll'),
    getById:    (id: string)                 => invoke('customers:getById', id),
    create:     (data: unknown)              => invoke('customers:create', data),
    update:     (id: string, data: unknown)  => invoke('customers:update', id, data),
    delete:     (id: string)                 => invoke('customers:delete', id),
    getBalance: (id: string)                 => invoke('customers:getBalance', id),
  },

  purchaseOrders: {
    getAll:         ()                           => invoke('purchaseOrders:getAll'),
    getById:        (id: string)                 => invoke('purchaseOrders:getById', id),
    getForEdit:     (id: string)                 => invoke('purchaseOrders:getForEdit', id),
    create:         (data: unknown)              => invoke('purchaseOrders:create', data),
    update:         (id: string, data: unknown)  => invoke('purchaseOrders:update', id, data),
    delete:         (id: string)                 => invoke('purchaseOrders:delete', id),
    addPayment:       (orderId: string, data: unknown) => invoke('purchaseOrders:addPayment', orderId, data),
    simulateProfit:   (data: unknown)              => invoke('purchaseOrders:simulateProfit', data),
    getAllEnriched:    ()                           => invoke('purchaseOrders:getAllEnriched'),
    deletePayment:    (paymentId: string)          => invoke('purchaseOrders:deletePayment', paymentId),
    previewPayment:   (orderId: string, amountFcfa: number) =>
      invoke('purchaseOrders:previewPayment', orderId, amountFcfa),
    addSupplierPayment: (orderId: string, data: unknown) =>
      invoke('purchaseOrders:addSupplierPayment', orderId, data),
    getSupplierPaymentHistory: (supplierId: string) =>
      invoke('purchaseOrders:getSupplierPaymentHistory', supplierId),
    getPaymentHistory: (supplierId?: string | null) =>
      invoke('purchaseOrders:getPaymentHistory', supplierId ?? null),
  },

  receptions: {
    getAll:          ()              => invoke('receptions:getAll'),
    getEnrichedList: ()              => invoke('receptions:getEnrichedList'),
    getById:         (id: string)    => invoke('receptions:getById', id),
    create:          (data: unknown) => invoke('receptions:create', data),
    update:          (id: string, data: unknown) => invoke('receptions:update', id, data),
  },

  transfers: {
    getAll:  ()               => invoke('transfers:getAll'),
    getById: (id: string)     => invoke('transfers:getById', id),
    create:  (data: unknown)  => invoke('transfers:create', data),
  },

  sales: {
    getAll:     ()                              => invoke('sales:getAll'),
    getById:    (id: string)                    => invoke('sales:getById', id),
    create:     (data: unknown)                 => invoke('sales:create', data),
    delete:     (id: string)                    => invoke('sales:delete', id),
    addPayment: (saleId: string, data: unknown) => invoke('sales:addPayment', saleId, data),
  },

  stock: {
    getCurrent:   (warehouseId?: string)                       => invoke('stock:getCurrent', warehouseId),
    getMovements: (productId: string, warehouseId?: string)    => invoke('stock:getMovements', productId, warehouseId),
    getLowStock:  ()                                            => invoke('stock:getLowStock'),
  },

  stats: {
    getDashboard:     ()              => invoke('stats:getDashboard'),
    getSalesPeriod:   (data: unknown) => invoke('stats:getSalesPeriod', data),
    getTopProducts:   (data: unknown) => invoke('stats:getTopProducts', data),
    getStockForecast: ()              => invoke('stats:getStockForecast'),
    getReceivables:       ()              => invoke('stats:getReceivables'),
    getSalesTimeline:     (days?: number) => invoke('stats:getSalesTimeline', days),
    getSupplierPayables:  ()              => invoke('stats:getSupplierPayables'),
  },

  dialog: {
    pickImage: (): Promise<string | null> => invoke('dialog:pickImage'),
  },

  seed: {
    demo:     (): Promise<{ inserted: number }> => invoke('seed:demo'),
    isSeeded: (): Promise<boolean>              => invoke('seed:isSeeded'),
    reset:    (): Promise<{ success: boolean }> => invoke('seed:reset'),
  },

  backup: {
    save:    (): Promise<{ success: boolean; path?: string }> => invoke('backup:save'),
    restore: (): Promise<{ success: boolean }>                => invoke('backup:restore'),
    upload:  (opts: { posteLabel?: string; credentials?: { apiUrl: string; email: string; password: string } }) =>
      invoke('backup:upload', opts) as Promise<{ success: boolean; message?: string; sizeBytes?: number; backupId?: string }>,
    uploadInfo: () =>
      invoke('backup:uploadInfo') as Promise<{ posteLabel: string; apiUrl: string; sansIdentifiants: boolean }>,
  },

  print: {
    toPDF: (options?: { filename?: string }): Promise<{ success: boolean; path?: string }> => invoke('print:toPDF', options),
  },

  sync: {
    now:            () => invoke('sync:now'),
    getStatus:      () => invoke('sync:getStatus'),
    configure:      (data: { apiUrl: string; email: string; password: string }) => invoke('sync:configure', data),
    getConfig:      () => invoke('sync:getConfig'),
    getDevDefaults: () => invoke('sync:getDevDefaults'),
    logout:         () => invoke('sync:logout'),
    pushInfo:       () => invoke('sync:pushInfo'),
    pushAll:        (data?: { credentials?: { apiUrl: string; email: string; password: string } }) =>
      invoke('sync:pushAll', data),
    pullAll:        (data?: { credentials?: { apiUrl: string; email: string; password: string } }) =>
      invoke('sync:pullAll', data),
    // Progression de l'envoi ; renvoie une fonction de désabonnement.
    onPushProgress: (cb: (p: { entity: string; done: number; total: number }) => void): (() => void) => {
      const listener = (_e: unknown, payload: { entity: string; done: number; total: number }) => cb(payload)
      ipcRenderer.on('sync:pushProgress', listener)
      return () => ipcRenderer.removeListener('sync:pushProgress', listener)
    },
  },

  update: {
    check:   (): Promise<{ ok: boolean; version?: string | null; error?: string }> => invoke('update:check'),
    install: (): Promise<void> => invoke('update:install'),
    // S'abonner aux événements de mise à jour ; renvoie une fonction de désabonnement
    on: (channel: string, cb: (payload: unknown) => void): (() => void) => {
      const allowed = [
        'update:checking', 'update:available', 'update:none',
        'update:error', 'update:progress', 'update:downloaded',
      ]
      if (!allowed.includes(channel)) return () => {}
      const listener = (_e: unknown, payload: unknown) => cb(payload)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
  },
} as const

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api

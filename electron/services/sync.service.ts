import { eq } from 'drizzle-orm'
import { getDb } from '../db/index'
import {
  warehouses, products, suppliers, customers,
  purchaseOrders, purchaseOrderItems, cartonSizeCompositions, orderPayments,
  receptions, receptionItems, transfers, transferItems,
  syncMeta,
} from '../db/schema'
import {
  type SyncConfig, readConfig, writeConfig, isConfigured, clearConfig,
} from './sync-config.service'

// ─── Synchronisation offline-first avec l'API en ligne ───────────────────────
// Stratégie « dernière écriture gagne » (comparaison des updatedAt), un seul
// poste actif pour l'instant. La synchro est ADDITIVE : les suppressions
// (deletedAt) locales ne sont jamais poussées vers l'API, et les enregistrements
// soft-supprimés localement sont simplement exclus du push.
//
// Ordre impératif (contraintes FK) : warehouses/suppliers/customers/products,
// puis purchase_orders(+items+sizes), puis order_payments, puis receptions
// (+items), puis transfers(+items). stock_movements n'est JAMAIS synchronisé
// directement (effet de bord côté API, comme en local) — voir CONTEXT / rapport
// pour la limitation connue de cette v1 (voir bas de fichier).

// ─── Types des réponses API (camelCase — convertis par CamelCaseResponseMiddleware) ───

interface ApiWarehouse {
  id: string; name: string; type: 'warehouse' | 'boutique'; address: string | null
  isDefault: boolean; createdAt: string; updatedAt: string; deletedAt: string | null
}
interface ApiProduct {
  id: string; reference: string; name: string; brand: string | null; category: string | null
  description: string | null; imageData: string | null; pairsPerCarton: number
  alertThreshold: number; sellingPricePerCarton: number
  createdAt: string; updatedAt: string; deletedAt: string | null
}
interface ApiSupplier {
  id: string; name: string; country: string | null; city: string | null; phone: string | null
  email: string | null; whatsapp: string | null; address: string | null; notes: string | null
  createdAt: string; updatedAt: string; deletedAt: string | null
}
interface ApiCustomer {
  id: string; name: string; phone: string | null; email: string | null; whatsapp: string | null
  address: string | null; type: 'wholesale' | 'retail'; notes: string | null
  createdAt: string; updatedAt: string; deletedAt: string | null
}
interface ApiCartonSize { id: string; orderItemId: string; size: string; pairsCount: number }
interface ApiOrderItem {
  id: string; orderId: string; productId: string; cartonsOrdered: number; pairsPerCarton: number
  unitCostPerCartonFcfa: number; notes: string | null; createdAt: string; updatedAt: string
  sizeCompositions?: ApiCartonSize[]
}
interface ApiOrderPayment {
  id: string; orderId: string; amountFcfa: number; paymentDate: string
  type: 'deposit' | 'balance' | 'full'; notes: string | null; createdAt: string; updatedAt: string
}
interface ApiPurchaseOrder {
  id: string; reference: string; supplierId: string; orderDate: string
  expectedDeliveryDate: string | null
  status: 'draft' | 'confirmed' | 'partial' | 'complete' | 'cancelled'
  productCostFcfa: number; freightCostFcfa: number; customsCostFcfa: number; otherCostsFcfa: number
  totalCostFcfa: number; simulatedSalePricePerCartonFcfa: number | null; notes: string | null
  createdAt: string; updatedAt: string; deletedAt: string | null
  items: ApiOrderItem[]; payments: ApiOrderPayment[]
}
interface ApiReceptionItem {
  id: string; receptionId: string; orderItemId: string; cartonsReceived: number
  createdAt: string; updatedAt: string
}
interface ApiReception {
  id: string; orderId: string; warehouseId: string; receptionDate: string; notes: string | null
  createdAt: string; updatedAt: string; deletedAt: string | null; items: ApiReceptionItem[]
}
interface ApiTransferItem {
  id: string; transferId: string; productId: string; size: string; pairsCount: number
  createdAt: string; updatedAt: string
}
interface ApiTransfer {
  id: string; fromWarehouseId: string; toWarehouseId: string; transferDate: string; notes: string | null
  createdAt: string; updatedAt: string; deletedAt: string | null; items: ApiTransferItem[]
}

// ─── Utilitaires bas niveau ───────────────────────────────────────────────────

class SyncHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function errMessage(e: unknown): string {
  if (e instanceof SyncHttpError) return `HTTP ${e.status} — ${e.message}`
  if (e instanceof Error) return e.message
  return String(e)
}

/** Compare deux timestamps quel que soit leur format (SQLite "YYYY-MM-DD HH:MM:SS"
 *  UTC sans fuseau, ou ISO8601 API avec 'T'/'Z') en les ramenant en epoch ms UTC. */
function toEpoch(value: string | null | undefined): number {
  if (!value) return 0
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value
  const t = new Date(normalized).getTime()
  return Number.isNaN(t) ? 0 : t
}

function toSnakeCase(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toSnakeCase)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const snake = k.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`)
      out[snake] = toSnakeCase(v)
    }
    return out
  }
  return value
}

function groupBy<T, K>(rows: T[], keyFn: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const row of rows) {
    const key = keyFn(row)
    const list = map.get(key)
    if (list) list.push(row)
    else map.set(key, [row])
  }
  return map
}

async function apiRequest(cfg: SyncConfig, method: string, path: string, body?: unknown, timeoutMs = 10000): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${cfg.apiUrl.replace(/\/$/, '')}/api/v1${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept:          'application/json',
        Authorization:   `Bearer ${cfg.token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    if (res.status === 404) return null
    const text = await res.text()
    const json: unknown = text ? JSON.parse(text) : null
    if (!res.ok) {
      const message =
        json && typeof json === 'object' && 'message' in json
          ? String((json as Record<string, unknown>).message)
          : `HTTP ${res.status}`
      throw new SyncHttpError(res.status, message)
    }
    return json
  } finally {
    clearTimeout(timer)
  }
}

async function apiGet<T>(cfg: SyncConfig, path: string): Promise<T | null> {
  return (await apiRequest(cfg, 'GET', path)) as T | null
}
async function apiPost(cfg: SyncConfig, path: string, body: unknown): Promise<unknown> {
  return apiRequest(cfg, 'POST', path, body)
}
async function apiPut(cfg: SyncConfig, path: string, body: unknown): Promise<unknown> {
  return apiRequest(cfg, 'PUT', path, body)
}

/** Ping de connectivité — pas de navigator.onLine fiable côté process main, on fait un vrai appel réseau. */
export async function checkConnectivity(apiUrl: string, timeoutMs = 2500): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/health`, { signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Connexion à l'API (Sanctum) — récupère et persiste le bearer token. */
export async function login(apiUrl: string, email: string, password: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    const text = await res.text()
    const json = (text ? JSON.parse(text) : {}) as Record<string, unknown>
    if (!res.ok) {
      const message = typeof json.message === 'string' ? json.message : 'Échec de connexion à l’API.'
      return { success: false, message }
    }
    const token = json.token
    if (typeof token !== 'string') return { success: false, message: 'Réponse API invalide (token manquant).' }
    writeConfig({ apiUrl, email, token })
    return { success: true }
  } catch (e) {
    return { success: false, message: errMessage(e) }
  }
}

export async function configure(opts: { apiUrl: string; email: string; password: string }): Promise<{ success: boolean; message?: string }> {
  const apiUrl = opts.apiUrl.trim().replace(/\/$/, '')
  return login(apiUrl, opts.email.trim(), opts.password)
}

export function getCurrentConfig(): { apiUrl: string; email: string; configured: boolean } | null {
  const cfg = readConfig()
  if (!cfg) return null
  return { apiUrl: cfg.apiUrl, email: cfg.email, configured: true }
}

export function logoutFromApi(): void {
  clearConfig()
}

// ─── sync_meta (lastSyncedAt) ─────────────────────────────────────────────────

function getLastSyncedAt(): string | null {
  const row = getDb().select().from(syncMeta).where(eq(syncMeta.key, 'lastSyncedAt')).get()
  return row?.value ?? null
}

function setLastSyncedAt(value: string): void {
  getDb()
    .insert(syncMeta)
    .values({ key: 'lastSyncedAt', value })
    .onConflictDoUpdate({ target: syncMeta.key, set: { value } })
    .run()
}

function countLocalChangesSince(since: string | null): number {
  const db = getDb()
  const sinceEpoch = toEpoch(since)
  let count = 0
  const bump = (rows: Array<{ updatedAt: string }>) => {
    for (const row of rows) if (toEpoch(row.updatedAt) > sinceEpoch) count++
  }
  bump(db.select({ updatedAt: warehouses.updatedAt }).from(warehouses).all())
  bump(db.select({ updatedAt: products.updatedAt }).from(products).all())
  bump(db.select({ updatedAt: suppliers.updatedAt }).from(suppliers).all())
  bump(db.select({ updatedAt: customers.updatedAt }).from(customers).all())
  bump(db.select({ updatedAt: purchaseOrders.updatedAt }).from(purchaseOrders).all())
  bump(db.select({ updatedAt: orderPayments.updatedAt }).from(orderPayments).all())
  bump(db.select({ updatedAt: receptions.updatedAt }).from(receptions).all())
  bump(db.select({ updatedAt: transfers.updatedAt }).from(transfers).all())
  return count
}

// ─── Diff générique push/pull pour une entité « plate » ──────────────────────

interface SyncEntityOpts<
  LocalRow extends { id: string; updatedAt: string; deletedAt: string | null },
  ApiRow extends { id: string; updatedAt: string },
> {
  cfg:      SyncConfig
  name:     string
  endpoint: string
  /** false pour les entités create-only côté API (receptions, transfers) — jamais de PUT. */
  canUpdate: boolean
  localRows: LocalRow[]
  remoteRows: ApiRow[]
  toApiBody: (row: LocalRow) => Record<string, unknown>
  applyRemoteToLocal: (remote: ApiRow) => Promise<void>
  errors: string[]
}

async function syncSimpleEntity<
  LocalRow extends { id: string; updatedAt: string; deletedAt: string | null },
  ApiRow extends { id: string; updatedAt: string },
>(opts: SyncEntityOpts<LocalRow, ApiRow>): Promise<{ pushed: number; pulled: number }> {
  const remoteById = new Map(opts.remoteRows.map((r) => [r.id, r]))
  let pushed = 0

  for (const local of opts.localRows) {
    if (local.deletedAt) continue // additive-only : pas de propagation des suppressions locales
    const remote = remoteById.get(local.id)
    try {
      if (!remote) {
        await apiPost(opts.cfg, opts.endpoint, opts.toApiBody(local))
        pushed++
      } else if (opts.canUpdate && toEpoch(local.updatedAt) > toEpoch(remote.updatedAt)) {
        await apiPut(opts.cfg, `${opts.endpoint}/${local.id}`, opts.toApiBody(local))
        pushed++
      }
    } catch (e) {
      opts.errors.push(`${opts.name} ${local.id}: ${errMessage(e)}`)
    }
  }

  const localById = new Map(opts.localRows.map((r) => [r.id, r]))
  let pulled = 0

  for (const remote of opts.remoteRows) {
    const local = localById.get(remote.id)
    if (!local || toEpoch(remote.updatedAt) > toEpoch(local.updatedAt)) {
      try {
        await opts.applyRemoteToLocal(remote)
        pulled++
      } catch (e) {
        opts.errors.push(`${opts.name} (pull) ${remote.id}: ${errMessage(e)}`)
      }
    }
  }

  return { pushed, pulled }
}

// ─── Entités simples : warehouses, products, suppliers, customers ────────────

async function syncWarehouses(cfg: SyncConfig, errors: string[]) {
  const db = getDb()
  const localRows = db.select().from(warehouses).all()
  const remoteRows = (await apiGet<ApiWarehouse[]>(cfg, '/warehouses')) ?? []

  const toApiBody = (w: (typeof localRows)[number]): Record<string, unknown> =>
    toSnakeCase({ id: w.id, name: w.name, type: w.type, address: w.address, isDefault: w.isDefault }) as Record<string, unknown>

  const applyRemoteToLocal = async (r: ApiWarehouse): Promise<void> => {
    db.insert(warehouses)
      .values({
        id: r.id, name: r.name, type: r.type, address: r.address, isDefault: r.isDefault,
        createdAt: r.createdAt, updatedAt: r.updatedAt, deletedAt: r.deletedAt,
      })
      .onConflictDoUpdate({
        target: warehouses.id,
        set: { name: r.name, type: r.type, address: r.address, isDefault: r.isDefault, updatedAt: r.updatedAt, deletedAt: r.deletedAt },
      })
      .run()
  }

  return syncSimpleEntity({ cfg, name: 'warehouses', endpoint: '/warehouses', canUpdate: true, localRows, remoteRows, toApiBody, applyRemoteToLocal, errors })
}

async function syncSuppliers(cfg: SyncConfig, errors: string[]) {
  const db = getDb()
  const localRows = db.select().from(suppliers).all()
  const remoteRows = (await apiGet<ApiSupplier[]>(cfg, '/suppliers')) ?? []

  const toApiBody = (s: (typeof localRows)[number]): Record<string, unknown> =>
    toSnakeCase({
      id: s.id, name: s.name, country: s.country, city: s.city, phone: s.phone,
      email: s.email, whatsapp: s.whatsapp, address: s.address, notes: s.notes,
    }) as Record<string, unknown>

  const applyRemoteToLocal = async (r: ApiSupplier): Promise<void> => {
    db.insert(suppliers)
      .values({
        id: r.id, name: r.name, country: r.country, city: r.city, phone: r.phone,
        email: r.email, whatsapp: r.whatsapp, address: r.address, notes: r.notes,
        createdAt: r.createdAt, updatedAt: r.updatedAt, deletedAt: r.deletedAt,
      })
      .onConflictDoUpdate({
        target: suppliers.id,
        set: {
          name: r.name, country: r.country, city: r.city, phone: r.phone, email: r.email,
          whatsapp: r.whatsapp, address: r.address, notes: r.notes, updatedAt: r.updatedAt, deletedAt: r.deletedAt,
        },
      })
      .run()
  }

  return syncSimpleEntity({ cfg, name: 'suppliers', endpoint: '/suppliers', canUpdate: true, localRows, remoteRows, toApiBody, applyRemoteToLocal, errors })
}

async function syncCustomers(cfg: SyncConfig, errors: string[]) {
  const db = getDb()
  const localRows = db.select().from(customers).all()
  const remoteRows = (await apiGet<ApiCustomer[]>(cfg, '/customers')) ?? []

  const toApiBody = (c: (typeof localRows)[number]): Record<string, unknown> =>
    toSnakeCase({
      id: c.id, name: c.name, phone: c.phone, email: c.email, whatsapp: c.whatsapp,
      address: c.address, type: c.type, notes: c.notes,
    }) as Record<string, unknown>

  const applyRemoteToLocal = async (r: ApiCustomer): Promise<void> => {
    db.insert(customers)
      .values({
        id: r.id, name: r.name, phone: r.phone, email: r.email, whatsapp: r.whatsapp,
        address: r.address, type: r.type, notes: r.notes,
        createdAt: r.createdAt, updatedAt: r.updatedAt, deletedAt: r.deletedAt,
      })
      .onConflictDoUpdate({
        target: customers.id,
        set: {
          name: r.name, phone: r.phone, email: r.email, whatsapp: r.whatsapp, address: r.address,
          type: r.type, notes: r.notes, updatedAt: r.updatedAt, deletedAt: r.deletedAt,
        },
      })
      .run()
  }

  return syncSimpleEntity({ cfg, name: 'customers', endpoint: '/customers', canUpdate: true, localRows, remoteRows, toApiBody, applyRemoteToLocal, errors })
}

async function syncProducts(cfg: SyncConfig, errors: string[]) {
  const db = getDb()
  const localRows = db.select().from(products).all()
  const remoteRows = (await apiGet<ApiProduct[]>(cfg, '/products')) ?? []

  const toApiBody = (p: (typeof localRows)[number]): Record<string, unknown> =>
    toSnakeCase({
      id: p.id, reference: p.reference, name: p.name, brand: p.brand, category: p.category,
      description: p.description, imageData: p.imageData, pairsPerCarton: p.pairsPerCarton,
      alertThreshold: p.alertThreshold, sellingPricePerCarton: p.sellingPricePerCarton,
    }) as Record<string, unknown>

  const applyRemoteToLocal = async (r: ApiProduct): Promise<void> => {
    db.insert(products)
      .values({
        id: r.id, reference: r.reference, name: r.name, brand: r.brand, category: r.category,
        description: r.description, imageData: r.imageData, pairsPerCarton: r.pairsPerCarton,
        alertThreshold: r.alertThreshold, sellingPricePerCarton: r.sellingPricePerCarton,
        createdAt: r.createdAt, updatedAt: r.updatedAt, deletedAt: r.deletedAt,
      })
      .onConflictDoUpdate({
        target: products.id,
        set: {
          reference: r.reference, name: r.name, brand: r.brand, category: r.category,
          description: r.description, imageData: r.imageData, pairsPerCarton: r.pairsPerCarton,
          alertThreshold: r.alertThreshold, sellingPricePerCarton: r.sellingPricePerCarton,
          updatedAt: r.updatedAt, deletedAt: r.deletedAt,
        },
      })
      .run()
  }

  return syncSimpleEntity({ cfg, name: 'products', endpoint: '/products', canUpdate: true, localRows, remoteRows, toApiBody, applyRemoteToLocal, errors })
}

// ─── Commandes fournisseur (+ items + tailles) ────────────────────────────────

async function syncPurchaseOrders(cfg: SyncConfig, errors: string[]): Promise<{ pushed: number; pulled: number; remoteOrders: ApiPurchaseOrder[] }> {
  const db = getDb()
  const localOrders = db.select().from(purchaseOrders).all()
  const remoteOrders = (await apiGet<ApiPurchaseOrder[]>(cfg, '/purchase-orders')) ?? []

  const allLocalItems = db.select().from(purchaseOrderItems).all()
  const itemsByOrder = groupBy(allLocalItems, (i) => i.orderId)
  const allSizes = db.select().from(cartonSizeCompositions).all()
  const sizesByItem = groupBy(allSizes, (s) => s.orderItemId)

  const toApiBody = (order: (typeof localOrders)[number]): Record<string, unknown> => {
    const items = (itemsByOrder.get(order.id) ?? []).map((item) => ({
      id: item.id,
      productId: item.productId,
      cartonsOrdered: item.cartonsOrdered,
      pairsPerCarton: item.pairsPerCarton,
      unitCostPerCartonFcfa: item.unitCostPerCartonFcfa,
      notes: item.notes,
      sizes: (sizesByItem.get(item.id) ?? []).map((s) => ({ id: s.id, size: s.size, pairsCount: s.pairsCount })),
    }))
    return toSnakeCase({
      id: order.id,
      supplierId: order.supplierId,
      orderDate: order.orderDate,
      expectedDeliveryDate: order.expectedDeliveryDate,
      status: order.status,
      productCostFcfa: order.productCostFcfa,
      freightCostFcfa: order.freightCostFcfa,
      customsCostFcfa: order.customsCostFcfa,
      otherCostsFcfa: order.otherCostsFcfa,
      simulatedSalePricePerCartonFcfa: order.simulatedSalePricePerCartonFcfa,
      notes: order.notes,
      items,
    }) as Record<string, unknown>
  }

  const applyRemoteToLocal = async (remote: ApiPurchaseOrder): Promise<void> => {
    const isNew = !localOrders.some((o) => o.id === remote.id)

    db.insert(purchaseOrders)
      .values({
        id: remote.id, reference: remote.reference, supplierId: remote.supplierId,
        orderDate: remote.orderDate, expectedDeliveryDate: remote.expectedDeliveryDate,
        status: remote.status, productCostFcfa: remote.productCostFcfa, freightCostFcfa: remote.freightCostFcfa,
        customsCostFcfa: remote.customsCostFcfa, otherCostsFcfa: remote.otherCostsFcfa,
        totalCostFcfa: remote.totalCostFcfa, simulatedSalePricePerCartonFcfa: remote.simulatedSalePricePerCartonFcfa,
        notes: remote.notes, createdAt: remote.createdAt, updatedAt: remote.updatedAt, deletedAt: remote.deletedAt,
      })
      .onConflictDoUpdate({
        target: purchaseOrders.id,
        set: {
          reference: remote.reference, supplierId: remote.supplierId, orderDate: remote.orderDate,
          expectedDeliveryDate: remote.expectedDeliveryDate, status: remote.status,
          productCostFcfa: remote.productCostFcfa, freightCostFcfa: remote.freightCostFcfa,
          customsCostFcfa: remote.customsCostFcfa, otherCostsFcfa: remote.otherCostsFcfa,
          totalCostFcfa: remote.totalCostFcfa, simulatedSalePricePerCartonFcfa: remote.simulatedSalePricePerCartonFcfa,
          notes: remote.notes, updatedAt: remote.updatedAt, deletedAt: remote.deletedAt,
        },
      })
      .run()

    // Les items/tailles sont immuables après création (comme en local) : on ne
    // les insère qu'à la découverte d'une commande totalement nouvelle. On va
    // chercher le détail (show) pour récupérer les tailles, absentes de l'index().
    if (isNew) {
      for (const item of remote.items ?? []) {
        db.insert(purchaseOrderItems)
          .values({
            id: item.id, orderId: remote.id, productId: item.productId,
            cartonsOrdered: item.cartonsOrdered, pairsPerCarton: item.pairsPerCarton,
            unitCostPerCartonFcfa: item.unitCostPerCartonFcfa, notes: item.notes,
            createdAt: item.createdAt, updatedAt: item.updatedAt,
          })
          .onConflictDoNothing()
          .run()
      }

      const detail = await apiGet<ApiPurchaseOrder>(cfg, `/purchase-orders/${remote.id}`)
      for (const item of detail?.items ?? []) {
        for (const size of item.sizeCompositions ?? []) {
          db.insert(cartonSizeCompositions)
            .values({ id: size.id, orderItemId: item.id, size: size.size, pairsCount: size.pairsCount })
            .onConflictDoNothing()
            .run()
        }
      }
    }
  }

  const result = await syncSimpleEntity({
    cfg, name: 'purchase_orders', endpoint: '/purchase-orders', canUpdate: true,
    localRows: localOrders, remoteRows: remoteOrders, toApiBody, applyRemoteToLocal, errors,
  })

  return { ...result, remoteOrders }
}

// ─── Paiements fournisseur (pas de endpoint de mise à jour, comme en local) ──

async function syncOrderPayments(cfg: SyncConfig, remoteOrders: ApiPurchaseOrder[], errors: string[]): Promise<{ pushed: number; pulled: number }> {
  const db = getDb()
  const localPayments = db.select().from(orderPayments).all()
  const remotePayments = remoteOrders.flatMap((o) => o.payments ?? [])
  const remoteById = new Map(remotePayments.map((p) => [p.id, p]))
  const localById = new Map(localPayments.map((p) => [p.id, p]))

  let pushed = 0
  for (const local of localPayments) {
    if (local.deletedAt) continue
    if (!remoteById.has(local.id)) {
      try {
        await apiPost(cfg, `/purchase-orders/${local.orderId}/payments`, toSnakeCase({
          id: local.id, amountFcfa: local.amountFcfa, paymentDate: local.paymentDate,
          type: local.type, notes: local.notes,
        }))
        pushed++
      } catch (e) {
        errors.push(`order_payments ${local.id}: ${errMessage(e)}`)
      }
    }
  }

  let pulled = 0
  for (const remote of remotePayments) {
    if (!localById.has(remote.id)) {
      db.insert(orderPayments)
        .values({
          id: remote.id, orderId: remote.orderId, amountFcfa: remote.amountFcfa,
          paymentDate: remote.paymentDate, type: remote.type, notes: remote.notes,
          createdAt: remote.createdAt, updatedAt: remote.updatedAt,
        })
        .onConflictDoNothing()
        .run()
      pulled++
    }
  }

  return { pushed, pulled }
}

// ─── Réceptions (+ items) — create-only côté API ──────────────────────────────

async function syncReceptions(cfg: SyncConfig, errors: string[]) {
  const db = getDb()
  const localReceptions = db.select().from(receptions).all()
  const remoteRows = (await apiGet<ApiReception[]>(cfg, '/receptions')) ?? []
  const localItems = db.select().from(receptionItems).all()
  const itemsByReception = groupBy(localItems, (i) => i.receptionId)

  const toApiBody = (r: (typeof localReceptions)[number]): Record<string, unknown> => {
    const items = (itemsByReception.get(r.id) ?? []).map((i) => ({
      id: i.id, orderItemId: i.orderItemId, cartonsReceived: i.cartonsReceived,
    }))
    return toSnakeCase({
      id: r.id, orderId: r.orderId, warehouseId: r.warehouseId,
      receptionDate: r.receptionDate, notes: r.notes, items,
    }) as Record<string, unknown>
  }

  const applyRemoteToLocal = async (remote: ApiReception): Promise<void> => {
    db.insert(receptions)
      .values({
        id: remote.id, orderId: remote.orderId, warehouseId: remote.warehouseId,
        receptionDate: remote.receptionDate, notes: remote.notes,
        createdAt: remote.createdAt, updatedAt: remote.updatedAt, deletedAt: remote.deletedAt,
      })
      .onConflictDoUpdate({
        target: receptions.id,
        set: { notes: remote.notes, updatedAt: remote.updatedAt, deletedAt: remote.deletedAt },
      })
      .run()

    for (const item of remote.items ?? []) {
      db.insert(receptionItems)
        .values({
          id: item.id, receptionId: remote.id, orderItemId: item.orderItemId,
          cartonsReceived: item.cartonsReceived, createdAt: item.createdAt, updatedAt: item.updatedAt,
        })
        .onConflictDoNothing()
        .run()
    }
  }

  return syncSimpleEntity({
    // canUpdate: true → les modifications d'arrivage (super-admin) sont poussées
    // en PUT /receptions/{id}. Requiert le endpoint update côté API.
    cfg, name: 'receptions', endpoint: '/receptions', canUpdate: true,
    localRows: localReceptions, remoteRows, toApiBody, applyRemoteToLocal, errors,
  })
}

// ─── Transferts (+ items) — create-only côté API ─────────────────────────────

async function syncTransfers(cfg: SyncConfig, errors: string[]) {
  const db = getDb()
  const localTransfers = db.select().from(transfers).all()
  const remoteRows = (await apiGet<ApiTransfer[]>(cfg, '/transfers')) ?? []
  const localItems = db.select().from(transferItems).all()
  const itemsByTransfer = groupBy(localItems, (i) => i.transferId)

  const toApiBody = (t: (typeof localTransfers)[number]): Record<string, unknown> => {
    const items = (itemsByTransfer.get(t.id) ?? []).map((i) => ({
      id: i.id, productId: i.productId, size: i.size, pairsCount: i.pairsCount,
    }))
    return toSnakeCase({
      id: t.id, fromWarehouseId: t.fromWarehouseId, toWarehouseId: t.toWarehouseId,
      transferDate: t.transferDate, notes: t.notes, items,
    }) as Record<string, unknown>
  }

  const applyRemoteToLocal = async (remote: ApiTransfer): Promise<void> => {
    db.insert(transfers)
      .values({
        id: remote.id, fromWarehouseId: remote.fromWarehouseId, toWarehouseId: remote.toWarehouseId,
        transferDate: remote.transferDate, notes: remote.notes,
        createdAt: remote.createdAt, updatedAt: remote.updatedAt, deletedAt: remote.deletedAt,
      })
      .onConflictDoUpdate({
        target: transfers.id,
        set: { notes: remote.notes, updatedAt: remote.updatedAt, deletedAt: remote.deletedAt },
      })
      .run()

    for (const item of remote.items ?? []) {
      db.insert(transferItems)
        .values({
          id: item.id, transferId: remote.id, productId: item.productId, size: item.size,
          pairsCount: item.pairsCount, createdAt: item.createdAt, updatedAt: item.updatedAt,
        })
        .onConflictDoNothing()
        .run()
    }
  }

  return syncSimpleEntity({
    cfg, name: 'transfers', endpoint: '/transfers', canUpdate: false,
    localRows: localTransfers, remoteRows, toApiBody, applyRemoteToLocal, errors,
  })
}

// ─── Orchestration ─────────────────────────────────────────────────────────────

export interface SyncSummary {
  success:    boolean
  online:     boolean
  configured: boolean
  pushed:     number
  pulled:     number
  errors:     string[]
  reason?:    'not_configured' | 'offline' | 'already_running'
}

let syncInFlight = false

export async function runSync(): Promise<SyncSummary> {
  if (syncInFlight) {
    return { success: false, online: false, configured: isConfigured(), pushed: 0, pulled: 0, errors: [], reason: 'already_running' }
  }
  syncInFlight = true
  try {
    const cfg = readConfig()
    if (!cfg) {
      return { success: false, online: false, configured: false, pushed: 0, pulled: 0, errors: [], reason: 'not_configured' }
    }

    const online = await checkConnectivity(cfg.apiUrl)
    if (!online) {
      return { success: false, online: false, configured: true, pushed: 0, pulled: 0, errors: [], reason: 'offline' }
    }

    const errors: string[] = []
    let pushed = 0
    let pulled = 0

    // 1) Entités simples (aucune dépendance)
    const wh = await syncWarehouses(cfg, errors); pushed += wh.pushed; pulled += wh.pulled
    const su = await syncSuppliers(cfg, errors);  pushed += su.pushed; pulled += su.pulled
    const cu = await syncCustomers(cfg, errors);  pushed += cu.pushed; pulled += cu.pulled
    const pr = await syncProducts(cfg, errors);   pushed += pr.pushed; pulled += pr.pulled

    // 2) Commandes fournisseur (dépend de suppliers/products)
    const po = await syncPurchaseOrders(cfg, errors); pushed += po.pushed; pulled += po.pulled

    // 3) Paiements (dépend des commandes ; réutilise la liste déjà tirée par syncPurchaseOrders)
    const pay = await syncOrderPayments(cfg, po.remoteOrders, errors); pushed += pay.pushed; pulled += pay.pulled

    // 4) Réceptions (dépend des commandes + entrepôts)
    const re = await syncReceptions(cfg, errors); pushed += re.pushed; pulled += re.pulled

    // 5) Transferts (dépend des entrepôts + produits)
    const tr = await syncTransfers(cfg, errors); pushed += tr.pushed; pulled += tr.pulled

    setLastSyncedAt(new Date().toISOString())

    return { success: errors.length === 0, online: true, configured: true, pushed, pulled, errors }
  } catch (e) {
    return { success: false, online: false, configured: isConfigured(), pushed: 0, pulled: 0, errors: [errMessage(e)] }
  } finally {
    syncInFlight = false
  }
}

export interface SyncStatus {
  online:       boolean
  configured:   boolean
  lastSyncedAt: string | null
  pending:      number
}

export async function getStatus(): Promise<SyncStatus> {
  const cfg = readConfig()
  const lastSyncedAt = getLastSyncedAt()
  if (!cfg) return { online: false, configured: false, lastSyncedAt, pending: 0 }
  const online = await checkConnectivity(cfg.apiUrl)
  const pending = countLocalChangesSince(lastSyncedAt)
  return { online, configured: true, lastSyncedAt, pending }
}

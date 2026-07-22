import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ─── Timestamps helpers ───────────────────────────────────────────────────────

const timestamps = {
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at'),
}

// ─── Entrepôts & boutiques ────────────────────────────────────────────────────

export const warehouses = sqliteTable('warehouses', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  type:      text('type', { enum: ['warehouse', 'boutique'] }).notNull().default('boutique'),
  address:   text('address'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
})

// ─── Produits (modèles de chaussures) ────────────────────────────────────────

export const products = sqliteTable('products', {
  id:             text('id').primaryKey(),
  // Unique seulement parmi les produits actifs — cf. l'index partiel
  // products_ref_active_unique dans migrations.ts. Une référence est libérée
  // dès que le produit est supprimé (soft delete).
  reference:      text('reference').notNull(),
  name:           text('name').notNull(),
  brand:          text('brand'),
  category:       text('category'),
  description:    text('description'),
  imageData:             text('image_data'),
  pairsPerCarton:        integer('pairs_per_carton').notNull().default(12),
  alertThreshold:        integer('alert_threshold').notNull().default(0),
  sellingPricePerCarton: integer('selling_price_per_carton').notNull().default(0),
  ...timestamps,
}, (t) => ({
  refIdx: index('products_ref_idx').on(t.reference),
}))

// ─── Fournisseurs ─────────────────────────────────────────────────────────────

export const suppliers = sqliteTable('suppliers', {
  id:       text('id').primaryKey(),
  name:     text('name').notNull(),
  country:  text('country'),
  city:     text('city'),
  phone:    text('phone'),
  email:    text('email'),
  whatsapp: text('whatsapp'),
  address:  text('address'),
  notes:    text('notes'),
  ...timestamps,
})

// ─── Clients ──────────────────────────────────────────────────────────────────

export const customers = sqliteTable('customers', {
  id:       text('id').primaryKey(),
  name:     text('name').notNull(),
  phone:    text('phone'),
  email:    text('email'),
  whatsapp: text('whatsapp'),
  address:  text('address'),
  type:     text('type', { enum: ['wholesale', 'retail'] }).notNull().default('wholesale'),
  notes:    text('notes'),
  ...timestamps,
})

// ─── Commandes fournisseur ────────────────────────────────────────────────────

export const purchaseOrders = sqliteTable('purchase_orders', {
  id:                           text('id').primaryKey(),
  reference:                    text('reference').notNull().unique(),
  supplierId:                   text('supplier_id').notNull().references(() => suppliers.id),
  orderDate:                    text('order_date').notNull(),
  expectedDeliveryDate:         text('expected_delivery_date'),
  status: text('status', {
    enum: ['draft', 'confirmed', 'partial', 'complete', 'cancelled'],
  }).notNull().default('confirmed'),
  // Coûts — tous en FCFA (entiers, pas de float pour la monnaie)
  productCostFcfa:  integer('product_cost_fcfa').notNull().default(0),
  freightCostFcfa:  integer('freight_cost_fcfa').notNull().default(0),
  customsCostFcfa:  integer('customs_cost_fcfa').notNull().default(0),
  otherCostsFcfa:   integer('other_costs_fcfa').notNull().default(0),
  totalCostFcfa:    integer('total_cost_fcfa').notNull().default(0),
  // Simulation de rentabilité avant achat
  simulatedSalePricePerCartonFcfa: integer('simulated_sale_price_per_carton_fcfa'),
  notes:  text('notes'),
  ...timestamps,
}, (t) => ({
  supplierIdx: index('po_supplier_idx').on(t.supplierId),
  statusIdx:   index('po_status_idx').on(t.status),
}))

// ─── Lignes de commande (1 ligne = 1 modèle de carton) ───────────────────────

export const purchaseOrderItems = sqliteTable('purchase_order_items', {
  id:                     text('id').primaryKey(),
  orderId:                text('order_id').notNull().references(() => purchaseOrders.id),
  productId:              text('product_id').notNull().references(() => products.id),
  cartonsOrdered:         integer('cartons_ordered').notNull(),
  pairsPerCarton:         integer('pairs_per_carton').notNull(),
  unitCostPerCartonFcfa:  integer('unit_cost_per_carton_fcfa').notNull(),
  notes:                  text('notes'),
  ...timestamps,
}, (t) => ({
  orderIdx: index('poi_order_idx').on(t.orderId),
}))

// ─── Composition pointures d'un carton ───────────────────────────────────────

export const cartonSizeCompositions = sqliteTable('carton_size_compositions', {
  id:          text('id').primaryKey(),
  orderItemId: text('order_item_id').notNull().references(() => purchaseOrderItems.id),
  size:        text('size').notNull(),  // ex: "38", "39", "40"
  pairsCount:  integer('pairs_count').notNull(),
}, (t) => ({
  itemIdx: index('csc_item_idx').on(t.orderItemId),
}))

// ─── Paiements fournisseur ────────────────────────────────────────────────────

export const orderPayments = sqliteTable('order_payments', {
  id:          text('id').primaryKey(),
  orderId:     text('order_id').notNull().references(() => purchaseOrders.id),
  amountFcfa:  integer('amount_fcfa').notNull(),
  paymentDate: text('payment_date').notNull(),
  type:        text('type', { enum: ['deposit', 'balance', 'full'] }).notNull(),
  notes:       text('notes'),
  ...timestamps,
})

// ─── Arrivage #1 — Réceptions fournisseur → entrepôt ─────────────────────────

export const receptions = sqliteTable('receptions', {
  id:            text('id').primaryKey(),
  orderId:       text('order_id').notNull().references(() => purchaseOrders.id),
  warehouseId:   text('warehouse_id').notNull().references(() => warehouses.id),
  receptionDate: text('reception_date').notNull(),
  notes:         text('notes'),
  ...timestamps,
})

export const receptionItems = sqliteTable('reception_items', {
  id:              text('id').primaryKey(),
  receptionId:     text('reception_id').notNull().references(() => receptions.id),
  orderItemId:     text('order_item_id').notNull().references(() => purchaseOrderItems.id),
  cartonsReceived: integer('cartons_received').notNull(),
  ...timestamps,
}, (t) => ({
  receptionIdx: index('ri_reception_idx').on(t.receptionId),
}))

// ─── Arrivage #2 — Transferts entrepôt → boutique ────────────────────────────

export const transfers = sqliteTable('transfers', {
  id:               text('id').primaryKey(),
  fromWarehouseId:  text('from_warehouse_id').notNull().references(() => warehouses.id),
  toWarehouseId:    text('to_warehouse_id').notNull().references(() => warehouses.id),
  transferDate:     text('transfer_date').notNull(),
  notes:            text('notes'),
  ...timestamps,
})

export const transferItems = sqliteTable('transfer_items', {
  id:         text('id').primaryKey(),
  transferId: text('transfer_id').notNull().references(() => transfers.id),
  productId:  text('product_id').notNull().references(() => products.id),
  size:       text('size').notNull(),
  pairsCount: integer('pairs_count').notNull(),
  ...timestamps,
}, (t) => ({
  transferIdx: index('ti_transfer_idx').on(t.transferId),
}))

// ─── Mouvements de stock — table CENTRALE (source de vérité) ─────────────────

export const stockMovements = sqliteTable('stock_movements', {
  id:          text('id').primaryKey(),
  productId:   text('product_id').notNull().references(() => products.id),
  warehouseId: text('warehouse_id').notNull().references(() => warehouses.id),
  size:        text('size').notNull(),
  quantity:    integer('quantity').notNull(), // + entrée, - sortie
  movementType: text('movement_type', {
    enum: ['reception', 'transfer_in', 'transfer_out', 'sale', 'adjustment', 'loss'],
  }).notNull(),
  referenceId:   text('reference_id'),   // ID de la réception / transfert / vente
  referenceType: text('reference_type'), // 'reception' | 'transfer' | 'sale'
  unitCostFcfa:  integer('unit_cost_fcfa'), // coût par paire au moment de l'entrée
  movementDate:  text('movement_date').notNull(),
  notes:         text('notes'),
  ...timestamps,
}, (t) => ({
  productIdx:   index('sm_product_idx').on(t.productId),
  warehouseIdx: index('sm_warehouse_idx').on(t.warehouseId),
  dateIdx:      index('sm_date_idx').on(t.movementDate),
  refIdx:       index('sm_ref_idx').on(t.referenceId),
}))

// ─── Ventes ───────────────────────────────────────────────────────────────────

export const sales = sqliteTable('sales', {
  id:             text('id').primaryKey(),
  reference:      text('reference').notNull().unique(),
  customerId:     text('customer_id').references(() => customers.id),
  warehouseId:    text('warehouse_id').notNull().references(() => warehouses.id),
  saleDate:       text('sale_date').notNull(),
  saleType:       text('sale_type', { enum: ['wholesale', 'retail'] }).notNull(),
  totalAmountFcfa: integer('total_amount_fcfa').notNull().default(0),
  paidAmountFcfa:  integer('paid_amount_fcfa').notNull().default(0),
  status: text('status', {
    enum: ['pending', 'partial', 'paid'],
  }).notNull().default('pending'),
  notes: text('notes'),
  ...timestamps,
}, (t) => ({
  customerIdx: index('sales_customer_idx').on(t.customerId),
  dateIdx:     index('sales_date_idx').on(t.saleDate),
}))

export const saleItems = sqliteTable('sale_items', {
  id:            text('id').primaryKey(),
  saleId:        text('sale_id').notNull().references(() => sales.id),
  productId:     text('product_id').notNull().references(() => products.id),
  size:          text('size').notNull(),
  quantity:      integer('quantity').notNull(), // paires
  unitPriceFcfa: integer('unit_price_fcfa').notNull(),
  ...timestamps,
}, (t) => ({
  saleIdx: index('si_sale_idx').on(t.saleId),
}))

export const salePayments = sqliteTable('sale_payments', {
  id:          text('id').primaryKey(),
  saleId:      text('sale_id').notNull().references(() => sales.id),
  amountFcfa:  integer('amount_fcfa').notNull(),
  paymentDate: text('payment_date').notNull(),
  notes:       text('notes'),
  ...timestamps,
})

// ─── Synchronisation offline-first (état local de synchro avec l'API) ────────
// Table clé/valeur légère : lastSyncedAt, etc. L'URL API + le token Sanctum
// sont stockés séparément dans userData/sync-config.json (comme session.json).

export const syncMeta = sqliteTable('sync_meta', {
  key:   text('key').primaryKey(),
  value: text('value'),
})

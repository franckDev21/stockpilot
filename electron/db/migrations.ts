import type Database from 'better-sqlite3'

/**
 * Runs all DDL migrations on first launch and on schema updates.
 * Uses CREATE TABLE IF NOT EXISTS — safe to call on every startup.
 * ALTER TABLE statements are appended here (never modify existing CREATEs).
 */
export function runMigrations(sqlite: Database.Database): void {
  sqlite.exec(`
    -- ─── Entrepôts & boutiques ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS warehouses (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'boutique',
      address     TEXT,
      is_default  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at  TEXT
    );

    -- ─── Produits ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS products (
      id              TEXT PRIMARY KEY,
      -- Unicité assurée par l'index partiel products_ref_active_unique
      -- (voir migrateProductReferenceUnique) : une référence est libérée
      -- quand le produit est supprimé.
      reference       TEXT NOT NULL,
      name            TEXT NOT NULL,
      brand           TEXT,
      category        TEXT,
      description     TEXT,
      alert_threshold INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at      TEXT
    );
    CREATE INDEX IF NOT EXISTS products_ref_idx ON products(reference);

    -- ─── Fournisseurs ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS suppliers (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      country    TEXT,
      city       TEXT,
      phone      TEXT,
      email      TEXT,
      whatsapp   TEXT,
      address    TEXT,
      notes      TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );

    -- ─── Clients ───────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS customers (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      phone      TEXT,
      email      TEXT,
      whatsapp   TEXT,
      address    TEXT,
      type       TEXT NOT NULL DEFAULT 'wholesale',
      notes      TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );

    -- ─── Commandes fournisseur ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id                                    TEXT PRIMARY KEY,
      reference                             TEXT NOT NULL UNIQUE,
      supplier_id                           TEXT NOT NULL REFERENCES suppliers(id),
      order_date                            TEXT NOT NULL,
      expected_delivery_date                TEXT,
      status                                TEXT NOT NULL DEFAULT 'confirmed',
      product_cost_fcfa                     INTEGER NOT NULL DEFAULT 0,
      freight_cost_fcfa                     INTEGER NOT NULL DEFAULT 0,
      customs_cost_fcfa                     INTEGER NOT NULL DEFAULT 0,
      other_costs_fcfa                      INTEGER NOT NULL DEFAULT 0,
      total_cost_fcfa                       INTEGER NOT NULL DEFAULT 0,
      simulated_sale_price_per_carton_fcfa  INTEGER,
      notes                                 TEXT,
      created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS po_supplier_idx ON purchase_orders(supplier_id);
    CREATE INDEX IF NOT EXISTS po_status_idx   ON purchase_orders(status);

    -- ─── Lignes de commande ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id                       TEXT PRIMARY KEY,
      order_id                 TEXT NOT NULL REFERENCES purchase_orders(id),
      product_id               TEXT NOT NULL REFERENCES products(id),
      cartons_ordered          INTEGER NOT NULL,
      pairs_per_carton         INTEGER NOT NULL,
      unit_cost_per_carton_fcfa INTEGER NOT NULL,
      notes                    TEXT,
      created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS poi_order_idx ON purchase_order_items(order_id);

    -- ─── Composition pointures par carton ──────────────────────────────────
    CREATE TABLE IF NOT EXISTS carton_size_compositions (
      id            TEXT PRIMARY KEY,
      order_item_id TEXT NOT NULL REFERENCES purchase_order_items(id),
      size          TEXT NOT NULL,
      pairs_count   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS csc_item_idx ON carton_size_compositions(order_item_id);

    -- ─── Paiements fournisseur ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS order_payments (
      id           TEXT PRIMARY KEY,
      order_id     TEXT NOT NULL REFERENCES purchase_orders(id),
      amount_fcfa  INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      type         TEXT NOT NULL,
      notes        TEXT,
      created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at   TEXT
    );

    -- ─── Arrivage #1 : réceptions fournisseur ──────────────────────────────
    CREATE TABLE IF NOT EXISTS receptions (
      id             TEXT PRIMARY KEY,
      order_id       TEXT NOT NULL REFERENCES purchase_orders(id),
      warehouse_id   TEXT NOT NULL REFERENCES warehouses(id),
      reception_date TEXT NOT NULL,
      notes          TEXT,
      created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at     TEXT
    );

    CREATE TABLE IF NOT EXISTS reception_items (
      id               TEXT PRIMARY KEY,
      reception_id     TEXT NOT NULL REFERENCES receptions(id),
      order_item_id    TEXT NOT NULL REFERENCES purchase_order_items(id),
      cartons_received INTEGER NOT NULL,
      created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at       TEXT
    );
    CREATE INDEX IF NOT EXISTS ri_reception_idx ON reception_items(reception_id);

    -- ─── Arrivage #2 : transferts entrepôt → boutique ──────────────────────
    CREATE TABLE IF NOT EXISTS transfers (
      id                TEXT PRIMARY KEY,
      from_warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
      to_warehouse_id   TEXT NOT NULL REFERENCES warehouses(id),
      transfer_date     TEXT NOT NULL,
      notes             TEXT,
      created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at        TEXT
    );

    CREATE TABLE IF NOT EXISTS transfer_items (
      id          TEXT PRIMARY KEY,
      transfer_id TEXT NOT NULL REFERENCES transfers(id),
      product_id  TEXT NOT NULL REFERENCES products(id),
      size        TEXT NOT NULL,
      pairs_count INTEGER NOT NULL,
      created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS ti_transfer_idx ON transfer_items(transfer_id);

    -- ─── Mouvements de stock (source de vérité) ────────────────────────────
    CREATE TABLE IF NOT EXISTS stock_movements (
      id             TEXT PRIMARY KEY,
      product_id     TEXT NOT NULL REFERENCES products(id),
      warehouse_id   TEXT NOT NULL REFERENCES warehouses(id),
      size           TEXT NOT NULL,
      quantity       INTEGER NOT NULL,
      movement_type  TEXT NOT NULL,
      reference_id   TEXT,
      reference_type TEXT,
      unit_cost_fcfa INTEGER,
      movement_date  TEXT NOT NULL,
      notes          TEXT,
      created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at     TEXT
    );
    CREATE INDEX IF NOT EXISTS sm_product_idx   ON stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS sm_warehouse_idx ON stock_movements(warehouse_id);
    CREATE INDEX IF NOT EXISTS sm_date_idx      ON stock_movements(movement_date);
    CREATE INDEX IF NOT EXISTS sm_ref_idx       ON stock_movements(reference_id);

    -- ─── Ventes ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS sales (
      id               TEXT PRIMARY KEY,
      reference        TEXT NOT NULL UNIQUE,
      customer_id      TEXT REFERENCES customers(id),
      warehouse_id     TEXT NOT NULL REFERENCES warehouses(id),
      sale_date        TEXT NOT NULL,
      sale_type        TEXT NOT NULL,
      total_amount_fcfa INTEGER NOT NULL DEFAULT 0,
      paid_amount_fcfa  INTEGER NOT NULL DEFAULT 0,
      status           TEXT NOT NULL DEFAULT 'pending',
      notes            TEXT,
      created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at       TEXT
    );
    CREATE INDEX IF NOT EXISTS sales_customer_idx ON sales(customer_id);
    CREATE INDEX IF NOT EXISTS sales_date_idx     ON sales(sale_date);

    CREATE TABLE IF NOT EXISTS sale_items (
      id             TEXT PRIMARY KEY,
      sale_id        TEXT NOT NULL REFERENCES sales(id),
      product_id     TEXT NOT NULL REFERENCES products(id),
      size           TEXT NOT NULL,
      quantity       INTEGER NOT NULL,
      unit_price_fcfa INTEGER NOT NULL,
      created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at     TEXT
    );
    CREATE INDEX IF NOT EXISTS si_sale_idx ON sale_items(sale_id);

    CREATE TABLE IF NOT EXISTS sale_payments (
      id           TEXT PRIMARY KEY,
      sale_id      TEXT NOT NULL REFERENCES sales(id),
      amount_fcfa  INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      notes        TEXT,
      created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at   TEXT
    );

    -- ─── Synchronisation offline-first : état local (clé/valeur) ───────────
    CREATE TABLE IF NOT EXISTS sync_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    -- ─── Colonnes ajoutées après déploiement initial ──────────────────────
    -- Ces ALTER TABLE sont idempotents : si la colonne existe déjà, SQLite ignore.

    -- ─── Triggers updated_at ───────────────────────────────────────────────
    CREATE TRIGGER IF NOT EXISTS warehouses_updated_at
      AFTER UPDATE ON warehouses BEGIN
        UPDATE warehouses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

    CREATE TRIGGER IF NOT EXISTS products_updated_at
      AFTER UPDATE ON products BEGIN
        UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

    CREATE TRIGGER IF NOT EXISTS suppliers_updated_at
      AFTER UPDATE ON suppliers BEGIN
        UPDATE suppliers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

    CREATE TRIGGER IF NOT EXISTS customers_updated_at
      AFTER UPDATE ON customers BEGIN
        UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

    CREATE TRIGGER IF NOT EXISTS purchase_orders_updated_at
      AFTER UPDATE ON purchase_orders BEGIN
        UPDATE purchase_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

    CREATE TRIGGER IF NOT EXISTS sales_updated_at
      AFTER UPDATE ON sales BEGIN
        UPDATE sales SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
  `)

  // ALTER TABLE migrations — safe to run even if column already exists
  const alterMigrations = [
    `ALTER TABLE products ADD COLUMN image_data TEXT`,
    `ALTER TABLE products ADD COLUMN pairs_per_carton INTEGER NOT NULL DEFAULT 12`,
    `ALTER TABLE products ADD COLUMN selling_price_per_carton INTEGER NOT NULL DEFAULT 0`,
    // Un versement unique peut désormais être réparti sur plusieurs commandes du
    // même fournisseur (débordement FIFO). Les lignes issues d'un même versement
    // partagent ce group id, ce qui permet d'en réimprimer le reçu.
    // Nullable : les paiements enregistrés avant cette version restent valides.
    `ALTER TABLE order_payments ADD COLUMN payment_group_id TEXT`,
  ]
  for (const sql of alterMigrations) {
    try { sqlite.exec(sql) } catch { /* column already exists — ignore */ }
  }

  migrateProductReferenceUnique(sqlite)
}

/**
 * `products.reference` was created as `TEXT NOT NULL UNIQUE`, a table-level
 * constraint that also covers soft-deleted rows. A user who deleted a product
 * could therefore never reuse its reference — the row is hidden from the UI
 * but still occupies the reference, and the insert failed with a raw SQLite
 * error.
 *
 * We replace it with a *partial* unique index restricted to active rows, so a
 * reference is released as soon as its product is deleted. SQLite cannot drop
 * a column constraint in place, so the table has to be rebuilt.
 *
 * Idempotent: the rebuild only runs while the old UNIQUE constraint is still
 * present in the stored DDL.
 */
function migrateProductReferenceUnique(sqlite: Database.Database): void {
  const row = sqlite
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'products'`)
    .get() as { sql: string } | undefined
  if (!row) return

  // Matches the original `reference TEXT NOT NULL UNIQUE` column definition.
  const hasColumnUnique = /reference\s+TEXT[^,)]*\bUNIQUE\b/i.test(row.sql)

  if (hasColumnUnique) {
    // Rebuild without the column-level UNIQUE. Columns are listed explicitly so
    // the copy stays correct whatever order the ALTER TABLE migrations left.
    sqlite.exec(`
      PRAGMA foreign_keys = OFF;

      BEGIN;

      CREATE TABLE products_rebuilt (
        id                       TEXT PRIMARY KEY,
        reference                TEXT NOT NULL,
        name                     TEXT NOT NULL,
        brand                    TEXT,
        category                 TEXT,
        description              TEXT,
        alert_threshold          INTEGER NOT NULL DEFAULT 0,
        created_at               TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at               TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at               TEXT,
        image_data               TEXT,
        pairs_per_carton         INTEGER NOT NULL DEFAULT 12,
        selling_price_per_carton INTEGER NOT NULL DEFAULT 0
      );

      INSERT INTO products_rebuilt (
        id, reference, name, brand, category, description, alert_threshold,
        created_at, updated_at, deleted_at, image_data, pairs_per_carton,
        selling_price_per_carton
      )
      SELECT
        id, reference, name, brand, category, description, alert_threshold,
        created_at, updated_at, deleted_at, image_data, pairs_per_carton,
        selling_price_per_carton
      FROM products;

      DROP TABLE products;
      ALTER TABLE products_rebuilt RENAME TO products;

      COMMIT;

      PRAGMA foreign_keys = ON;
    `)

    // DROP TABLE took the lookup index and the updated_at trigger with it.
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS products_ref_idx ON products(reference);

      CREATE TRIGGER IF NOT EXISTS products_updated_at
        AFTER UPDATE ON products BEGIN
          UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
    `)
  }

  // Safe on a fresh database too: the initial CREATE TABLE still carries the
  // old constraint, so this runs right after the rebuild above.
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS products_ref_active_unique
      ON products(reference) WHERE deleted_at IS NULL;
  `)
}

import { createRequire } from 'node:module'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import * as schema from './schema'
import { runMigrations } from './migrations'

const require = createRequire(import.meta.url)
const Database  = require('better-sqlite3')       as typeof import('better-sqlite3')
const { drizzle } = require('drizzle-orm/better-sqlite3') as typeof import('drizzle-orm/better-sqlite3')

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>
type Sqlite = InstanceType<typeof Database>

let _db: DrizzleDB | null = null
let _sqlite: Sqlite | null = null

export function getDb(): DrizzleDB {
  if (!_db) throw new Error('Database not initialized. Call initDatabase() first.')
  return _db
}

/** Chemin du fichier de base — partagé avec les sauvegardes/restaurations. */
export function getDbPath(): string {
  return path.join(app.getPath('userData'), 'stockpilot.db')
}

/**
 * Handle better-sqlite3 brut. Nécessaire pour `.backup()`, la seule façon
 * correcte de copier une base en mode WAL : un simple copyFileSync du fichier
 * principal laisse derrière lui tout ce qui n'a pas encore été basculé du -wal.
 */
export function getSqlite(): Sqlite {
  if (!_sqlite) throw new Error('Database not initialized. Call initDatabase() first.')
  return _sqlite
}

/** Ferme proprement la base (checkpoint du WAL puis suppression des -wal/-shm). */
export function closeDatabase(): void {
  _sqlite?.close()
  _sqlite = null
  _db = null
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'stockpilot.db')

  fs.mkdirSync(userDataPath, { recursive: true })

  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('synchronous = NORMAL')

  runMigrations(sqlite)

  _sqlite = sqlite
  _db = drizzle(sqlite, { schema })
}

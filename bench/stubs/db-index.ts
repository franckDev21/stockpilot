
import * as schema from '/repo/electron/db/schema'
import { runMigrations } from '/repo/electron/db/migrations'

// @ts-ignore
declare const require: any
const Database = require('better-sqlite3')
const { drizzle } = require('drizzle-orm/better-sqlite3')

let _db: any = null
let _sqlite: any = null
let _path = ''

/** Bascule le banc d'un poste à l'autre — deux vraies bases SQLite. */
export function useDatabase(file: string): void {
  _sqlite?.close()
  const sqlite = new Database(file)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  runMigrations(sqlite)
  _sqlite = sqlite
  _db = drizzle(sqlite, { schema })
  _path = file
}

export function getDb(): any { return _db }
export function getSqlite(): any { return _sqlite }
export function getDbPath(): string { return _path }
export function closeDatabase(): void { _sqlite?.close(); _sqlite = null; _db = null }
export function initDatabase(): void {}

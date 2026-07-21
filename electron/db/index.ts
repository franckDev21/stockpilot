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

let _db: DrizzleDB | null = null

export function getDb(): DrizzleDB {
  if (!_db) throw new Error('Database not initialized. Call initDatabase() first.')
  return _db
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

  _db = drizzle(sqlite, { schema })
}

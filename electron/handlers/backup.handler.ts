import { app, dialog } from 'electron'
import type { IpcMain } from 'electron'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { closeDatabase, getDbPath, getSqlite } from '../db/index'
import { infosEnvoi, uploadDatabase } from '../services/backup-upload.service'

const require = createRequire(import.meta.url)

// ─── Sauvegarde / restauration de la base ────────────────────────────────────
// ⚠️ La base tourne en `journal_mode = WAL` (voir db/index.ts). Une copie du seul
// fichier `stockpilot.db` est donc INCOMPLÈTE : tout ce qui n'a pas encore été
// basculé depuis `stockpilot.db-wal` manque à l'appel. Sur une base fraîchement
// écrite, la copie peut même être totalement vide.
// D'où : `.backup()` (l'API de sauvegarde en ligne de SQLite) à l'écriture, et
// suppression des `-wal`/`-shm` devenus incohérents à la restauration.

/** Les fichiers annexes que SQLite tient à côté de la base en mode WAL. */
function sidecars(dbPath: string): string[] {
  return [`${dbPath}-wal`, `${dbPath}-shm`]
}

/** Refuse une restauration depuis un fichier qui n'est pas une base StockPilot. */
function assertLooksLikeStockpilotDb(file: string): void {
  const Database = require('better-sqlite3') as typeof import('better-sqlite3')
  let probe: import('better-sqlite3').Database | null = null
  try {
    probe = new Database(file, { readonly: true, fileMustExist: true })
    const found = probe
      .prepare(
        `SELECT count(*) AS n FROM sqlite_master
         WHERE type = 'table' AND name IN ('products', 'warehouses', 'purchase_orders')`,
      )
      .get() as { n: number }
    if (found.n < 3) {
      throw new Error(
        "Ce fichier ne ressemble pas à une base StockPilot (tables attendues absentes). " +
        "S'il a été produit par une ancienne version, il lui manque peut-être son fichier -wal.",
      )
    }
  } finally {
    probe?.close()
  }
}

export function registerBackupHandlers(ipcMain: IpcMain) {
  ipcMain.handle('backup:save', async (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender)!
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title:       'Sauvegarder la base de données',
      defaultPath: `stockpilot-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters:     [{ name: 'SQLite Database', extensions: ['db'] }],
    })
    if (canceled || !filePath) return { success: false }

    try {
      // Produit un fichier unique et cohérent, WAL inclus — contrairement à une
      // copie brute. Le résultat n'a besoin d'aucun fichier annexe.
      await getSqlite().backup(filePath)
      return { success: true, path: filePath }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('backup:uploadInfo', async () => infosEnvoi())

  ipcMain.handle('backup:upload', async (_event, opts: {
    posteLabel?: string
    credentials?: { apiUrl: string; email: string; password: string }
  }) => uploadDatabase(opts ?? {}))

  ipcMain.handle('backup:restore', async (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender)!
    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      title:      'Restaurer une sauvegarde',
      filters:    [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return { success: false }

    const source = filePaths[0]
    const dbPath = getDbPath()

    try {
      assertLooksLikeStockpilotDb(source)
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }

    try {
      // Filet de sécurité : la base actuelle est mise de côté avant d'être remplacée.
      const rescue = `${dbPath}.avant-restauration`
      await getSqlite().backup(rescue)

      // Fermer AVANT d'écraser : sinon le -wal de l'ancienne base survit et SQLite
      // le réapplique par-dessus la nouvelle au redémarrage (corruption assurée).
      closeDatabase()
      for (const f of sidecars(dbPath)) fs.rmSync(f, { force: true })

      fs.copyFileSync(source, dbPath)
      for (const f of sidecars(dbPath)) fs.rmSync(f, { force: true })
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }

    app.relaunch()
    app.exit(0)
    return { success: true }
  })
}

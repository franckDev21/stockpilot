import type { BrowserWindow } from 'electron'
import { ipcMain, app } from 'electron'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/**
 * Auto-update via GitHub Releases (electron-updater).
 *
 * Flux :
 *  1. Au démarrage (et toutes les 4 h) l'app interroge GitHub Releases.
 *  2. Si une version plus récente existe, elle est téléchargée en arrière-plan.
 *  3. Une fois téléchargée, le renderer est prévenu (toast "Mise à jour prête").
 *  4. L'utilisateur clique "Redémarrer" → l'app s'installe et redémarre.
 *
 * ⚠️ Ne s'active qu'en build packagé produit par electron-builder.
 *    L'import est paresseux + tolérant : si le module n'est pas présent
 *    (ex. build local via scripts/package-mac.sh), l'auto-update est
 *    silencieusement désactivé au lieu de planter l'app.
 */
export function setupAutoUpdate(win: BrowserWindow): void {
  if (!app.isPackaged) return

  let autoUpdater: import('electron-updater').AppUpdater
  try {
    // Lazy require pour ne pas casser les builds qui n'embarquent pas le module
    autoUpdater = require('electron-updater').autoUpdater
  } catch (err) {
    console.warn('electron-updater indisponible — auto-update désactivé:', err)
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  const send = (channel: string, payload?: unknown) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }

  autoUpdater.on('checking-for-update', () => send('update:checking'))
  autoUpdater.on('update-available',    (info) => send('update:available', { version: info.version }))
  autoUpdater.on('update-not-available', () => send('update:none'))
  autoUpdater.on('error',               (err) => send('update:error', { message: String(err) }))
  autoUpdater.on('download-progress',   (p)   => send('update:progress', { percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded',   (info) => send('update:downloaded', { version: info.version }))

  ipcMain.handle('update:install', () => { autoUpdater.quitAndInstall() })

  ipcMain.handle('update:check', async () => {
    try {
      const r = await autoUpdater.checkForUpdates()
      return { ok: true, version: r?.updateInfo.version ?? null }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  setTimeout(() => { autoUpdater.checkForUpdates().catch(() => {}) }, 3000)
  setInterval(() => { autoUpdater.checkForUpdates().catch(() => {}) }, 4 * 60 * 60 * 1000)
}

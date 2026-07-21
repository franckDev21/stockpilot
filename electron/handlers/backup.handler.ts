import { app, dialog } from 'electron'
import type { IpcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

function getDbPath() {
  return path.join(app.getPath('userData'), 'stockpilot.db')
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
    fs.copyFileSync(getDbPath(), filePath)
    return { success: true, path: filePath }
  })

  ipcMain.handle('backup:restore', async (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender)!
    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      title:      'Restaurer une sauvegarde',
      filters:    [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return { success: false }
    fs.copyFileSync(filePaths[0], getDbPath())
    // Restart app to reload the new DB
    app.relaunch()
    app.exit(0)
    return { success: true }
  })
}

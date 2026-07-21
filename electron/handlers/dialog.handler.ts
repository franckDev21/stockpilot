import { dialog, BrowserWindow } from 'electron'
import type { IpcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const MIME: Record<string, string> = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
  gif:  'image/gif',
}

/** Refuse absurdly large files — a base64 blob is ~33% bigger and lands in SQLite. */
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

export function registerDialogHandlers(ipc: IpcMain): void {
  ipc.handle('dialog:pickImage', async (event) => {
    try {
      // Attach the dialog to the calling window, otherwise on macOS it can open
      // detached and end up *behind* the app window (looks like nothing happens).
      const win = BrowserWindow.fromWebContents(event.sender)

      const options: Electron.OpenDialogOptions = {
        title:      'Choisir une photo du produit',
        buttonLabel: 'Choisir',
        filters:    [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }],
        properties: ['openFile'],
      }

      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options)

      if (result.canceled || !result.filePaths[0]) return null

      const filePath = result.filePaths[0]

      const stat = fs.statSync(filePath)
      if (stat.size > MAX_BYTES) {
        if (win) {
          await dialog.showMessageBox(win, {
            type:    'warning',
            title:   'Image trop volumineuse',
            message: 'Cette image dépasse 8 Mo.',
            detail:  'Choisissez une image plus légère (compressée ou redimensionnée).',
          })
        }
        return null
      }

      const ext  = path.extname(filePath).slice(1).toLowerCase()
      const mime = MIME[ext] ?? 'image/jpeg'
      const data = fs.readFileSync(filePath)

      return `data:${mime};base64,${data.toString('base64')}`
    } catch (err) {
      console.error('dialog:pickImage error:', err)
      return null
    }
  })
}

import { BrowserWindow, dialog, app } from 'electron'
import type { IpcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export function registerPrintHandlers(ipcMain: IpcMain) {
  ipcMain.handle('print:toPDF', async (event, options: { filename?: string } = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender)!
    try {
      const data = await win.webContents.printToPDF({
        printBackground: true,
        pageSize:        'A4',
        landscape:       false,
        margins:         { top: 1, bottom: 1, left: 1, right: 1 },
      })
      const { filePath, canceled } = await dialog.showSaveDialog(win, {
        title:       'Enregistrer le PDF',
        defaultPath: path.join(app.getPath('downloads'), options.filename ?? 'export.pdf'),
        filters:     [{ name: 'PDF', extensions: ['pdf'] }],
      })
      if (canceled || !filePath) return { success: false }
      fs.writeFileSync(filePath, data)
      return { success: true, path: filePath }
    } catch (err) {
      console.error('printToPDF error:', err)
      return { success: false }
    }
  })
}

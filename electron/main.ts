import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { initDatabase } from './db/index'
import { registerWarehouseHandlers }     from './handlers/warehouses.handler'
import { registerProductHandlers }       from './handlers/products.handler'
import { registerSupplierHandlers }      from './handlers/suppliers.handler'
import { registerCustomerHandlers }      from './handlers/customers.handler'
import { registerPurchaseOrderHandlers } from './handlers/purchase-orders.handler'
import { registerReceptionHandlers }     from './handlers/receptions.handler'
import { registerTransferHandlers }      from './handlers/transfers.handler'
import { registerSaleHandlers }          from './handlers/sales.handler'
import { registerStockHandlers }         from './handlers/stock.handler'
import { registerStatsHandlers }         from './handlers/stats.handler'
import { registerDialogHandlers }        from './handlers/dialog.handler'
import { registerSeedHandlers }          from './handlers/seed.handler'
import { registerBackupHandlers }        from './handlers/backup.handler'
import { registerPrintHandlers }         from './handlers/print.handler'
import { registerAuthHandlers }          from './handlers/auth.handler'
import { setupAutoUpdate }                from './updater'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST           = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST       = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null = null

function registerAllHandlers(): void {
  registerWarehouseHandlers(ipcMain)
  registerProductHandlers(ipcMain)
  registerSupplierHandlers(ipcMain)
  registerCustomerHandlers(ipcMain)
  registerPurchaseOrderHandlers(ipcMain)
  registerReceptionHandlers(ipcMain)
  registerTransferHandlers(ipcMain)
  registerSaleHandlers(ipcMain)
  registerStockHandlers(ipcMain)
  registerStatsHandlers(ipcMain)
  registerDialogHandlers(ipcMain)
  registerSeedHandlers(ipcMain)
  registerBackupHandlers(ipcMain)
  registerPrintHandlers(ipcMain)
  registerAuthHandlers(ipcMain)
}

function createWindow(): void {
  win = new BrowserWindow({
    width:     1400,
    height:    900,
    minWidth:  1024,
    minHeight: 700,
    titleBarStyle:   'hiddenInset',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // Auto-update (no-op en développement)
  setupAutoUpdate(win)
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.whenReady().then(() => {
  initDatabase()
  registerAllHandlers()
  createWindow()
})

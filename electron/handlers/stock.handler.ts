import type { IpcMain } from 'electron'
import { StockService } from '../services/stock.service'

const service = new StockService()

export function registerStockHandlers(ipc: IpcMain): void {
  ipc.handle('stock:getCurrent',   (_e, warehouseId?: string)              => service.getCurrent(warehouseId))
  ipc.handle('stock:getMovements', (_e, productId: string, warehouseId?: string) => service.getMovements(productId, warehouseId))
  ipc.handle('stock:getLowStock',  ()                                       => service.getLowStock())
}

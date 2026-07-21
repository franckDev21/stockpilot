import type { IpcMain } from 'electron'
import { ProductService } from '../services/product.service'

const service = new ProductService()

export function registerProductHandlers(ipc: IpcMain): void {
  ipc.handle('products:getAll',   ()                      => service.getAll())
  ipc.handle('products:getById',  (_e, id: string)        => service.getById(id))
  ipc.handle('products:create',   (_e, data)              => service.create(data))
  ipc.handle('products:update',   (_e, id: string, data)  => service.update(id, data))
  ipc.handle('products:delete',   (_e, id: string)        => service.delete(id))
  ipc.handle('products:getStock',       (_e, warehouseId?: string) => service.getStock(warehouseId))
  ipc.handle('products:getCartonStats', (_e, id: string)           => service.getCartonStats(id))
}

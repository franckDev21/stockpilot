import type { IpcMain } from 'electron'
import { SupplierService } from '../services/supplier.service'

const service = new SupplierService()

export function registerSupplierHandlers(ipc: IpcMain): void {
  ipc.handle('suppliers:getAll',  ()                      => service.getAll())
  ipc.handle('suppliers:getById', (_e, id: string)        => service.getById(id))
  ipc.handle('suppliers:create',  (_e, data)              => service.create(data))
  ipc.handle('suppliers:update',  (_e, id: string, data)  => service.update(id, data))
  ipc.handle('suppliers:delete',  (_e, id: string)        => service.delete(id))
}

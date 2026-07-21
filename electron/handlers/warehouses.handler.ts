import type { IpcMain } from 'electron'
import { WarehouseService } from '../services/warehouse.service'

const service = new WarehouseService()

export function registerWarehouseHandlers(ipc: IpcMain): void {
  ipc.handle('warehouses:getAll',    ()                      => service.getAll())
  ipc.handle('warehouses:create',    (_e, data)              => service.create(data))
  ipc.handle('warehouses:update',    (_e, id: string, data)  => service.update(id, data))
  ipc.handle('warehouses:delete',    (_e, id: string)        => service.delete(id))
}

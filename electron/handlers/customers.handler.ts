import type { IpcMain } from 'electron'
import { CustomerService } from '../services/customer.service'

const service = new CustomerService()

export function registerCustomerHandlers(ipc: IpcMain): void {
  ipc.handle('customers:getAll',    ()                      => service.getAll())
  ipc.handle('customers:getById',   (_e, id: string)        => service.getById(id))
  ipc.handle('customers:create',    (_e, data)              => service.create(data))
  ipc.handle('customers:update',    (_e, id: string, data)  => service.update(id, data))
  ipc.handle('customers:delete',    (_e, id: string)        => service.delete(id))
  ipc.handle('customers:getBalance',(_e, id: string)        => service.getBalance(id))
}

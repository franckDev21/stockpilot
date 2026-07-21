import type { IpcMain } from 'electron'
import { SaleService } from '../services/sale.service'

const service = new SaleService()

export function registerSaleHandlers(ipc: IpcMain): void {
  ipc.handle('sales:getAll',    ()                             => service.getAll())
  ipc.handle('sales:getById',   (_e, id: string)               => service.getById(id))
  ipc.handle('sales:create',    (_e, data)                     => service.create(data))
  ipc.handle('sales:delete',    (_e, id: string)               => service.delete(id))
  ipc.handle('sales:addPayment',(_e, saleId: string, data)     => service.addPayment(saleId, data))
}

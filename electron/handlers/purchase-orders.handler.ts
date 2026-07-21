import type { IpcMain } from 'electron'
import { PurchaseOrderService } from '../services/purchase-order.service'

const service = new PurchaseOrderService()

export function registerPurchaseOrderHandlers(ipc: IpcMain): void {
  ipc.handle('purchaseOrders:getAll',         ()                      => service.getAll())
  ipc.handle('purchaseOrders:getAllEnriched', ()                      => service.getAllEnriched())
  ipc.handle('purchaseOrders:getById',       (_e, id: string)        => service.getById(id))
  ipc.handle('purchaseOrders:create',        (_e, data)              => service.create(data))
  ipc.handle('purchaseOrders:update',        (_e, id: string, data)  => service.update(id, data))
  ipc.handle('purchaseOrders:delete',        (_e, id: string)        => service.delete(id))
  ipc.handle('purchaseOrders:addPayment',     (_e, orderId, data)     => service.addPayment(orderId, data))
  ipc.handle('purchaseOrders:deletePayment',  (_e, paymentId: string) => service.deletePayment(paymentId))
  ipc.handle('purchaseOrders:simulateProfit',(_e, data)              => service.simulateProfit(data))
}

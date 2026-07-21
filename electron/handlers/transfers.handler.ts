import type { IpcMain } from 'electron'
import { TransferService } from '../services/transfer.service'

const service = new TransferService()

export function registerTransferHandlers(ipc: IpcMain): void {
  ipc.handle('transfers:getAll',  ()               => service.getAll())
  ipc.handle('transfers:getById', (_e, id: string) => service.getById(id))
  ipc.handle('transfers:create',  (_e, data)       => service.create(data))
}

import type { IpcMain } from 'electron'
import { ReceptionService } from '../services/reception.service'

const service = new ReceptionService()

export function registerReceptionHandlers(ipc: IpcMain): void {
  ipc.handle('receptions:getAll',         ()              => service.getAll())
  ipc.handle('receptions:getEnrichedList',()              => service.getEnrichedList())
  ipc.handle('receptions:getById',        (_e, id: string) => service.getById(id))
  ipc.handle('receptions:create',         (_e, data)       => service.create(data))
  ipc.handle('receptions:update',         (_e, id: string, data) => service.update(id, data))
}

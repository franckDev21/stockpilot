import type { IpcMain } from 'electron'
import { SeedService } from '../services/seed.service'

const service = new SeedService()

export function registerSeedHandlers(ipc: IpcMain): void {
  ipc.handle('seed:demo',     () => service.seed())
  ipc.handle('seed:isSeeded', () => service.isSeeded())
  ipc.handle('seed:reset',    () => { service.clearAll(); return { success: true } })
}

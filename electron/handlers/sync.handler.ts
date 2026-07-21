import type { IpcMain } from 'electron'
import { runSync, getStatus, configure, logoutFromApi, getCurrentConfig, type SyncSummary, type SyncStatus } from '../services/sync.service'
import { getDevDefaults } from '../services/sync-config.service'

export function registerSyncHandlers(ipc: IpcMain): void {
  ipc.handle('sync:now', (): Promise<SyncSummary> => runSync())

  ipc.handle('sync:getStatus', (): Promise<SyncStatus> => getStatus())

  ipc.handle('sync:configure', (_e, data: { apiUrl: string; email: string; password: string }) => configure(data))

  ipc.handle('sync:getConfig', () => getCurrentConfig())

  ipc.handle('sync:getDevDefaults', () => getDevDefaults())

  ipc.handle('sync:logout', () => {
    logoutFromApi()
    return { success: true }
  })
}

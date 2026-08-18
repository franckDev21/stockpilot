import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { getStatus, configure, logoutFromApi, getCurrentConfig, type SyncSummary, type SyncStatus } from '../services/sync.service'
import { getDevDefaults } from '../services/sync-config.service'
import { infosPush, pushAllData, pullAllData, syncMaintenant, type PushSummary, type PullSummary } from '../services/poste-sync.service'

export function registerSyncHandlers(ipc: IpcMain): void {
  // syncMaintenant() et pas runSync() : sur un poste jamais connecte, la synchro
  // classique sortait aussitot sur « not_configured ». Elle passe desormais par
  // les points d'entree en bloc avec le jeton embarque — plus rien a saisir.
  ipc.handle('sync:now', (event): Promise<SyncSummary> => syncMaintenant({
    onProgress: (p) => {
      if (!event.sender.isDestroyed()) event.sender.send('sync:pushProgress', p)
    },
  }))

  ipc.handle('sync:getStatus', (): Promise<SyncStatus> => getStatus())

  ipc.handle('sync:configure', (_e, data: { apiUrl: string; email: string; password: string }) => configure(data))

  ipc.handle('sync:getConfig', () => getCurrentConfig())

  ipc.handle('sync:getDevDefaults', () => getDevDefaults())

  // « Envoyer mes données au serveur » — envoi complet, sans rien lire ni écrire
  // sur ce poste. La progression est renvoyée au fil de l'eau : l'envoi d'une
  // grosse base dure plusieurs minutes, et un écran figé passe pour un plantage.
  ipc.handle('sync:pushInfo', () => infosPush())

  ipc.handle('sync:pushAll', async (
    event: IpcMainInvokeEvent,
    data?: { credentials?: { apiUrl: string; email: string; password: string } },
  ): Promise<PushSummary> => pushAllData({
    credentials: data?.credentials,
    onProgress:  (p) => {
      if (!event.sender.isDestroyed()) event.sender.send('sync:pushProgress', p)
    },
  }))

  ipc.handle('sync:pullAll', async (
    event: IpcMainInvokeEvent,
    data?: { credentials?: { apiUrl: string; email: string; password: string } },
  ): Promise<PullSummary> => pullAllData({
    credentials: data?.credentials,
    onProgress:  (p) => {
      if (!event.sender.isDestroyed()) event.sender.send('sync:pushProgress', p)
    },
  }))

  ipc.handle('sync:logout', () => {
    logoutFromApi()
    return { success: true }
  })
}

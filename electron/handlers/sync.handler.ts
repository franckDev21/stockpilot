import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { getStatus, configure, logoutFromApi, getCurrentConfig, type SyncSummary, type SyncStatus } from '../services/sync.service'
import { getDevDefaults } from '../services/sync-config.service'
import { appliquerSuppressions, infosPush, pushAllData, pullAllData, suppressionsEnAttente, syncMaintenant, verifierSynchronisation, type PushSummary, type PullSummary, type RapportVerification } from '../services/poste-sync.service'

export function registerSyncHandlers(ipc: IpcMain): void {
  // syncMaintenant() et pas runSync() : sur un poste jamais connecte, la synchro
  // classique sortait aussitot sur « not_configured ». Elle passe desormais par
  // les points d'entree en bloc avec le jeton embarque — plus rien a saisir.
  //
  // `complet: true` : le bouton renvoie TOUT, la synchro automatique (main.ts)
  // reste incrementale. Un clic est donc une remise a niveau complete du poste
  // — c'est ce que l'utilisateur attend de « Synchroniser », et c'est ce qui
  // autorise le pull a lever les suppressions locales que le serveur ne
  // confirme pas.
  ipc.handle('sync:now', (event): Promise<SyncSummary> => syncMaintenant({
    complet: true,
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

  // Les suppressions ne partent JAMAIS toutes seules : la synchro rétablit ce
  // que le serveur a de vivant, et c'est ce bouton — et lui seul — qui supprime
  // pour de bon, ici et là-bas. Sans lui, plus rien ne serait supprimable ; avec
  // lui, plus rien ne se supprime par accident.
  ipc.handle('sync:pendingDeletions', () => suppressionsEnAttente())
  ipc.handle('sync:applyDeletions', () => appliquerSuppressions())

  // « Vérifier la synchronisation » : ni envoi ni récupération, une comparaison.
  // C'est la seule commande qui répond à « qu'est-ce qui MANQUE ? » — les deux
  // autres ne disent que ce qu'elles viennent de faire.
  ipc.handle('sync:verify', (): Promise<RapportVerification> => verifierSynchronisation())

  ipc.handle('sync:logout', () => {
    logoutFromApi()
    return { success: true }
  })
}

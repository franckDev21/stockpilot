import { useEffect, useState, useCallback, useRef } from 'react'
import { Cloud, CloudOff, RefreshCw, Settings2, Loader2, X, ClipboardCheck } from 'lucide-react'
import { useAppStore } from '@/store/app.store'

// ─── Indicateur de synchronisation + panneau de configuration ────────────────
// Toute la logique métier (login API, push/pull) vit côté main process
// (electron/services/sync.service.ts) — ce composant ne fait qu'appeler
// window.api.sync.* et afficher le résultat.

function formatRelative(iso: string | null): string {
  if (!iso) return 'jamais'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffD = Math.round(diffH / 24)
  return `il y a ${diffD} j`
}

// Une suppression rétablie doit se lire en français, pas en noms de tables.
const LIBELLES_ENTITES: Record<string, string> = {
  purchase_orders: 'commande(s)',
  products:        'produit(s)',
  suppliers:       'fournisseur(s)',
  customers:       'client(s)',
  warehouses:      'entrepôt(s)',
  sales:           'vente(s)',
}

function resumerEntites(lignes: Array<{ entite: string }>): string {
  const parEntite = new Map<string, number>()
  for (const ligne of lignes) parEntite.set(ligne.entite, (parEntite.get(ligne.entite) ?? 0) + 1)
  return [...parEntite].map(([e, n]) => `${n} ${LIBELLES_ENTITES[e] ?? e}`).join(', ')
}

export function SyncStatus() {
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSummary, setLastSummary] = useState<SyncSummary | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  // null = ce poste n'a jamais été connecté : il se synchronise avec le jeton
  // embarqué dans l'application, sans identifiants. Il faut le dire, sinon on
  // croit qu'il reste quelque chose à configurer.
  const [compte, setCompte] = useState<{ email: string } | null>(null)
  // « Vérifier » ne synchronise rien : il compare ce poste au serveur et dit ce
  // qui manque de chaque côté. Sans ça, un tableau incomplet ne se voyait qu'à
  // l'œil, en comparant deux écrans côte à côte.
  const [verifying, setVerifying] = useState(false)
  const [rapport, setRapport] = useState<RapportVerification | null>(null)
  // Ce que la synchro a rétabli : des lignes supprimées ici que le serveur avait
  // toujours. Tant que l'utilisateur n'a pas tranché, elles reviennent à chaque
  // synchro — il faut donc lui montrer, et lui laisser dire « non, supprimez ».
  const [aSupprimer, setASupprimer] = useState<Array<{ entite: string; id: string }>>([])
  const [suppression, setSuppression] = useState(false)

  const rafraichirSuppressions = useCallback(async () => {
    try {
      setASupprimer(await window.api.sync.pendingDeletions())
    } catch {
      // sans conséquence : le bloc reste simplement masqué
    }
  }, [])

  // Le pendant du bouton rouge : fermer l'avertissement sans rien détruire. Un
  // bandeau qu'on ne peut pas faire disparaître finit toujours par être cliqué.
  const handleGarder = async () => {
    if (suppression) return
    setSuppression(true)
    try {
      await window.api.sync.dismissDeletions()
      await rafraichirSuppressions()
    } finally {
      setSuppression(false)
    }
  }

  const handleSupprimerPartout = async () => {
    if (suppression) return
    if (!window.confirm(
      `Supprimer définitivement ${aSupprimer.length} ligne(s) ici ET sur le serveur ?\n\n`
      + 'Elles disparaîtront aussi de l\'autre poste à sa prochaine synchronisation. '
      + 'Cette action ne peut pas être annulée depuis l\'application.',
    )) return
    setSuppression(true)
    try {
      const res = await window.api.sync.applyDeletions()
      await rafraichirSuppressions()
      triggerRefresh()
      if (!res.success) {
        window.alert(res.message ?? `${res.rejected.length} ligne(s) refusée(s) par le serveur.`)
      }
    } finally {
      setSuppression(false)
    }
  }

  const handleVerify = async () => {
    if (verifying) return
    setVerifying(true)
    try {
      setRapport(await window.api.sync.verify())
    } catch (e) {
      setRapport({
        success: false, identique: false, ecarts: [], durationMs: 0,
        message: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setVerifying(false)
    }
  }

  const refreshStatus = useCallback(() => {
    window.api.sync.getStatus().then(setStatus).catch(() => {})
  }, [])

  useEffect(() => {
    refreshStatus()
    const id = setInterval(refreshStatus, 20000)
    return () => clearInterval(id)
  }, [refreshStatus])

  useEffect(() => {
    window.api.sync.getConfig().then((cfg) => setCompte(cfg ? { email: cfg.email } : null)).catch(() => {})
    void rafraichirSuppressions()
  }, [open, rafraichirSuppressions])

  const handleSyncNow = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const summary = await window.api.sync.now()
      setLastSummary(summary)
      if (summary.pulled > 0) triggerRefresh()
      await refreshStatus()
      await rafraichirSuppressions()
    } catch {
      // silencieux — window.api.sync.now() ne devrait jamais rejeter, filet de sécurité
    } finally {
      setSyncing(false)
    }
  }

  let icon = <CloudOff className="w-3.5 h-3.5" />
  let label = 'Non configuré'
  let colorClass = 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600'

  if (status?.configured) {
    if (!status.online) {
      icon = <CloudOff className="w-3.5 h-3.5" />
      label = 'Hors ligne'
      colorClass = 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400'
    } else if (status.pending > 0) {
      icon = <Cloud className="w-3.5 h-3.5" />
      label = `${status.pending} en attente`
      colorClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/50 dark:text-amber-400'
    } else {
      icon = <Cloud className="w-3.5 h-3.5" />
      label = 'Synchronisé'
      colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900/50 dark:text-emerald-400'
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Synchronisation avec l'API"
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${colorClass}`}
      >
        {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
        {syncing ? 'Synchro…' : label}
      </button>

      {open && (
        <div className="fixed top-14 right-4 z-50 w-80 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-card-lg animate-fade-up">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Synchronisation</span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {status?.configured ? (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Dernière synchro : <span className="font-semibold text-slate-700 dark:text-slate-300">{formatRelative(status.lastSyncedAt)}</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  État réseau : <span className="font-semibold text-slate-700 dark:text-slate-300">{status.online ? 'en ligne' : 'hors ligne'}</span>
                </p>
                {compte === null && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Ce poste se synchronise automatiquement avec le serveur, sans identifiants.
                  </p>
                )}
                {aSupprimer.length > 0 && (
                  /* Une suppression faite ici ne part plus toute seule au serveur :
                     impossible pour la machine de distinguer « cette commande
                     n'existe plus » de « je vide pour recharger », et le second
                     cas a détruit 24 commandes le 19/08. La synchro rétablit
                     donc la ligne, et c'est ici que l'utilisateur peut dire
                     l'inverse — une fois, explicitement. */
                  <div className="text-xs rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900/50 p-2.5 space-y-2">
                    <p className="font-semibold text-amber-800 dark:text-amber-300">
                      {resumerEntites(aSupprimer)} rétablie(s) depuis le serveur
                    </p>
                    <p className="text-amber-700 dark:text-amber-400 leading-relaxed">
                      Vous les aviez supprimées ici, mais elles existent toujours sur le serveur :
                      la synchronisation les a remises. Pour les supprimer vraiment — ici, sur le
                      serveur et sur l'autre poste —, dites-le explicitement.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleGarder}
                        disabled={suppression}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-60"
                      >
                        Les garder
                      </button>
                      <button
                        onClick={handleSupprimerPartout}
                        disabled={suppression}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold"
                      >
                        {suppression ? 'Suppression…' : 'Supprimer partout'}
                      </button>
                    </div>
                  </div>
                )}
                {lastSummary && (
                  <div className="text-xs rounded-lg bg-slate-50 dark:bg-slate-700/50 p-2.5 space-y-1">
                    <p className="text-slate-600 dark:text-slate-300">
                      {lastSummary.pushed} envoyé(s), {lastSummary.pulled} reçu(s)
                    </p>
                    {(lastSummary.retablis ?? 0) > 0 && (
                      /* Une ligne supprimée ici mais vivante sur le serveur ne
                         revenait jamais : la suppression étant plus récente,
                         elle gagnait l'arbitrage à chaque synchro. On la lève
                         désormais, et on le dit — sinon des lignes
                         réapparaissent sans que personne comprenne pourquoi. */
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {lastSummary.retablis} ligne(s) rétablie(s) depuis le serveur
                      </p>
                    )}
                    {lastSummary.errors.length > 0 && (
                      /* « N erreur(s) — voir logs » ne disait rien à personne :
                         une ligne que la synchro n'a pas pu écrire disparaissait
                         en silence, et on croyait le poste à jour. On montre
                         maintenant ce qui a été refusé, ici, en clair. */
                      <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-600">
                        <p className="font-semibold text-red-500">
                          {lastSummary.errors.length} ligne(s) non appliquée(s) sur ce poste
                        </p>
                        <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                          {lastSummary.errors.slice(0, 8).map((err, i) => (
                            <li key={i} className="text-[11px] text-red-500/90 break-words leading-snug">
                              {err}
                            </li>
                          ))}
                        </ul>
                        {lastSummary.errors.length > 8 && (
                          <p className="text-[11px] text-slate-400">
                            … et {lastSummary.errors.length - 8} autre(s).
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg
                             bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-60"
                >
                  {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Synchroniser maintenant
                </button>
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg
                             border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300
                             hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
                >
                  {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                  Vérifier la synchronisation
                </button>

                {rapport && (
                  <div className="text-xs rounded-lg bg-slate-50 dark:bg-slate-700/50 p-2.5 space-y-2">
                    {!rapport.success ? (
                      <p className="text-red-500">Vérification impossible : {rapport.message}</p>
                    ) : rapport.identique ? (
                      <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        Ce poste et le serveur disent exactement la même chose.
                      </p>
                    ) : (
                      <>
                        <p className="font-semibold text-amber-600 dark:text-amber-400">
                          {rapport.ecarts.length} écart(s) entre ce poste et le serveur
                        </p>
                        <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                          {rapport.ecarts.map((e) => (
                            <li key={e.entite} className="leading-snug">
                              <span className="font-semibold text-slate-700 dark:text-slate-200">{e.label}</span>
                              <span className="text-slate-500 dark:text-slate-400"> — ici {e.local}, serveur {e.serveur}</span>
                              {e.manquantesIci.length > 0 && (
                                <span className="block text-amber-600 dark:text-amber-400">
                                  {e.manquantesIci.length} absente(s) de ce poste → « Synchroniser maintenant »
                                </span>
                              )}
                              {e.manquantesLaBas.length > 0 && (
                                <span className="block text-amber-600 dark:text-amber-400">
                                  {e.manquantesLaBas.length} pas encore sur le serveur → « Envoyer au serveur »
                                </span>
                              )}
                              {e.detailDifferent.length > 0 && (
                                <span className="block text-red-500">
                                  {e.detailDifferent.length} avec un détail différent
                                  {e.detailDifferent[0] && (
                                    <span className="block text-[11px] text-red-500/80">
                                      ex. ici {e.detailDifferent[0].ici || 'rien'} / serveur {e.detailDifferent[0].serveur || 'rien'}
                                    </span>
                                  )}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setShowConfig((v) => !v)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg
                             text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Reconfigurer la connexion API
                </button>
              </>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                La synchronisation avec le serveur en ligne n'est pas encore configurée. Vos données restent 100% disponibles hors-ligne.
              </p>
            )}

            {(!status?.configured || showConfig) && <SyncConfigForm onConfigured={() => { setShowConfig(false); refreshStatus() }} />}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Formulaire de configuration (URL API + identifiants) ────────────────────

function SyncConfigForm({ onConfigured }: { onConfigured: () => void }) {
  const [apiUrl, setApiUrl]     = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const prefilled = useRef(false)

  useEffect(() => {
    if (prefilled.current) return
    prefilled.current = true
    Promise.all([window.api.sync.getConfig(), window.api.sync.getDevDefaults()])
      .then(([cfg, defaults]) => {
        setApiUrl(cfg?.apiUrl || defaults.apiUrl)
        setEmail(cfg?.email || defaults.email)
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await window.api.sync.configure({ apiUrl, email, password })
      if (res.success) {
        setPassword('')
        onConfigured()
      } else {
        setError(res.message ?? 'Échec de connexion.')
      }
    } catch {
      setError('Erreur inattendue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-2">
      <input
        type="text"
        placeholder="URL de l'API (ex: https://stockpilot.feujio.com)"
        value={apiUrl}
        onChange={(e) => setApiUrl(e.target.value)}
        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
        required
      />
      <input
        type="password"
        placeholder="Mot de passe"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
        required
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg
                   bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        Se connecter à l'API
      </button>
    </form>
  )
}

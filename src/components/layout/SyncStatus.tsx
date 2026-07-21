import { useEffect, useState, useCallback, useRef } from 'react'
import { Cloud, CloudOff, RefreshCw, Settings2, Loader2, X } from 'lucide-react'
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

export function SyncStatus() {
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSummary, setLastSummary] = useState<SyncSummary | null>(null)
  const [showConfig, setShowConfig] = useState(false)

  const refreshStatus = useCallback(() => {
    window.api.sync.getStatus().then(setStatus).catch(() => {})
  }, [])

  useEffect(() => {
    refreshStatus()
    const id = setInterval(refreshStatus, 20000)
    return () => clearInterval(id)
  }, [refreshStatus])

  const handleSyncNow = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const summary = await window.api.sync.now()
      setLastSummary(summary)
      if (summary.pulled > 0) triggerRefresh()
      await refreshStatus()
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
                {lastSummary && (
                  <div className="text-xs rounded-lg bg-slate-50 dark:bg-slate-700/50 p-2.5 space-y-1">
                    <p className="text-slate-600 dark:text-slate-300">
                      {lastSummary.pushed} envoyé(s), {lastSummary.pulled} reçu(s)
                    </p>
                    {lastSummary.errors.length > 0 && (
                      <p className="text-red-500">{lastSummary.errors.length} erreur(s) — voir logs</p>
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

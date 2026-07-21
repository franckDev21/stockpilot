import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'

type UpdateState =
  | { kind: 'idle' }
  | { kind: 'downloading'; percent: number }
  | { kind: 'ready'; version: string }

export function UpdateToast() {
  const [state, setState] = useState<UpdateState>({ kind: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const offAvailable = window.api.update.on('update:available', () =>
      setState({ kind: 'downloading', percent: 0 }),
    )
    const offProgress = window.api.update.on('update:progress', (p) =>
      setState({ kind: 'downloading', percent: (p as { percent: number }).percent }),
    )
    const offDownloaded = window.api.update.on('update:downloaded', (info) => {
      setState({ kind: 'ready', version: (info as { version: string }).version })
      setDismissed(false)
    })
    return () => { offAvailable(); offProgress(); offDownloaded() }
  }, [])

  if (dismissed || state.kind === 'idle') return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-80 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-card-lg animate-fade-up overflow-hidden">
      {state.kind === 'downloading' ? (
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Download className="w-4 h-4 text-primary-500 animate-pulse" />
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Mise à jour en cours…</span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${state.percent}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 tabular-nums">{state.percent}% téléchargé</p>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Mise à jour prête</p>
                <p className="text-[11px] text-slate-400">Version {state.version} téléchargée</p>
              </div>
            </div>
            <button onClick={() => setDismissed(true)} className="text-slate-400 hover:text-slate-600 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => window.api.update.install()}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Redémarrer et installer
          </button>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect }  from 'react'
import { Package, ArrowLeft, Sparkles, Loader2, AlertTriangle, Download, UploadCloud, CheckCircle2, FileText, Moon, Sun, LogOut, Trash2, Server } from 'lucide-react'
import { useAppStore }           from '@/store/app.store'
import { useAuthStore }          from '@/store/auth-store'
import { usePrint }              from '@/hooks/usePrint'
import { useDarkMode }           from '@/hooks/useDarkMode'
import { formatDate }            from '@/lib/utils'
import { SyncStatus }            from './SyncStatus'
import { SendDatabaseModal }     from './SendDatabaseModal'
import { SendDataModal }         from './SendDataModal'

interface LowStockItem { productId: string; productName: string; reference: string; totalPairs: number; threshold: number }

function useLowStock() {
  const [items, setItems] = useState<LowStockItem[]>([])
  const dataVersion       = useAppStore((s) => s.dataVersion)
  useEffect(() => {
    window.api.stock.getLowStock()
      .then((d) => setItems(d as LowStockItem[]))
      .catch(() => {})
  }, [dataVersion])
  return items
}

export function Header() {
  const { detailPage, closeDetail, triggerRefresh } = useAppStore()
  const logout = useAuthStore((s) => s.logout)
  const today     = formatDate(new Date().toISOString())
  const lowItems  = useLowStock()

  const [seeding,       setSeeding]       = useState(false)
  const [seedResult,    setSeedResult]    = useState<{ inserted: number } | null>(null)
  const [backing,       setBacking]       = useState(false)
  const [backupMsg,     setBackupMsg]     = useState<string | null>(null)
  const [showLowStock,  setShowLowStock]  = useState(false)
  const { print, printing }              = usePrint()
  const { dark, toggle: toggleDark }    = useDarkMode()

  const handleSeed = async () => {
    if (seeding) return
    setSeeding(true)
    setSeedResult(null)
    try {
      const result = await window.api.seed.demo()
      setSeedResult(result)
      triggerRefresh()
      setTimeout(() => setSeedResult(null), 5000)
    } catch (e) {
      console.error(e)
    } finally {
      setSeeding(false)
    }
  }

  const [showSend, setShowSend] = useState(false)
  const [showSendData, setShowSendData] = useState(false)

  const handleBackup = async () => {
    setBacking(true)
    try {
      const res = await window.api.backup.save()
      if (res.success) {
        setBackupMsg('Sauvegarde créée !')
        setTimeout(() => setBackupMsg(null), 3000)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setBacking(false)
    }
  }

  const handleRestore = async () => {
    const ok = window.confirm('Restaurer une sauvegarde ? L\'application redémarrera automatiquement.')
    if (!ok) return
    await window.api.backup.restore()
  }

  const handleReset = async () => {
    const ok = window.confirm(
      '⚠️ Supprimer TOUTES les données ?\n\nCommandes, paiements, produits, fournisseurs, clients, boutiques, arrivages et stock seront définitivement effacés.\n\nCette action est irréversible.',
    )
    if (!ok) return
    await window.api.seed.reset()
    triggerRefresh()
  }

  if (detailPage) {
    return (
      <header className="h-14 bg-white dark:bg-slate-800 border-b border-slate-200/70 dark:border-slate-700 flex items-center px-6 gap-4 shrink-0 z-10">
        <button
          onClick={closeDetail}
          className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">{detailPage.type}</span>
      </header>
    )
  }

  return (
    <>
      <header className="h-14 bg-white dark:bg-slate-800 border-b border-slate-200/70 dark:border-slate-700 flex items-center justify-between px-6 shrink-0 z-10">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-sm">
            <Package className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-slate-100 tracking-tight text-sm">StockPilot</span>
            <span className="ml-2 text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Gestion stock chaussures
            </span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">

          {/* Synchronisation avec l'API en ligne */}
          <SyncStatus />

          {/* Low stock alert badge */}
          {lowItems.length > 0 && (
            <button
              onClick={() => setShowLowStock((v) => !v)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                         bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {lowItems.length} alerte{lowItems.length > 1 ? 's' : ''} stock
            </button>
          )}

          {/* PDF export */}
          <button
            onClick={() => print(`stockpilot-${new Date().toISOString().slice(0, 10)}.pdf`)}
            disabled={printing}
            title="Exporter en PDF"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                       bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300
                       border border-slate-200 dark:border-slate-600
                       hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors disabled:opacity-60"
          >
            {printing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Exporter PDF
          </button>

          {/* Backup */}
          <button
            onClick={handleBackup}
            disabled={backing}
            title="Sauvegarder la base de données"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                       bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300
                       border border-slate-200 dark:border-slate-600
                       hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors disabled:opacity-60"
          >
            {backing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {backupMsg ?? 'Sauvegarder'}
          </button>

          {/* Restore */}
          <button
            onClick={handleRestore}
            title="Restaurer une sauvegarde"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                       bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300
                       border border-slate-200 dark:border-slate-600
                       hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Restaurer
          </button>

          {/* Envoi des données de ce poste vers le serveur (réunion de plusieurs postes).
              L'envoi du FICHIER de base reste accessible depuis la même fenêtre. */}
          <button
            onClick={() => setShowSendData(true)}
            title="Envoyer les données de ce poste au serveur"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                       bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300
                       border border-slate-200 dark:border-slate-600
                       hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
          >
            <Server className="w-3.5 h-3.5" />
            Envoyer au serveur
          </button>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

          {/* Demo seed button */}
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                       bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30
                       text-primary-700 dark:text-primary-400
                       border border-primary-200/60 dark:border-primary-700/40
                       hover:border-primary-300 hover:from-purple-100 hover:to-indigo-100
                       dark:hover:from-purple-900/50 dark:hover:to-indigo-900/50
                       transition-all duration-150 disabled:opacity-60"
          >
            {seeding
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : seedResult
              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              : <Sparkles className="w-3.5 h-3.5" />
            }
            {seeding
              ? 'Chargement…'
              : seedResult
              ? `${seedResult.inserted} entrées insérées`
              : 'Données démo'
            }
          </button>

          {/* Reset / clear all data */}
          <button
            onClick={handleReset}
            title="Supprimer toutes les données (pour repartir à zéro)"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                       bg-red-50 text-red-600 border border-red-200
                       hover:bg-red-100 transition-colors dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Réinitialiser
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            title={dark ? 'Mode clair' : 'Mode sombre'}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{today}</span>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

          {/* Logout */}
          <button
            onClick={() => {
              if (window.confirm('Se déconnecter de StockPilot ?')) logout()
            }}
            title="Se déconnecter"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                       text-red-500 border border-red-200 dark:border-red-900/50
                       hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>
      </header>

      {/* Low stock dropdown */}
      {showLowStock && lowItems.length > 0 && (
        <div className="fixed top-14 right-4 z-50 w-80 bg-white dark:bg-slate-800 rounded-2xl border border-amber-200 dark:border-amber-800/50 shadow-card-lg animate-fade-up">
          <div className="px-4 py-3 border-b border-amber-100 dark:border-amber-800/30 flex items-center justify-between">
            <span className="text-sm font-bold text-amber-700 dark:text-amber-400">Alertes stock bas</span>
            <button onClick={() => setShowLowStock(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
          </div>
          <ul className="divide-y divide-slate-50 dark:divide-slate-700 max-h-72 overflow-y-auto">
            {lowItems.map((item) => (
              <li key={item.productId} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.productName}</p>
                  <p className="text-xs text-slate-400">{item.reference}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{item.totalPairs} paires</p>
                  <p className="text-xs text-slate-400">seuil: {item.threshold}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {showSendData && (
        <SendDataModal
          onClose={() => setShowSendData(false)}
          onSendFile={() => { setShowSendData(false); setShowSend(true) }}
        />
      )}
      {showSend && <SendDatabaseModal onClose={() => setShowSend(false)} />}
    </>
  )
}

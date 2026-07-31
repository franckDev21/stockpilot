import { useEffect, useState } from 'react'
import { History, Printer, Loader2, ChevronsRight, ChevronsLeft, ChevronDown } from 'lucide-react'
import { useAppStore } from '@/store/app.store'
import { formatFcfa, formatDate } from '@/lib/utils'
import { PaymentReceipt, useReceiptPrint, PAYMENT_TYPE_LABEL } from './PaymentReceipt'

interface PaymentHistoryPanelProps {
  /** Fournisseur sélectionné dans le bandeau des dettes ; null = tous. */
  supplierId:   string | null
  supplierName: string | null
  /** Même intervalle que le tableau, appliqué ici à la DATE DU VERSEMENT. */
  dateFrom:     string
  dateTo:       string
}

/**
 * Panneau latéral, à droite du tableau des commandes : l'historique daté des
 * versements faits aux fournisseurs, du plus récent au plus ancien.
 *
 * Un versement réparti sur plusieurs commandes est une seule ligne, dépliable,
 * et réimprimable sous forme de reçu — exactement comme dans la modale ouverte
 * depuis la carte « Paiements » d'une commande.
 */
export function PaymentHistoryPanel({ supplierId, supplierName, dateFrom, dateTo }: PaymentHistoryPanelProps) {
  const dataVersion = useAppStore((s) => s.dataVersion)
  const [groups, setGroups]     = useState<SupplierPaymentGroup[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const { receipt, printReceipt, receiptRef } = useReceiptPrint()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    window.api.purchaseOrders.getPaymentHistory(supplierId)
      .then((rows) => { if (!cancelled) setGroups(rows) })
      .catch((e) => { if (!cancelled) { setGroups([]); setError(e instanceof Error ? e.message : String(e)) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [supplierId, dataVersion])

  // Le filtre de dates de l'écran porte sur la date de commande ; ici il porte
  // sur la date du versement — c'est la seule lecture qui ait un sens pour un
  // historique de paiements.
  const visible = groups.filter((g) => {
    if (dateFrom && g.paymentDate < dateFrom) return false
    if (dateTo   && g.paymentDate > dateTo)   return false
    return true
  })

  const total = visible.reduce((s, g) => s + g.totalFcfa, 0)
  const hasDateRange = !!dateFrom || !!dateTo

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="Afficher l'historique des versements"
        className="shrink-0 self-start sticky top-4 w-10 py-4 flex flex-col items-center gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm text-slate-500 hover:text-primary-600 hover:border-primary-200 transition-colors"
      >
        <ChevronsLeft className="w-4 h-4" />
        <History className="w-4 h-4" />
        <span className="text-[10px] font-bold uppercase tracking-widest [writing-mode:vertical-rl]">
          Historique
        </span>
      </button>
    )
  }

  return (
    <div className="shrink-0 self-start sticky top-4 w-80 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[75vh]">

      {/* En-tête */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-start gap-2">
        <div className="p-1.5 bg-primary-50 rounded-lg shrink-0">
          <History className="w-3.5 h-3.5 text-primary-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-bold text-slate-800 leading-tight">Historique des versements</h2>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
            {supplierId ? (supplierName ?? 'Fournisseur') : 'Tous les fournisseurs'}
            {hasDateRange && ' · période filtrée'}
          </p>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          title="Masquer le panneau"
          className="shrink-0 p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Total */}
      <div className="px-4 py-2.5 bg-primary-50/40 border-b border-primary-100 flex items-center justify-between">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
          {visible.length} versement{visible.length !== 1 ? 's' : ''}
        </span>
        <span className="text-sm font-extrabold text-primary-600 tabular-nums">{formatFcfa(total)}</span>
      </div>

      {/* Liste */}
      <div className="overflow-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Chargement...</span>
          </div>
        ) : error ? (
          <p className="px-4 py-8 text-center text-[11px] text-red-600">{error}</p>
        ) : visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-[11px] text-slate-400 italic">
            {groups.length === 0
              ? 'Aucun versement enregistré.'
              : 'Aucun versement sur cette période.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {visible.map((g) => {
              const isOpen  = expanded === g.groupId
              const isMulti = g.lines.length > 1
              return (
                <div key={g.groupId}>
                  <div className="px-3 py-2.5 flex items-start gap-2 hover:bg-slate-50/60 transition-colors">
                    <button
                      onClick={() => setExpanded(isOpen ? null : g.groupId)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <ChevronDown className={`w-3 h-3 text-slate-300 shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                        <span className="text-[11px] font-bold text-slate-800">{formatDate(g.paymentDate)}</span>
                        {isMulti && (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 uppercase whitespace-nowrap">
                            {g.lines.length} cmd
                          </span>
                        )}
                      </div>
                      {/* Sans filtre fournisseur, le nom est la première info utile. */}
                      {!supplierId && (
                        <span className="block text-[10px] font-semibold text-slate-600 truncate ml-[18px]">
                          {g.supplierName ?? '—'}
                        </span>
                      )}
                      <span className="block text-[10px] text-slate-400 truncate ml-[18px]">
                        {g.lines.map((l) => l.orderReference).join(' · ')}
                      </span>
                    </button>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs font-extrabold text-primary-600 tabular-nums whitespace-nowrap">
                        {formatFcfa(g.totalFcfa)}
                      </span>
                      <button
                        onClick={() => printReceipt(g)}
                        disabled={receipt !== null}
                        title="Imprimer le reçu de ce versement"
                        className="p-1 rounded text-slate-300 hover:text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-40"
                      >
                        {receipt?.groupId === g.groupId
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Printer className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Détail des commandes servies par ce versement */}
                  {isOpen && (
                    <div className="px-3 pb-2.5 bg-slate-50/60">
                      {g.lines.map((l) => (
                        <div key={l.paymentId} className="flex items-center gap-1.5 py-1 text-[10px]">
                          <span className="text-slate-600 font-medium truncate">{l.orderReference}</span>
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 uppercase shrink-0">
                            {PAYMENT_TYPE_LABEL[l.type]}
                          </span>
                          <span className="ml-auto tabular-nums font-semibold text-slate-700 shrink-0">
                            {formatFcfa(l.amountFcfa)}
                          </span>
                        </div>
                      ))}
                      {g.notes && (
                        <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-200 mt-1">
                          {g.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ══ REÇU HORS ÉCRAN — visible uniquement dans le PDF ═══════════════════ */}
      {receipt && <PaymentReceipt group={receipt} innerRef={receiptRef} />}
    </div>
  )
}

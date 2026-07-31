import { useEffect, useState } from 'react'
import { Printer, Loader2, History, X } from 'lucide-react'
import { formatFcfa, formatDate } from '@/lib/utils'
import { PaymentReceipt, useReceiptPrint, PAYMENT_TYPE_LABEL as TYPE_LABEL } from './PaymentReceipt'

interface SupplierPaymentHistoryProps {
  supplierId:   string
  supplierName: string | null
  onClose:      () => void
}

/**
 * Historique des versements d'un fournisseur, toutes commandes confondues.
 *
 * Un versement réparti sur plusieurs commandes apparaît comme une seule ligne
 * (son montant total) que l'on peut déplier, et dont on peut réimprimer le reçu.
 */
export function SupplierPaymentHistory({ supplierId, supplierName, onClose }: SupplierPaymentHistoryProps) {
  const [groups, setGroups]   = useState<SupplierPaymentGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  // Versement dont le reçu est en cours d'impression (rendu hors écran).
  const { receipt, printReceipt, receiptRef } = useReceiptPrint()

  useEffect(() => {
    let cancelled = false
    window.api.purchaseOrders.getSupplierPaymentHistory(supplierId)
      .then((rows) => { if (!cancelled) setGroups(rows) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [supplierId])

  const total = groups.reduce((s, g) => s + g.totalFcfa, 0)

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <History className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                Historique des avances
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {supplierName ?? 'Fournisseur'}
                {!loading && groups.length > 0 && ` · ${groups.length} versement${groups.length !== 1 ? 's' : ''} · ${formatFcfa(total)}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Liste des versements */}
        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Chargement...</span>
            </div>
          ) : error ? (
            <p className="px-5 py-8 text-center text-xs text-red-600">{error}</p>
          ) : groups.length === 0 ? (
            <p className="px-5 py-12 text-center text-xs text-slate-400 italic">
              Aucun versement enregistré pour ce fournisseur.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {groups.map((g) => {
                const isOpen  = expanded === g.groupId
                const isMulti = g.lines.length > 1
                return (
                  <div key={g.groupId}>
                    <div className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-900/20 transition-colors">
                      <button
                        onClick={() => setExpanded(isOpen ? null : g.groupId)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {formatDate(g.paymentDate)}
                          </span>
                          {isMulti && (
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 uppercase whitespace-nowrap">
                              {g.lines.length} commandes
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 truncate block">
                          {isMulti
                            ? g.lines.map((l) => l.orderReference).join(' · ')
                            : `${g.lines[0]?.orderReference ?? '—'}${g.notes ? ` — ${g.notes}` : ''}`}
                        </span>
                      </button>

                      <span className="text-sm font-extrabold text-primary-600 tabular-nums whitespace-nowrap">
                        {formatFcfa(g.totalFcfa)}
                      </span>

                      <button
                        onClick={() => printReceipt(g)}
                        disabled={receipt !== null}
                        title="Imprimer le reçu de ce versement"
                        className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-40"
                      >
                        {receipt?.groupId === g.groupId
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Printer className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Détail des commandes servies par ce versement */}
                    {isOpen && (
                      <div className="px-5 pb-3 bg-slate-50/60 dark:bg-slate-900/20">
                        {g.lines.map((l) => (
                          <div key={l.paymentId} className="flex items-center gap-2 py-1.5 text-[11px]">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">{l.orderReference}</span>
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 uppercase">
                              {TYPE_LABEL[l.type]}
                            </span>
                            <span className="ml-auto tabular-nums font-semibold text-slate-700 dark:text-slate-200">
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
      </div>

      {/* ══ REÇU HORS ÉCRAN — visible uniquement dans le PDF ═══════════════════ */}
      {receipt && <PaymentReceipt group={receipt} innerRef={receiptRef} />}
    </div>
  )
}

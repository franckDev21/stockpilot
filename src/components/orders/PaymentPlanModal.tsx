import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatFcfa, formatDate } from '@/lib/utils'

interface PaymentPlanModalProps {
  plan:      PaymentPlan
  saving:    boolean
  error:     string
  onConfirm: () => void
  onCancel:  () => void
}

/**
 * Confirmation d'un versement qui déborde sur d'autres commandes.
 *
 * N'apparaît que lorsque le montant saisi dépasse le restant dû de la commande
 * visée : l'utilisateur voit exactement quelles commandes seront servies avant
 * que quoi que ce soit ne soit écrit.
 */
export function PaymentPlanModal({ plan, saving, error, onConfirm, onCancel }: PaymentPlanModalProps) {
  const target      = plan.allocations.find((a) => a.isTargetOrder)
  const overflowing = plan.allocations.filter((a) => !a.isTargetOrder)
  const totalAllocated = plan.allocations.reduce((s, a) => s + a.allocatedFcfa, 0)
  const settledCount   = plan.allocations.filter((a) => a.settled).length

  return (
    <Modal isOpen onClose={saving ? () => {} : onCancel} title="Répartition du versement">
      <div className="flex flex-col gap-4">

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Le versement de <strong className="text-slate-900 dark:text-slate-100">{formatFcfa(plan.amountFcfa)}</strong>
          {target && <> dépasse le restant dû de la commande <strong>{target.reference}</strong> ({formatFcfa(target.remainingBeforeFcfa)})</>}.
          {overflowing.length > 0 && (
            <> Le surplus sera imputé sur {overflowing.length === 1 ? 'la commande suivante' : `les ${overflowing.length} commandes suivantes`} de{' '}
              <strong>{plan.supplierName ?? 'ce fournisseur'}</strong>, de la plus ancienne à la plus récente.</>
          )}
        </p>

        {/* Détail de la répartition */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Commande</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 text-right">Restant dû</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 text-right w-24">Imputé</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-64 overflow-auto">
            {plan.allocations.map((a) => (
              <div
                key={a.orderId}
                className={`grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 items-center ${
                  a.isTargetOrder ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{a.reference}</span>
                    {a.isTargetOrder && (
                      <span className="shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 uppercase">
                        Saisie
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">{formatDate(a.orderDate)}</span>
                </div>
                <span className="text-[11px] text-slate-500 tabular-nums text-right whitespace-nowrap">
                  {formatFcfa(a.remainingBeforeFcfa)}
                </span>
                <div className="text-right w-24">
                  <div className="text-xs font-extrabold text-primary-600 tabular-nums whitespace-nowrap">
                    {formatFcfa(a.allocatedFcfa)}
                  </div>
                  <span className={`text-[8px] font-bold uppercase ${a.settled ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {a.settled ? 'Soldée' : 'Avance'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-semibold text-slate-500">
              {settledCount} commande{settledCount !== 1 ? 's' : ''} soldée{settledCount !== 1 ? 's' : ''}
            </span>
            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">
              Total : {formatFcfa(totalAllocated)}
            </span>
          </div>
        </div>

        {/* Montant que la dette du fournisseur ne peut pas absorber */}
        {plan.excessFcfa > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
            <p className="text-[11px] text-red-700 leading-relaxed">
              <strong>{formatFcfa(plan.excessFcfa)}</strong> ne peuvent être imputés à aucune commande :
              le versement dépasse la dette totale de {plan.supplierName ?? 'ce fournisseur'}
              {' '}({formatFcfa(plan.supplierDebtFcfa)}). Réduisez le montant pour continuer.
            </p>
          </div>
        )}

        {error && <p className="text-[11px] text-red-600">{error}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>Annuler</Button>
          <Button size="sm" onClick={onConfirm} loading={saving} disabled={plan.excessFcfa > 0}>
            Valider la répartition
          </Button>
        </div>
      </div>
    </Modal>
  )
}

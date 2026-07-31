import { useEffect, useRef, useState, type RefObject } from 'react'
import { formatFcfa, formatDate } from '@/lib/utils'

export const PAYMENT_TYPE_LABEL: Record<'deposit' | 'balance' | 'full', string> = {
  deposit: 'Avance',
  balance: 'Solde',
  full:    'Complet',
}

/**
 * Impression d'un reçu de versement.
 *
 * L'impression est déclenchée depuis un effet et non depuis le clic : le reçu
 * doit d'abord être réellement monté dans le DOM pour que la capture PDF le voie.
 */
export function useReceiptPrint() {
  const [receipt, setReceipt] = useState<SupplierPaymentGroup | null>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!receipt) return
    let cancelled = false
    const run = async () => {
      const el = receiptRef.current
      if (!el) return
      el.classList.add('print-target')
      try {
        await window.api.print.toPDF({ filename: `recu-versement-${receipt.paymentDate}.pdf` })
      } catch (e) {
        console.error('Impression du reçu :', e)
      } finally {
        el.classList.remove('print-target')
        if (!cancelled) setReceipt(null)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [receipt])

  return { receipt, printReceipt: setReceipt, receiptRef }
}

interface PaymentReceiptProps {
  group:    SupplierPaymentGroup
  innerRef: RefObject<HTMLDivElement>
}

/** Reçu rendu hors écran : visible uniquement dans le PDF. */
export function PaymentReceipt({ group, innerRef }: PaymentReceiptProps) {
  return (
    <div ref={innerRef} className="print-report bg-white text-slate-900 p-10" aria-hidden>
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-6">
        <div>
          <h1 className="text-xl font-extrabold">StockPilot — Reçu de versement</h1>
          <p className="text-[11px] text-slate-500 mt-1">
            Édité le {formatDate(new Date().toISOString())}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Montant versé</p>
          <p className="text-3xl font-extrabold text-slate-900 tabular-nums">{formatFcfa(group.totalFcfa)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Fournisseur</p>
          <p className="text-base font-bold">{group.supplierName ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Date du versement</p>
          <p className="text-base font-bold">{formatDate(group.paymentDate)}</p>
        </div>
      </div>

      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">
        Imputation du versement
      </p>
      <table className="w-full text-sm border-collapse mb-6">
        <thead>
          <tr className="border-b-2 border-slate-300">
            <th className="text-left py-2 text-[10px] uppercase tracking-widest text-slate-500 font-bold">Commande</th>
            <th className="text-left py-2 text-[10px] uppercase tracking-widest text-slate-500 font-bold">Nature</th>
            <th className="text-right py-2 text-[10px] uppercase tracking-widest text-slate-500 font-bold">Montant imputé</th>
          </tr>
        </thead>
        <tbody>
          {group.lines.map((l) => (
            <tr key={l.paymentId} className="border-b border-slate-200">
              <td className="py-2 font-semibold">{l.orderReference}</td>
              <td className="py-2 text-slate-600">{PAYMENT_TYPE_LABEL[l.type]}</td>
              <td className="py-2 text-right tabular-nums font-semibold">{formatFcfa(l.amountFcfa)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-800">
            <td colSpan={2} className="py-2 font-bold">Total versé</td>
            <td className="py-2 text-right font-extrabold tabular-nums text-base">{formatFcfa(group.totalFcfa)}</td>
          </tr>
        </tfoot>
      </table>

      {group.notes && (
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Note</p>
          <p className="text-sm text-slate-700">{group.notes}</p>
        </div>
      )}

      <div className="flex justify-between gap-12 mt-16">
        <div className="flex-1">
          <div className="border-t border-slate-400 pt-1">
            <p className="text-[10px] text-slate-500">Signature du fournisseur</p>
          </div>
        </div>
        <div className="flex-1">
          <div className="border-t border-slate-400 pt-1">
            <p className="text-[10px] text-slate-500">Signature de l'acheteur</p>
          </div>
        </div>
      </div>
    </div>
  )
}

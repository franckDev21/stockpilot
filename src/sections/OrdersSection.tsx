import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ShoppingCart, Plus, Pencil, Trash2, Eye, Printer, Loader2,
  Check, X, Phone, Globe, Mail, TriangleAlert, Calendar as CalendarIcon, History,
} from 'lucide-react'
import { Button }      from '@/components/ui/Button'
import { Badge }       from '@/components/ui/Badge'
import { PaymentPlanModal } from '@/components/orders/PaymentPlanModal'
import { SupplierPaymentHistory } from '@/components/orders/SupplierPaymentHistory'
import { useAppStore } from '@/store/app.store'
import { formatFcfa, formatDate, parseProductImages } from '@/lib/utils'
import type { EnrichedPurchaseOrder, OrderPayment, PurchaseOrder } from '@/types/domain'

// ─── Constants ────────────────────────────────────────────────────────────────

type OrderStatus = PurchaseOrder['status']

const STATUS_BADGE: Record<OrderStatus, { label: string; color: 'slate' | 'blue' | 'amber' | 'green' | 'red' }> = {
  draft:     { label: 'Brouillon',  color: 'slate' },
  confirmed: { label: 'Confirmée', color: 'blue'  },
  partial:   { label: 'Partielle', color: 'amber' },
  complete:  { label: 'Complète',  color: 'green' },
  cancelled: { label: 'Annulée',   color: 'red'   },
}

const PAYMENT_TYPE: Record<OrderPayment['type'], { label: string; cls: string }> = {
  deposit: { label: 'Avance',  cls: 'text-amber-700 bg-amber-50 border border-amber-300' },
  balance: { label: 'Solde',   cls: 'text-emerald-700 bg-emerald-50 border border-emerald-300' },
  full:    { label: 'Complet', cls: 'text-blue-700 bg-blue-50 border border-blue-300' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '—' }
}

function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short',
    })
  } catch { return dateStr }
}

// ─── Inline add-payment form (inside the card) ────────────────────────────────

interface AddPaymentFormProps {
  totalCostFcfa: number
  paidSoFar: number
  onSave: (data: { amountFcfa: number; type: OrderPayment['type']; paymentDate: string; notes: string }) => Promise<void>
  onCancel: () => void
}

function AddPaymentForm({ totalCostFcfa, paidSoFar, onSave, onCancel }: AddPaymentFormProps) {
  const remaining = Math.max(0, totalCostFcfa - paidSoFar)
  const [amount, setAmount] = useState(remaining > 0 ? String(remaining) : '')
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)

  // Auto-deduce type from amount
  const parsed = parseInt(amount, 10) || 0
  const deducedType: OrderPayment['type'] =
    parsed >= remaining && paidSoFar === 0 && parsed >= totalCostFcfa
      ? 'full'
      : parsed >= remaining && remaining > 0
      ? 'balance'
      : 'deposit'

  const typeInfo = PAYMENT_TYPE[deducedType]

  const inp = 'w-full border border-slate-200 rounded-md px-2 py-1 text-[10px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-400 bg-white'

  const handleSave = async () => {
    if (!parsed || parsed <= 0) return
    setSaving(true)
    try { await onSave({ amountFcfa: parsed, type: deducedType, paymentDate: date, notes }) }
    finally { setSaving(false) }
  }

  return (
    <div className="px-3 py-2.5 border-t border-slate-100 bg-primary-50/40 flex flex-col gap-2 animate-fade-in">
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-500 uppercase">Montant</span>
            {/* Type déduit automatiquement */}
            {parsed > 0 && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${typeInfo.cls}`}>
                {typeInfo.label}
              </span>
            )}
          </div>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            className={inp} placeholder="FCFA" autoFocus />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-bold text-slate-500 uppercase">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} />
        </div>
        <div className="col-span-2 flex flex-col gap-0.5">
          <span className="text-[9px] font-bold text-slate-500 uppercase">Note (facultatif)</span>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            className={inp} placeholder="Ex: virement bancaire, espèces..." />
        </div>
      </div>
      <div className="flex gap-1.5">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-[10px] font-bold transition-colors disabled:opacity-50">
          <Check className="w-3 h-3" />
          {saving ? 'Enregistrement...' : 'Confirmer'}
        </button>
        <button onClick={onCancel}
          className="px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-500 text-[10px] transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ─── Payment card (single column, spans all product rows) ─────────────────────

interface PaymentCardProps {
  order: EnrichedPurchaseOrder
  rowSpan: number
  onAddPayment: (orderId: string, data: unknown) => Promise<void>
  onSupplierPayment: (orderId: string, data: { amountFcfa: number; paymentDate: string; notes: string }) => Promise<void>
  onDeletePayment: (paymentId: string) => Promise<void>
}

function PaymentCard({ order, rowSpan, onAddPayment, onSupplierPayment, onDeletePayment }: PaymentCardProps) {
  const [addingPayment, setAddingPayment] = useState(false)
  // Versement en attente de confirmation parce qu'il déborde sur d'autres commandes
  const [plan, setPlan]             = useState<PaymentPlan | null>(null)
  const [pending, setPending]       = useState<{ amountFcfa: number; paymentDate: string; notes: string } | null>(null)
  const [planSaving, setPlanSaving] = useState(false)
  const [planError, setPlanError]   = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const { openModal } = useAppStore()

  const handleDeletePayment = (payment: OrderPayment) => {
    openModal(
      'Supprimer ce paiement ?',
      `Le paiement de ${formatFcfa(payment.amountFcfa)} (${PAYMENT_TYPE[payment.type].label}) sera supprimé définitivement.` +
      (payment.paymentGroupId
        // Une ligne issue d'un versement réparti : les parts imputées aux autres
        // commandes ne sont pas touchées, ce qui n'est pas évident depuis ici.
        ? ` Attention : cette ligne fait partie d'un versement réparti sur plusieurs commandes. ` +
          `Seule cette part est supprimée, les autres commandes gardent la leur.`
        : ''),
      () => onDeletePayment(payment.id),
    )
  }

  const totalPaid = order.payments.reduce((s, p) => s + p.amountFcfa, 0)
  const remaining = Math.max(0, order.totalCostFcfa - totalPaid)
  const isSolde   = remaining <= 0
  const pct       = order.totalCostFcfa > 0 ? Math.min(100, Math.round((totalPaid / order.totalCostFcfa) * 100)) : 0

  const handleSave = async (data: { amountFcfa: number; type: OrderPayment['type']; paymentDate: string; notes: string }) => {
    // Le montant tient dans cette commande : chemin habituel, rien ne change.
    if (data.amountFcfa <= remaining) {
      await onAddPayment(order.id, data)
      setAddingPayment(false)
      return
    }
    // Il déborde : on montre la répartition et on attend une validation explicite.
    try {
      const preview = await window.api.purchaseOrders.previewPayment(order.id, data.amountFcfa)
      setPending({ amountFcfa: data.amountFcfa, paymentDate: data.paymentDate, notes: data.notes })
      setPlanError('')
      setPlan(preview)
    } catch (err) {
      openModal('Répartition impossible', err instanceof Error ? err.message : String(err))
    }
  }

  const confirmPlan = async () => {
    if (!pending) return
    setPlanSaving(true)
    setPlanError('')
    try {
      await onSupplierPayment(order.id, pending)
      setPlan(null)
      setPending(null)
      setAddingPayment(false)
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : String(err))
    } finally {
      setPlanSaving(false)
    }
  }

  const cancelPlan = () => {
    setPlan(null)
    setPending(null)
    setPlanError('')
  }

  return (
    <td rowSpan={rowSpan} className="px-3 py-3 border-b border-l border-slate-200 align-top w-72">
      <div className={`rounded-xl overflow-hidden border shadow-sm ${isSolde ? 'border-emerald-200' : 'border-amber-200'}`}>

        {/* Card header */}
        <div className={`px-3 py-2 flex items-center gap-2 border-b ${isSolde ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
          <div className={`w-2 h-2 rounded-full shrink-0 ${isSolde ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span className={`text-[9px] font-extrabold uppercase tracking-widest ${isSolde ? 'text-emerald-700' : 'text-amber-700'}`}>
            Paiements · {order.payments.length} transaction{order.payments.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setShowHistory(true)}
            title={`Historique des avances de ${order.supplierName ?? 'ce fournisseur'}`}
            className="ml-auto shrink-0 p-1 rounded text-slate-400 hover:text-primary-600 hover:bg-white/60 transition-colors"
          >
            <History className="w-3 h-3" />
          </button>
        </div>

        {/* Payment list */}
        {order.payments.length === 0 ? (
          <div className="px-3 py-3 text-[10px] text-slate-400 italic text-center">Aucun paiement</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {order.payments.map((payment) => {
              const pt = PAYMENT_TYPE[payment.type]
              return (
                <div key={payment.id} className="px-3 py-2 flex items-center gap-2 group hover:bg-slate-50/60 transition-colors">
                  <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${pt.cls}`}>
                    {pt.label}
                  </span>
                  <span className="text-[9px] text-slate-400 tabular-nums whitespace-nowrap">
                    {formatShortDate(payment.paymentDate)} {formatTime(payment.createdAt)}
                  </span>
                  <span className="ml-auto text-xs font-extrabold text-primary-600 tabular-nums shrink-0">
                    {formatFcfa(payment.amountFcfa)}
                  </span>
                  <button
                    onClick={() => handleDeletePayment(payment)}
                    className="opacity-0 group-hover:opacity-100 shrink-0 w-4 h-4 rounded flex items-center justify-center hover:bg-red-100 text-red-300 hover:text-red-500 transition-opacity"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Add payment form or button */}
        {!isSolde && (
          addingPayment ? (
            <AddPaymentForm
              totalCostFcfa={order.totalCostFcfa}
              paidSoFar={totalPaid}
              onSave={handleSave}
              onCancel={() => setAddingPayment(false)}
            />
          ) : (
            <button
              onClick={() => setAddingPayment(true)}
              className="w-full px-3 py-1.5 text-[10px] text-slate-400 hover:text-primary-600 hover:bg-primary-50/50 border-t border-slate-100 transition-colors font-medium"
            >
              + Ajouter un paiement
            </button>
          )
        )}

        {/* Progress bar */}
        <div className="px-3 pt-2 pb-1">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isSolde ? 'bg-emerald-500' : 'bg-amber-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Footer: totals + status */}
        <div className="px-3 pb-2.5 flex items-center justify-between gap-2">
          <div className="text-[10px] text-slate-500 leading-tight">
            <span className="font-semibold text-slate-700">Payé : {formatFcfa(totalPaid)}</span>
            <span className="mx-1 text-slate-300">|</span>
            <span>Reste : </span>
            <span className={`font-semibold ${remaining > 0 ? 'text-red-500' : 'text-slate-400'}`}>
              {formatFcfa(remaining)}
            </span>
          </div>
          {isSolde ? (
            <span className="shrink-0 inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full text-[9px] font-bold">
              ✓ Soldé
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1 text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full text-[9px] font-bold">
              <TriangleAlert className="w-2.5 h-2.5" /> En cours
            </span>
          )}
        </div>

      </div>

      {showHistory && (
        <SupplierPaymentHistory
          supplierId={order.supplierId}
          supplierName={order.supplierName}
          onClose={() => setShowHistory(false)}
        />
      )}

      {plan && (
        <PaymentPlanModal
          plan={plan}
          saving={planSaving}
          error={planError}
          onConfirm={confirmPlan}
          onCancel={cancelPlan}
        />
      )}
    </td>
  )
}

// ─── Order group ──────────────────────────────────────────────────────────────

interface OrderGroupProps {
  order: EnrichedPurchaseOrder
  onDelete: (o: EnrichedPurchaseOrder) => void
  onEdit: (o: EnrichedPurchaseOrder) => void
  onView: (id: string) => void
  onAddPayment: (orderId: string, data: unknown) => Promise<void>
  onSupplierPayment: (orderId: string, data: { amountFcfa: number; paymentDate: string; notes: string }) => Promise<void>
  onDeletePayment: (paymentId: string) => Promise<void>
}

function OrderGroup({ order, onDelete, onEdit, onView, onAddPayment, onSupplierPayment, onDeletePayment }: OrderGroupProps) {
  const badge      = STATUS_BADGE[order.status]
  const items      = order.items.length > 0 ? order.items : [null]
  const totalRows  = items.length + 1 // +1 for the total row

  const tdProd = 'px-3 py-2.5 text-xs text-slate-700 align-middle border-b border-slate-100'
  const tdRef  = 'px-3 py-2.5 text-xs text-slate-500 align-middle border-b border-slate-100'

  return (
    <>
      {items.map((item, idx) => (
        <tr key={item?.id ?? `row-${idx}`} className="hover:bg-slate-50/30 transition-colors group">

          {/* N°Commande — spans all product rows */}
          {idx === 0 && (
            <td rowSpan={totalRows} className="px-3 py-2.5 align-top border-b border-r border-slate-200 bg-slate-50/40 w-36">
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] font-bold text-primary-700 bg-primary-50 px-2 py-1 rounded-md border border-primary-200 leading-tight break-all">
                  {order.reference}
                </span>
                <Badge color={badge.color} dot>{badge.label}</Badge>
                <span className="text-[10px] text-slate-400">{formatDate(order.orderDate)}</span>
                {/* Actions on hover */}
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                  <button onClick={() => onView(order.id)} className="inline-flex items-center gap-1 text-[9px] font-semibold text-primary-600 hover:underline">
                    <Eye className="w-2.5 h-2.5" /> Voir
                  </button>
                  <button onClick={() => onEdit(order)} className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-500 hover:underline">
                    <Pencil className="w-2.5 h-2.5" /> Modifier
                  </button>
                  <button onClick={() => onDelete(order)} className="inline-flex items-center gap-1 text-[9px] font-semibold text-red-500 hover:underline">
                    <Trash2 className="w-2.5 h-2.5" /> Supprimer
                  </button>
                </div>
              </div>
            </td>
          )}

          {/* Produits */}
          <td className={tdProd}>
            {item ? (
              <div className="flex items-center gap-2">
                {parseProductImages(item.productImageData)[0] ? (
                  <img src={parseProductImages(item.productImageData)[0]} alt=""
                    className="w-9 h-9 rounded-lg object-cover shrink-0 border border-slate-200" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                    <ShoppingCart className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-slate-800 text-[11px] leading-tight truncate max-w-36">{item.productName ?? '—'}</span>
                  {item.productReference && <span className="font-mono text-[9px] text-slate-400 mt-0.5">{item.productReference}</span>}
                </div>
              </div>
            ) : <span className="text-slate-400 italic text-[11px]">Aucun produit</span>}
          </td>

          {/* Fournisseur — only on first row */}
          {idx === 0 ? (
            <td rowSpan={items.length} className={`${tdProd} align-top min-w-36`}>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-800 text-[11px] leading-tight">{order.supplierName ?? '—'}</span>
                {(order.supplierCity || order.supplierCountry) && (
                  <div className="flex items-center gap-1 text-[9px] text-slate-500">
                    <Globe className="w-2.5 h-2.5 shrink-0" />
                    <span>{[order.supplierCity, order.supplierCountry].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {order.supplierPhone && (
                  <div className="flex items-center gap-1 text-[9px] text-slate-500">
                    <Phone className="w-2.5 h-2.5 shrink-0" />
                    <span className="tabular-nums">{order.supplierPhone}</span>
                  </div>
                )}
                {order.supplierEmail && (
                  <div className="flex items-center gap-1 text-[9px] text-slate-500">
                    <Mail className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate max-w-32">{order.supplierEmail}</span>
                  </div>
                )}
              </div>
            </td>
          ) : null}

          {/* Réf. produit */}
          <td className={tdRef}>
            {item ? (
              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">
                {item.productReference ?? '—'}
              </span>
            ) : '—'}
          </td>

          {/* Date / Heure */}
          <td className={tdRef}>
            <div className="flex flex-col text-[10px]">
              <span>{formatDate(order.orderDate)}</span>
              <span className="text-slate-400">{formatTime(order.createdAt)}</span>
            </div>
          </td>

          {/* Prix (unit price per pair) */}
          <td className={`${tdRef} text-right`}>
            {item ? (
              <span className="font-semibold tabular-nums">
                {formatFcfa(Number(item.unitCostPerCartonFcfa) / (item.pairsPerCarton || 1))}
              </span>
            ) : '—'}
          </td>

          {/* Unité (pairs per carton) */}
          <td className={`${tdProd} text-center text-slate-500`}>{item?.pairsPerCarton ?? '—'}</td>

          {/* Cartons */}
          <td className={`${tdProd} text-center font-bold`}>{item?.cartonsOrdered ?? '—'}</td>

          {/* Prix Carton (unitCostPerCartonFcfa) */}
          <td className={`${tdRef} text-right`}>
            {item ? (
              <span className="font-semibold tabular-nums text-slate-800">
                {formatFcfa(item.unitCostPerCartonFcfa)}
              </span>
            ) : '—'}
          </td>

          {/* prix cartons (Total for all cartons in the row) */}
          <td className={`${tdProd} text-right`}>
            {item ? (
              <span className="font-bold text-slate-900 tabular-nums">
                {formatFcfa(item.unitCostPerCartonFcfa * (item.cartonsOrdered ?? 0))}
              </span>
            ) : '—'}
          </td>

          {/* PAIEMENTS card — first row only, spans all product rows */}
          {idx === 0 ? (
            <PaymentCard
              order={order}
              rowSpan={totalRows}
              onAddPayment={onAddPayment}
              onSupplierPayment={onSupplierPayment}
              onDeletePayment={onDeletePayment}
            />
          ) : null}
        </tr>
      ))}

      {/* ══ TOTAL ROW — fusionne les 8 colonnes produit ════════════════════════ */}
      <tr className="bg-slate-50/80">
        {/* N°CMD déjà spanné */}
        <td colSpan={9} className="px-4 py-2 border-b-2 border-slate-200 text-right">
          <span className="text-[10px] font-semibold text-slate-500 mr-2">Total commande</span>
          <span className="text-sm font-extrabold text-slate-900 tabular-nums">
            {formatFcfa(order.totalCostFcfa)}
          </span>
        </td>
        {/* PAIEMENTS card déjà spannée */}
      </tr>
    </>
  )
}

// ─── Supplier debt panel ──────────────────────────────────────────────────────

interface SupplierDebt { name: string; totalDue: number; ordersCount: number }

interface SupplierDebtPanelProps {
  orders: EnrichedPurchaseOrder[]
  loading: boolean
  selected: string | null
  onSelect: (name: string | null) => void
  dateFrom: string
  dateTo: string
  onDateFromChange: (date: string) => void
  onDateToChange: (date: string) => void
}

function SupplierDebtPanel({
  orders, loading, selected, onSelect,
  dateFrom, dateTo, onDateFromChange, onDateToChange,
}: SupplierDebtPanelProps) {
  // Compute debts from the (already date-filtered) enriched orders.
  // ordersCount = TOTAL orders for the supplier; totalDue = sum of unpaid balances.
  const debts: SupplierDebt[] = (() => {
    const map = new Map<string, SupplierDebt>()
    for (const o of orders) {
      const paid = o.payments.reduce((s, p) => s + p.amountFcfa, 0)
      const due  = o.totalCostFcfa - paid
      const name = o.supplierName ?? 'Inconnu'
      let entry = map.get(name)
      if (!entry) { entry = { name, totalDue: 0, ordersCount: 0 }; map.set(name, entry) }
      entry.ordersCount += 1
      if (due > 0) entry.totalDue += due
    }
    // Only keep suppliers we actually owe money to
    return [...map.values()]
      .filter((d) => d.totalDue > 0)
      .sort((a, b) => b.totalDue - a.totalDue)
  })()

  const grandTotal  = debts.reduce((s, d) => s + d.totalDue, 0)
  const hasDateRange = !!dateFrom || !!dateTo

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Ce que je dois à mes fournisseurs</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Filtrez par fournisseur ou par intervalle de dates</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {/* Date range filter */}
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Du</span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Au</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => onDateToChange(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            {hasDateRange && (
              <button
                onClick={() => { onDateFromChange(''); onDateToChange('') }}
                className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                title="Effacer l'intervalle"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {/* Grand total */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Total dû</span>
            <span className="text-xl font-extrabold text-red-600 tabular-nums">{formatFcfa(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Supplier chips */}
      <div className="px-5 py-3 flex items-center gap-2 flex-wrap min-h-[3rem]">
        {/* "Tous" button */}
        <button
          onClick={() => onSelect(null)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
            selected === null
              ? 'bg-slate-800 text-white border-slate-800'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
          }`}
        >
          Tous ({debts.length})
        </button>

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-36 rounded-full bg-slate-100 animate-pulse" />
          ))
        ) : debts.length === 0 ? (
          <span className="text-[11px] text-emerald-600 font-semibold ml-1">
            ✓ Aucune dette {hasDateRange ? 'sur cette période' : ''} — tout est soldé
          </span>
        ) : (
          debts.map((d) => (
            <button
              key={d.name}
              onClick={() => onSelect(selected === d.name ? null : d.name)}
              className={`inline-flex flex-col px-3 py-1 rounded-xl text-left border transition-all ${
                selected === d.name
                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                  : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
              }`}
            >
              <span className="text-[11px] font-bold leading-tight">{d.name}</span>
              <span className={`text-[10px] tabular-nums font-semibold ${selected === d.name ? 'text-red-100' : 'text-red-500'}`}>
                {formatFcfa(d.totalDue)} · {d.ordersCount} cmd
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main table ───────────────────────────────────────────────────────────────

interface OrdersExcelTableProps {
  orders: EnrichedPurchaseOrder[]
  loading: boolean
  supplierFilter: string | null
  dateFrom: string
  dateTo: string
}

function OrdersExcelTable({ orders, loading, supplierFilter, dateFrom, dateTo }: OrdersExcelTableProps) {
  const { openDrawer, openModal, openDetail, triggerRefresh } = useAppStore()
  const [search, setSearch]   = useState('')
  const [printing, setPrinting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  const filtered = orders.filter((o) => {
    if (supplierFilter && (o.supplierName ?? '') !== supplierFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      o.reference.toLowerCase().includes(q) ||
      (o.supplierName ?? '').toLowerCase().includes(q) ||
      o.items.some((i) =>
        (i.productName ?? '').toLowerCase().includes(q) ||
        (i.productReference ?? '').toLowerCase().includes(q),
      )
    )
  })

  const hasDateRange    = !!dateFrom || !!dateTo
  const hasActiveFilter = !!search || !!supplierFilter || hasDateRange
  const dateLabel = dateFrom && dateTo
    ? (dateFrom === dateTo ? formatDate(dateFrom) : `${formatDate(dateFrom)} → ${formatDate(dateTo)}`)
    : dateFrom ? `dès ${formatDate(dateFrom)}`
    : dateTo ? `jusqu'au ${formatDate(dateTo)}`
    : ''

  const handleDelete = (o: EnrichedPurchaseOrder) =>
    openModal(
      'Supprimer cette commande ?',
      `La commande "${o.reference}" et ses paiements seront supprimés définitivement.`,
      async () => { await window.api.purchaseOrders.delete(o.id); triggerRefresh() },
    )

  const handleAddPayment = async (orderId: string, data: unknown) => {
    await window.api.purchaseOrders.addPayment(orderId, data)
    triggerRefresh()
  }

  // Versement qui déborde sur d'autres commandes du même fournisseur : la
  // répartition est recalculée côté service, celle de l'aperçu n'est pas rejouée.
  const handleSupplierPayment = async (
    orderId: string,
    data: { amountFcfa: number; paymentDate: string; notes: string },
  ) => {
    await window.api.purchaseOrders.addSupplierPayment(orderId, data)
    triggerRefresh()
  }

  const handleDeletePayment = async (paymentId: string) => {
    await window.api.purchaseOrders.deletePayment(paymentId)
    triggerRefresh()
  }

  // Per-order computed totals (for both the print report and footer)
  const rows = filtered.map((o) => {
    const paid = o.payments.reduce((s, p) => s + p.amountFcfa, 0)
    return { order: o, paid, due: Math.max(0, o.totalCostFcfa - paid) }
  })
  const grandTotal = rows.reduce((s, r) => s + r.order.totalCostFcfa, 0)
  const grandPaid  = rows.reduce((s, r) => s + r.paid, 0)
  const grandDue   = rows.reduce((s, r) => s + r.due, 0)

  const handlePrint = async () => {
    if (printing || !reportRef.current) return
    setPrinting(true)
    const el = reportRef.current
    el.classList.add('print-target')
    try {
      await window.api.print.toPDF({ filename: `commandes-fournisseur-${new Date().toISOString().slice(0, 10)}.pdf` })
    } catch (e) { console.error(e) }
    finally {
      el.classList.remove('print-target')
      setPrinting(false)
    }
  }

  const th    = 'px-3 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-left whitespace-nowrap select-none'
  const thPay = `${th} text-primary-600 border-l border-primary-100 bg-primary-50/40`

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Commandes fournisseur</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {supplierFilter || hasDateRange ? (
              <span className="inline-flex items-center gap-1.5">
                Filtré
                {supplierFilter && <span className="font-semibold text-red-600">· {supplierFilter}</span>}
                {hasDateRange && <span className="font-semibold text-primary-600">· {dateLabel}</span>}
              </span>
            ) : 'Suivi des commandes, produits et états de paiement'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Rechercher une commande..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 w-56"
          />
          <button
            onClick={handlePrint}
            disabled={printing || filtered.length === 0}
            title="Imprimer / exporter les commandes en PDF"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            {printing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
            PDF commandes
          </button>
          <Button size="sm" onClick={() => openDrawer('create-order')}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Nouvelle commande
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 flex-col gap-3">
          <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400">Chargement...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <ShoppingCart className="w-8 h-8 text-slate-200" />
          <p className="text-sm text-slate-400">{hasActiveFilter ? 'Aucune commande trouvée pour ce filtre' : 'Aucune commande'}</p>
          {!hasActiveFilter && (
            <Button size="sm" variant="secondary" onClick={() => openDrawer('create-order')}>
              Créer une première commande
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-auto max-h-[75vh]">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 border-b-2 border-slate-200 sticky top-0 z-20">
              <tr>
                <th className={`${th} w-36 border-r border-slate-200`}>N°Commande</th>
                <th className={th}>Produits</th>
                <th className={th}>Fournisseur</th>
                <th className={th}>Réf.</th>
                <th className={th}>Date / Heure</th>
                <th className={`${th} text-right`}>Prix</th>
                <th className={`${th} text-center`}>Unité</th>
                <th className={`${th} text-center`}>Cartons</th>
                <th className={`${th} text-right`}>Prix carton</th>
                <th className={`${th} text-right`}>prix cartons</th>
                <th className={thPay}>Paiements</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <OrderGroup
                  key={order.id}
                  order={order}
                  onDelete={handleDelete}
                  onEdit={(o) => openDrawer('edit-order', o)}
                  onView={(id) => openDetail('order', id)}
                  onAddPayment={handleAddPayment}
                  onSupplierPayment={handleSupplierPayment}
                  onDeletePayment={handleDeletePayment}
                />
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td colSpan={8} className="px-4 py-3 text-[11px] font-semibold text-slate-500">
                  {filtered.length} commande{filtered.length !== 1 ? 's' : ''}
                  {hasActiveFilter && ` · filtrée${filtered.length !== 1 ? 's' : ''}`}
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-800 tabular-nums">
                  {formatFcfa(filtered.reduce((s, o) => s + o.totalCostFcfa, 0))}
                </td>
                <td className="px-4 py-3 no-print" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ══ OFF-SCREEN PRINT REPORT (orders + debts) ═══════════════════════════ */}
      <div ref={reportRef} className="print-report bg-white text-slate-900 p-8" aria-hidden>
        {/* Report header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3 mb-5">
          <div>
            <h1 className="text-xl font-extrabold">StockPilot — Commandes fournisseur</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Édité le {formatDate(new Date().toISOString())}
              {supplierFilter && ` · Fournisseur : ${supplierFilter}`}
              {hasDateRange && ` · Période : ${dateLabel}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Total dû</p>
            <p className="text-2xl font-extrabold text-red-600 tabular-nums">{formatFcfa(grandDue)}</p>
          </div>
        </div>

        {/* Section 1 — Supplier debts */}
        {(() => {
          const map = new Map<string, { name: string; count: number; total: number; paid: number; due: number }>()
          for (const r of rows) {
            const name = r.order.supplierName ?? 'Inconnu'
            let e = map.get(name)
            if (!e) { e = { name, count: 0, total: 0, paid: 0, due: 0 }; map.set(name, e) }
            e.count += 1; e.total += r.order.totalCostFcfa; e.paid += r.paid; e.due += r.due
          }
          const debts = [...map.values()].sort((a, b) => b.due - a.due)
          return (
            <div className="mb-6">
              <h2 className="text-sm font-bold mb-2 text-slate-700">Dettes par fournisseur</h2>
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-left">
                    <th className="py-1.5 font-bold">Fournisseur</th>
                    <th className="py-1.5 font-bold text-center">Cmd</th>
                    <th className="py-1.5 font-bold text-right">Total commandé</th>
                    <th className="py-1.5 font-bold text-right">Payé</th>
                    <th className="py-1.5 font-bold text-right">Reste dû</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.map((d) => (
                    <tr key={d.name} className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold">{d.name}</td>
                      <td className="py-1.5 text-center">{d.count}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatFcfa(d.total)}</td>
                      <td className="py-1.5 text-right tabular-nums text-emerald-700">{formatFcfa(d.paid)}</td>
                      <td className={`py-1.5 text-right tabular-nums font-bold ${d.due > 0 ? 'text-red-600' : 'text-slate-400'}`}>{formatFcfa(d.due)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-800 font-extrabold">
                    <td className="py-2">TOTAL</td>
                    <td className="py-2 text-center">{rows.length}</td>
                    <td className="py-2 text-right tabular-nums">{formatFcfa(grandTotal)}</td>
                    <td className="py-2 text-right tabular-nums text-emerald-700">{formatFcfa(grandPaid)}</td>
                    <td className="py-2 text-right tabular-nums text-red-600">{formatFcfa(grandDue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        })()}

        {/* Section 2 — Orders detail */}
        <div>
          <h2 className="text-sm font-bold mb-2 text-slate-700">Détail des commandes ({rows.length})</h2>
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-left">
                <th className="py-1.5 font-bold">Référence</th>
                <th className="py-1.5 font-bold">Fournisseur</th>
                <th className="py-1.5 font-bold">Date</th>
                <th className="py-1.5 font-bold">Statut</th>
                <th className="py-1.5 font-bold text-right">Total</th>
                <th className="py-1.5 font-bold text-right">Payé</th>
                <th className="py-1.5 font-bold text-right">Reste dû</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ order, paid, due }) => (
                <tr key={order.id} className="border-b border-slate-100">
                  <td className="py-1.5 font-mono font-semibold">{order.reference}</td>
                  <td className="py-1.5">{order.supplierName ?? '—'}</td>
                  <td className="py-1.5">{formatDate(order.orderDate)}</td>
                  <td className="py-1.5">{STATUS_BADGE[order.status].label}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatFcfa(order.totalCostFcfa)}</td>
                  <td className="py-1.5 text-right tabular-nums text-emerald-700">{formatFcfa(paid)}</td>
                  <td className={`py-1.5 text-right tabular-nums font-bold ${due > 0 ? 'text-red-600' : 'text-slate-400'}`}>{formatFcfa(due)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-800 font-extrabold">
                <td className="py-2" colSpan={4}>TOTAL ({rows.length} commande{rows.length !== 1 ? 's' : ''})</td>
                <td className="py-2 text-right tabular-nums">{formatFcfa(grandTotal)}</td>
                <td className="py-2 text-right tabular-nums text-emerald-700">{formatFcfa(grandPaid)}</td>
                <td className="py-2 text-right tabular-nums text-red-600">{formatFcfa(grandDue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function OrdersSection() {
  const dataVersion = useAppStore((s) => s.dataVersion)
  const [orders, setOrders]   = useState<EnrichedPurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null)
  const [dateFrom, setDateFrom]             = useState('')
  const [dateTo, setDateTo]                 = useState('')

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.api.purchaseOrders.getAllEnriched()
      setOrders(data as EnrichedPurchaseOrder[])
    } catch { setOrders([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders, dataVersion])

  // Date range filter applies to BOTH the debt panel and the table.
  // Single day = set Du and Au to the same date.
  const dateFiltered = orders.filter((o) => {
    const d = o.orderDate.slice(0, 10)
    if (dateFrom && d < dateFrom) return false
    if (dateTo && d > dateTo) return false
    return true
  })

  return (
    <div className="flex flex-col gap-5">
      <SupplierDebtPanel
        orders={dateFiltered}
        loading={loading}
        selected={supplierFilter}
        onSelect={setSupplierFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />
      <OrdersExcelTable
        orders={dateFiltered}
        loading={loading}
        supplierFilter={supplierFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </div>
  )
}

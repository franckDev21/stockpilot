import { useState, useEffect } from 'react'
import { CreditCard } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button }           from '@/components/ui/Button'
import { Badge }            from '@/components/ui/Badge'
import { StatusBar, type StatusStep } from '@/components/ui/StatusBar'
import { useAppStore }      from '@/store/app.store'
import { useSuppliers }     from '@/hooks/useSuppliers'
import { useProducts }      from '@/hooks/useProducts'
import { formatFcfa, formatDate } from '@/lib/utils'

const ORDER_STEPS: StatusStep[] = [
  { key: 'draft',     label: 'Brouillon'  },
  { key: 'confirmed', label: 'Confirmée'  },
  { key: 'partial',   label: 'Partielle'  },
  { key: 'complete',  label: 'Complète'   },
]

interface OrderWithDetail {
  id: string; reference: string; supplierId: string; orderDate: string; status: string
  totalCostFcfa: number; productCostFcfa: number; freightCostFcfa: number; customsCostFcfa: number; otherCostsFcfa: number; notes: string | null
  items:    Array<{ id: string; productId: string; cartonsOrdered: number; pairsPerCarton: number; unitCostPerCartonFcfa: number }>
  payments: Array<{ id: string; amountFcfa: number; paymentDate: string; type: string }>
}


export function OrderDetail({ id }: { id: string }) {
  const [order, setOrder]   = useState<OrderWithDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const { openDrawer }      = useAppStore()
  const { suppliers }       = useSuppliers()
  const { products }        = useProducts()

  useEffect(() => {
    setLoading(true)
    window.api.purchaseOrders.getById(id)
      .then((d) => setOrder(d as OrderWithDetail))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!order)  return <div className="empty-state"><p className="text-slate-500">Commande introuvable</p></div>

  const supplier   = suppliers.find((s) => s.id === order.supplierId)
  const totalPaid  = order.payments.reduce((s, p) => s + p.amountFcfa, 0)
  const remaining  = order.totalCostFcfa - totalPaid

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">
      <Card>
        <CardHeader
          title={`Commande ${order.reference}`}
          subtitle={formatDate(order.orderDate)}
          action={
            <div className="flex items-center gap-2">
              {order.status === 'cancelled' && <Badge color="red" dot>Annulée</Badge>}
              {order.status !== 'cancelled' && (
                <Button size="sm" onClick={() => openDrawer('pay-order', order)}>
                  <CreditCard className="w-3.5 h-3.5 mr-1" />Payer
                </Button>
              )}
            </div>
          }
        />
        {order.status !== 'cancelled' && (
          <StatusBar steps={ORDER_STEPS} current={order.status} />
        )}
        <div className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fournisseur</p>
            <p className="font-semibold text-slate-800">{supplier?.name ?? '—'}</p>
            {supplier?.country && <p className="text-xs text-slate-400 mt-0.5">{[supplier.city, supplier.country].filter(Boolean).join(', ')}</p>}
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Produits</span><span className="font-semibold tabular-nums">{formatFcfa(order.productCostFcfa)}</span></div>
            {order.freightCostFcfa > 0 && <div className="flex justify-between"><span className="text-slate-400">Transport</span><span className="font-semibold tabular-nums">{formatFcfa(order.freightCostFcfa)}</span></div>}
            {order.customsCostFcfa > 0 && <div className="flex justify-between"><span className="text-slate-400">Douane</span><span className="font-semibold tabular-nums">{formatFcfa(order.customsCostFcfa)}</span></div>}
            {order.otherCostsFcfa  > 0 && <div className="flex justify-between"><span className="text-slate-400">Autres</span><span className="font-semibold tabular-nums">{formatFcfa(order.otherCostsFcfa)}</span></div>}
            <div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-slate-900"><span>Total</span><span className="tabular-nums">{formatFcfa(order.totalCostFcfa)}</span></div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Payé</p>
            <p className="text-xl font-bold text-emerald-700 tabular-nums">{formatFcfa(totalPaid)}</p>
            <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-32">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(100, order.totalCostFcfa > 0 ? (totalPaid/order.totalCostFcfa)*100 : 0)}%` }} />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reste dû</p>
            <p className={`text-xl font-bold ${remaining > 0 ? 'text-blue-700' : 'text-emerald-600'}`}>{remaining > 0 ? formatFcfa(remaining) : 'Soldé'}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="Produits commandés" subtitle={`${order.items.length} ligne(s)`} />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Produit</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Cartons</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Paires/ctn</th>
                <th className="text-right px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Coût/ctn</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const p = products.find((pr) => pr.id === item.productId)
                return (
                  <tr key={item.id} className="table-row-hover">
                    <td className="px-5 py-3 font-medium text-slate-800">{p?.name ?? item.productId}</td>
                    <td className="px-3 py-3 text-center text-slate-600">{item.cartonsOrdered}</td>
                    <td className="px-3 py-3 text-center text-slate-600">{item.pairsPerCarton}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700">{formatFcfa(item.unitCostPerCartonFcfa)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader title="Paiements effectués" subtitle={`${order.payments.length} paiement(s)`} />
          {order.payments.length === 0 ? (
            <div className="empty-state py-10">
              <div className="empty-state-icon"><CreditCard className="w-5 h-5 text-slate-300" /></div>
              <p className="text-sm text-slate-500">Aucun paiement</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Montant</th>
                </tr>
              </thead>
              <tbody>
                {order.payments.map((p) => (
                  <tr key={p.id} className="table-row-hover">
                    <td className="px-5 py-3 text-slate-600">{formatDate(p.paymentDate)}</td>
                    <td className="px-5 py-3 text-slate-600 capitalize">{p.type}</td>
                    <td className="px-5 py-3 text-right font-bold text-emerald-700 tabular-nums">{formatFcfa(p.amountFcfa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  )
}

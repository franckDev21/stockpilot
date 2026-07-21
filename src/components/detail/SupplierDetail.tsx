import { useState, useEffect } from 'react'
import { Phone, Mail, MapPin, Globe, ShoppingCart } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge }            from '@/components/ui/Badge'
import { Button }           from '@/components/ui/Button'
import { useAppStore }      from '@/store/app.store'
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders'
import { formatFcfa, formatDate } from '@/lib/utils'
import type { Supplier, PurchaseOrder } from '@/types/domain'

const STATUS_BADGE: Record<PurchaseOrder['status'], { label: string; color: 'slate' | 'blue' | 'amber' | 'green' | 'red' }> = {
  draft:     { label: 'Brouillon',  color: 'slate' },
  confirmed: { label: 'Confirmée', color: 'blue'  },
  partial:   { label: 'Partielle', color: 'amber' },
  complete:  { label: 'Complète',  color: 'green' },
  cancelled: { label: 'Annulée',   color: 'red'   },
}

export function SupplierDetail({ id }: { id: string }) {
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading]   = useState(true)
  const { openDrawer, openDetail } = useAppStore()
  const { orders }              = usePurchaseOrders()

  useEffect(() => {
    setLoading(true)
    window.api.suppliers.getById(id)
      .then((d) => setSupplier(d as Supplier))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const supplierOrders = orders.filter((o) => o.supplierId === id)
  const totalOrdered   = supplierOrders.reduce((s, o) => s + o.totalCostFcfa, 0)

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!supplier) return (
    <div className="empty-state"><p className="text-slate-500">Fournisseur introuvable</p></div>
  )

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">
      <Card>
        <CardHeader
          title={supplier.name}
          subtitle="Fiche fournisseur"
          action={<Button size="sm" onClick={() => openDrawer('edit-supplier', supplier)}>Modifier</Button>}
        />
        <div className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Localisation</p>
            {(supplier.city || supplier.country) ? (
              <div className="flex items-center gap-2 text-slate-600 mb-1">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                {[supplier.city, supplier.country].filter(Boolean).join(', ')}
              </div>
            ) : <span className="text-slate-300">—</span>}
            {supplier.address && (
              <div className="flex items-start gap-2 text-slate-500 text-xs mt-1">
                <MapPin className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />{supplier.address}
              </div>
            )}
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Contact</p>
            {supplier.phone && (
              <div className="flex items-center gap-2 text-slate-600 mb-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />{supplier.phone}
              </div>
            )}
            {supplier.whatsapp && (
              <div className="flex items-center gap-2 text-slate-600 mb-1">
                <Phone className="w-3.5 h-3.5 text-green-400" />WhatsApp: {supplier.whatsapp}
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="w-3.5 h-3.5 text-slate-400" />{supplier.email}
              </div>
            )}
            {!supplier.phone && !supplier.whatsapp && !supplier.email && (
              <span className="text-slate-300">—</span>
            )}
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Commandes</p>
            <p className="text-xl font-bold text-slate-900">{supplierOrders.length}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total commandé</p>
            <p className="text-xl font-bold text-slate-900">{formatFcfa(totalOrdered)}</p>
          </div>
        </div>
        {supplier.notes && (
          <div className="px-5 pb-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notes</p>
            <p className="text-sm text-slate-600">{supplier.notes}</p>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Commandes fournisseur"
          subtitle={`${supplierOrders.length} commande(s)`}
          action={<Button size="sm" onClick={() => openDrawer('create-order')}>+ Nouvelle commande</Button>}
        />
        {supplierOrders.length === 0 ? (
          <div className="empty-state py-10">
            <div className="empty-state-icon"><ShoppingCart className="w-5 h-5 text-slate-300" /></div>
            <p className="text-sm text-slate-500">Aucune commande pour ce fournisseur</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Réf.</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Statut</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Coût total</th>
                </tr>
              </thead>
              <tbody>
                {supplierOrders.map((o) => {
                  const badge = STATUS_BADGE[o.status]
                  return (
                    <tr key={o.id} className="table-row-hover group border-b border-slate-50 last:border-0 cursor-pointer"
                        onClick={() => openDetail('order', o.id)}>
                      <td className="px-5 py-3.5"><span className="ref-badge">{o.reference}</span></td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">{formatDate(o.orderDate)}</td>
                      <td className="px-5 py-3.5"><Badge color={badge.color} dot>{badge.label}</Badge></td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-800 tabular-nums">{formatFcfa(o.totalCostFcfa)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="table-footer flex justify-between">
              <span>{supplierOrders.length} commande{supplierOrders.length > 1 ? 's' : ''}</span>
              <span className="font-bold text-slate-800 tabular-nums">{formatFcfa(totalOrdered)}</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Truck, TrendingUp, Package, DollarSign } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge }            from '@/components/ui/Badge'
import { useWarehouses }    from '@/hooks/useWarehouses'
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders'
import { formatFcfa, formatDate } from '@/lib/utils'

interface EnrichedReceptionItem {
  id:                    string
  receptionId:           string
  orderItemId:           string
  cartonsReceived:       number
  productId:             string
  productName:           string
  productReference:      string
  unitCostPerCartonFcfa: number
  pairsPerCarton:        number
  sellingPricePerCarton: number
}

interface ReceptionWithItems {
  id:            string
  orderId:       string
  warehouseId:   string
  receptionDate: string
  notes:         string | null
  items:         EnrichedReceptionItem[]
}

export function ReceptionDetail({ id }: { id: string }) {
  const [reception, setReception] = useState<ReceptionWithItems | null>(null)
  const [loading, setLoading]     = useState(true)
  const { warehouses }            = useWarehouses()
  const { orders }                = usePurchaseOrders()

  useEffect(() => {
    setLoading(true)
    window.api.receptions.getById(id)
      .then((d) => setReception(d as ReceptionWithItems))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!reception) return (
    <div className="empty-state"><p className="text-slate-500">Réception introuvable</p></div>
  )

  const order        = orders.find((o) => o.id === reception.orderId)
  const warehouse    = warehouses.find((w) => w.id === reception.warehouseId)
  const totalCartons = reception.items.reduce((s, i) => s + i.cartonsReceived, 0)
  const coutTotal    = reception.items.reduce((s, i) => s + i.cartonsReceived * i.unitCostPerCartonFcfa, 0)
  const caEstime     = reception.items.reduce((s, i) => s + i.cartonsReceived * i.sellingPricePerCarton, 0)
  const benefice     = caEstime - coutTotal
  const margePct     = coutTotal > 0 ? Math.round((benefice / coutTotal) * 100) : null
  const hasPrice     = reception.items.some((i) => i.sellingPricePerCarton > 0)

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">

      {/* ── En-tête ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Réception fournisseur"
          subtitle={formatDate(reception.receptionDate)}
          action={<Badge color="blue" dot>Reçu</Badge>}
        />
        <div className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Commande d'origine</p>
            <span className="ref-badge">{order?.reference ?? '—'}</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Destination</p>
            <p className="font-semibold text-slate-800 dark:text-slate-200">{warehouse?.name ?? '—'}</p>
            {warehouse && (
              <Badge color={warehouse.type === 'warehouse' ? 'purple' : 'blue'} className="mt-1">
                {warehouse.type === 'warehouse' ? 'Entrepôt' : 'Boutique'}
              </Badge>
            )}
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cartons reçus</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{totalCartons}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Produits distincts</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{reception.items.length}</p>
          </div>
          {reception.notes && (
            <div className="col-span-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notes</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{reception.notes}</p>
            </div>
          )}
        </div>
      </Card>

      {/* ── KPIs financiers ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500">
              <Package className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Coût total</p>
          </div>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{formatFcfa(coutTotal)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{totalCartons} cartons × prix d'achat</p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-md ${hasPrice ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
              <DollarSign className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">CA estimé</p>
          </div>
          {hasPrice ? (
            <>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatFcfa(caEstime)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Si tout est vendu</p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-slate-400">—</p>
              <p className="text-xs text-slate-400 mt-0.5">Prix de vente non renseigné</p>
            </>
          )}
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-md ${hasPrice && benefice > 0 ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Bénéfice brut</p>
          </div>
          {hasPrice ? (
            <>
              <p className={`text-xl font-bold tabular-nums ${benefice >= 0 ? 'text-primary-700 dark:text-primary-400' : 'text-red-600'}`}>
                {formatFcfa(benefice)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">CA − coût d'achat</p>
            </>
          ) : (
            <p className="text-xl font-bold text-slate-400">—</p>
          )}
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-md ${margePct !== null && margePct > 0 ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Marge</p>
          </div>
          {margePct !== null ? (
            <>
              <p className={`text-xl font-bold tabular-nums ${margePct >= 0 ? 'text-amber-700 dark:text-amber-400' : 'text-red-600'}`}>
                {margePct} %
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Bénéfice / coût</p>
            </>
          ) : (
            <p className="text-xl font-bold text-slate-400">—</p>
          )}
        </div>
      </div>

      {/* ── Tableau articles ─────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Articles reçus"
          subtitle={`${reception.items.length} produit${reception.items.length > 1 ? 's' : ''} · ${totalCartons} carton${totalCartons > 1 ? 's' : ''}`}
        />
        {reception.items.length === 0 ? (
          <div className="empty-state py-10">
            <div className="empty-state-icon"><Truck className="w-5 h-5 text-slate-300" /></div>
            <p className="text-sm text-slate-500">Aucun article enregistré</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Produit</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Cartons</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Coût/carton</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Prix vente/ctn</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">CA estimé</th>
                </tr>
              </thead>
              <tbody>
                {reception.items.map((item) => {
                  const itemCa = item.cartonsReceived * item.sellingPricePerCarton
                  return (
                    <tr key={item.id} className="table-row-hover">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{item.productName}</div>
                        <span className="ref-badge mt-0.5 inline-block">{item.productReference}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{item.cartonsReceived}</span>
                        <span className="text-xs text-slate-400 ml-1">ctn</span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-600 dark:text-slate-300 tabular-nums">
                        {formatFcfa(item.unitCostPerCartonFcfa)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {item.sellingPricePerCarton > 0
                          ? <span className="text-emerald-700 dark:text-emerald-400 font-medium">{formatFcfa(item.sellingPricePerCarton)}</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums font-bold">
                        {itemCa > 0
                          ? <span className="text-slate-800 dark:text-slate-200">{formatFcfa(itemCa)}</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="table-footer flex justify-between items-center">
              <span>{totalCartons} carton{totalCartons > 1 ? 's' : ''}</span>
              {hasPrice && (
                <div className="flex items-center gap-4">
                  <span className="text-slate-400">Coût : <span className="font-bold text-slate-700 dark:text-slate-200">{formatFcfa(coutTotal)}</span></span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">CA estimé : {formatFcfa(caEstime)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

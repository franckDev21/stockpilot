import { useState, useEffect, useMemo } from 'react'
import { ArrowRight, Package } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge }            from '@/components/ui/Badge'
import { useWarehouses }    from '@/hooks/useWarehouses'
import { useProducts }      from '@/hooks/useProducts'
import { formatDate, pairsToCartons } from '@/lib/utils'

interface TransferItem { id: string; transferId: string; productId: string; size: string; pairsCount: number }
interface TransferWithItems {
  id:               string
  fromWarehouseId:  string
  toWarehouseId:    string
  transferDate:     string
  notes:            string | null
  items:            TransferItem[]
}

interface ProductGroup {
  productId:     string
  name:          string
  reference:     string
  totalCartons:  number
  sizes:         { size: string; cartons: number }[]
}

export function TransferDetail({ id }: { id: string }) {
  const [transfer, setTransfer] = useState<TransferWithItems | null>(null)
  const [loading, setLoading]   = useState(true)
  const { warehouses }          = useWarehouses()
  const { products }            = useProducts()

  useEffect(() => {
    setLoading(true)
    window.api.transfers.getById(id)
      .then((d) => setTransfer(d as TransferWithItems))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const grouped = useMemo<ProductGroup[]>(() => {
    if (!transfer) return []
    const map = new Map<string, ProductGroup>()
    for (const item of transfer.items) {
      const p   = products.find((pr) => pr.id === item.productId)
      const ppc = p?.pairsPerCarton ?? 12
      const ctn = pairsToCartons(item.pairsCount, ppc)
      if (!map.has(item.productId)) {
        map.set(item.productId, {
          productId:    item.productId,
          name:         p?.name      ?? item.productId,
          reference:    p?.reference ?? '',
          totalCartons: 0,
          sizes:        [],
        })
      }
      const g = map.get(item.productId)!
      g.totalCartons += ctn
      g.sizes.push({ size: item.size, cartons: ctn })
    }
    return Array.from(map.values())
  }, [transfer, products])

  const totalCartons = grouped.reduce((s, g) => s + g.totalCartons, 0)

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!transfer) return (
    <div className="empty-state"><p className="text-slate-500">Transfert introuvable</p></div>
  )

  const fromWh = warehouses.find((w) => w.id === transfer.fromWarehouseId)
  const toWh   = warehouses.find((w) => w.id === transfer.toWarehouseId)

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">
      <Card>
        <CardHeader title="Transfert de stock" subtitle={formatDate(transfer.transferDate)} />
        <div className="px-5 py-4 flex items-center gap-6 text-sm">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">De</p>
            <Badge color="purple">{fromWh?.name ?? '—'}</Badge>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-300 mt-3" />
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Vers</p>
            <Badge color="blue">{toWh?.name ?? '—'}</Badge>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total cartons</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{totalCartons.toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-400">ctn</span></p>
          </div>
        </div>
        {transfer.notes && (
          <div className="px-5 pb-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notes</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{transfer.notes}</p>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Articles transférés" subtitle={`${grouped.length} produit${grouped.length > 1 ? 's' : ''} · ${totalCartons} carton${totalCartons > 1 ? 's' : ''}`} />
        {grouped.length === 0 ? (
          <div className="empty-state py-10">
            <div className="empty-state-icon"><Package className="w-5 h-5 text-slate-300" /></div>
            <p className="text-sm text-slate-500">Aucun article enregistré</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Produit</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Tailles (cartons)</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Cartons</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((g) => (
                  <tr key={g.productId} className="table-row-hover border-b border-slate-50 dark:border-slate-800 last:border-0">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{g.name}</div>
                      {g.reference && <div className="text-xs text-slate-400">{g.reference}</div>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {g.sizes.map(({ size, cartons }) => (
                          <span key={size} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-medium text-slate-600 dark:text-slate-300">
                            {size}
                            <span className="text-slate-400">·</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{cartons}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{g.totalCartons}</span>
                      <span className="text-xs text-slate-400 ml-1">ctn</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-footer text-right font-bold text-slate-800 dark:text-slate-200">{totalCartons} carton{totalCartons > 1 ? 's' : ''} au total</div>
          </div>
        )}
      </Card>
    </div>
  )
}

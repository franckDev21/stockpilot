import { useState, useEffect, useMemo } from 'react'
import { Store, Package, MapPin } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge }            from '@/components/ui/Badge'
import { useWarehouses }    from '@/hooks/useWarehouses'
import { useProducts }      from '@/hooks/useProducts'
import { useAppStore }      from '@/store/app.store'
import { pairsToCartons, parseProductImages } from '@/lib/utils'
import type { StockEntry } from '@/types/domain'

export function WarehouseDetail({ id }: { id: string }) {
  const { warehouses }  = useWarehouses()
  const { products }    = useProducts()
  const dataVersion     = useAppStore((s) => s.dataVersion)
  const [stock, setStock]     = useState<StockEntry[]>([])
  const [loading, setLoading] = useState(true)

  const warehouse = warehouses.find((w) => w.id === id)

  useEffect(() => {
    setLoading(true)
    window.api.stock.getCurrent(id)
      .then((d) => setStock(d as StockEntry[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id, dataVersion])

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  // Group by product, sum pairs per product
  const byProduct = useMemo(() => {
    const map = new Map<string, { totalPairs: number; sizes: Record<string, number> }>()
    for (const e of stock) {
      if (!map.has(e.productId)) map.set(e.productId, { totalPairs: 0, sizes: {} })
      const g = map.get(e.productId)!
      g.totalPairs += e.totalPairs
      g.sizes[e.size] = (g.sizes[e.size] ?? 0) + e.totalPairs
    }
    return Array.from(map.entries())
      .filter(([, g]) => g.totalPairs > 0)
      .map(([productId, g]) => ({ productId, ...g }))
      .sort((a, b) => {
        const na = productMap.get(a.productId)?.name ?? ''
        const nb = productMap.get(b.productId)?.name ?? ''
        return na.localeCompare(nb, 'fr')
      })
  }, [stock, productMap])

  const totalCartons = byProduct.reduce((s, g) => {
    const ppc = productMap.get(g.productId)?.pairsPerCarton ?? 12
    return s + pairsToCartons(g.totalPairs, ppc)
  }, 0)

  if (!warehouse) return (
    <div className="empty-state"><p className="text-slate-500">Boutique introuvable</p></div>
  )

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">

      {/* ── En-tête ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={warehouse.name}
          subtitle={warehouse.type === 'warehouse' ? 'Entrepôt central' : 'Boutique de vente'}
          action={
            <Badge color={warehouse.type === 'warehouse' ? 'purple' : 'blue'}>
              {warehouse.type === 'warehouse' ? 'Entrepôt' : 'Boutique'}
            </Badge>
          }
        />
        <div className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
          {warehouse.address && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Adresse</p>
                <p className="text-slate-700 dark:text-slate-300">{warehouse.address}</p>
              </div>
            </div>
          )}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stock total</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {totalCartons}
              <span className="text-sm font-medium text-slate-400 ml-1">cartons</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Références en stock</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {byProduct.length}
              <span className="text-sm font-medium text-slate-400 ml-1">produits</span>
            </p>
          </div>
        </div>
      </Card>

      {/* ── Stock par produit ────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Stock actuel"
          subtitle={`${byProduct.length} produit${byProduct.length > 1 ? 's' : ''} · ${totalCartons} carton${totalCartons > 1 ? 's' : ''}`}
        />
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : byProduct.length === 0 ? (
          <div className="empty-state py-10">
            <div className="empty-state-icon"><Package className="w-6 h-6 text-slate-300" /></div>
            <p className="text-sm text-slate-500">Aucun stock dans cette boutique</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="px-5 py-3 w-12" />
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Produit</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Tailles</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Cartons</th>
                </tr>
              </thead>
              <tbody>
                {byProduct.map((g) => {
                  const p       = productMap.get(g.productId)
                  const ppc     = p?.pairsPerCarton ?? 12
                  const cartons = pairsToCartons(g.totalPairs, ppc)
                  const sortedSizes = Object.entries(g.sizes)
                    .filter(([, qty]) => qty > 0)
                    .sort(([a], [b]) => {
                      const na = parseFloat(a), nb = parseFloat(b)
                      return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb
                    })
                  return (
                    <tr key={g.productId} className="table-row-hover">
                      <td className="px-5 py-2.5">
                        {parseProductImages(p?.imageData)[0] ? (
                          <img src={parseProductImages(p?.imageData)[0]} alt={p?.name} className="w-9 h-9 object-cover rounded-md border border-slate-100" />
                        ) : (
                          <div className="w-9 h-9 rounded-md bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                            <Store className="w-4 h-4 text-slate-300" />
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{p?.name ?? g.productId}</div>
                        <span className="ref-badge">{p?.reference}</span>
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {sortedSizes.map(([size, qty]) => (
                            <span key={size} className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              {size}·{qty}p
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{cartons}</span>
                        <span className="text-xs text-slate-400 ml-1">ctn</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="table-footer text-right font-bold text-slate-700 dark:text-slate-200">
              {totalCartons} carton{totalCartons > 1 ? 's' : ''} au total
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

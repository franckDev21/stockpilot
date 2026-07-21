import { useState, useEffect, useMemo } from 'react'
import { Package, TrendingUp, TrendingDown, ArrowRightLeft, Truck, Pencil, ChevronLeft, ChevronRight, Box } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button }           from '@/components/ui/Button'
import { Badge }            from '@/components/ui/Badge'
import { TableCard }        from '@/components/ui/TableCard'
import { useAppStore }      from '@/store/app.store'
import { useWarehouses }    from '@/hooks/useWarehouses'
import { formatFcfa, formatDate, parseProductImages, pairsToCartons } from '@/lib/utils'

interface Product {
  id: string; reference: string; name: string; brand: string | null
  category: string | null; description: string | null; imageData: string | null
  pairsPerCarton: number; alertThreshold: number; createdAt: string
}

interface Movement {
  id: string; warehouseId: string; size: string; quantity: number
  movementType: string; referenceId: string | null; referenceType: string | null
  unitCostFcfa: number | null; movementDate: string; notes: string | null
}

interface StockEntry {
  productId: string; warehouseId: string; size: string; totalPairs: number
}

const MOVEMENT_LABEL: Record<string, string> = {
  reception:    'Réception',
  transfer_in:  'Transfert entrant',
  transfer_out: 'Transfert sortant',
  sale:         'Vente',
  adjustment:   'Ajustement',
  loss:         'Perte',
}

const MOVEMENT_COLOR: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'slate'> = {
  reception:    'green',
  transfer_in:  'blue',
  transfer_out: 'amber',
  sale:         'red',
  adjustment:   'slate',
  loss:         'red',
}

function MovementIcon({ type }: { type: string }) {
  const cls = 'w-3.5 h-3.5'
  switch (type) {
    case 'reception':    return <Truck className={cls} />
    case 'transfer_in':  return <TrendingUp className={cls} />
    case 'transfer_out': return <ArrowRightLeft className={cls} />
    case 'sale':         return <TrendingDown className={cls} />
    default:             return <Package className={cls} />
  }
}

// ── Image gallery ──────────────────────────────────────────────────────────────

function ImageGallery({ images, productName }: { images: string[]; productName: string }) {
  const [current, setCurrent] = useState(0)

  if (images.length === 0) {
    return (
      <div className="w-full aspect-[4/3] rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
        <div className="flex flex-col items-center gap-2">
          <Package className="w-16 h-16 text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-400">Aucune photo</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Large view */}
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
        <img
          src={images[current]}
          alt={`${productName} — photo ${current + 1}`}
          className="w-full h-full object-contain"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={() => setCurrent((c) => (c - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrent((c) => (c + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-white scale-125' : 'bg-white/50'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                i === current
                  ? 'border-primary-500 opacity-100'
                  : 'border-transparent opacity-60 hover:opacity-90'
              }`}
            >
              <img src={src} alt={`Miniature ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

type ProductsApiExtended = typeof window.api.products & {
  getCartonStats: (id: string) => Promise<{ totalCartons: number; totalPairsFromCartons: number }>
}

export function ProductDetail({ id }: { id: string }) {
  const [product,      setProduct]      = useState<Product | null>(null)
  const [movements,    setMovements]    = useState<Movement[]>([])
  const [stock,        setStock]        = useState<StockEntry[]>([])
  const [cartonStats,  setCartonStats]  = useState<{ totalCartons: number; totalPairsFromCartons: number } | null>(null)
  const [loading,      setLoading]      = useState(true)

  const { openDrawer, openDetail } = useAppStore()
  const { warehouses }             = useWarehouses()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      window.api.products.getById(id),
      window.api.stock.getMovements(id),
      window.api.stock.getCurrent(),
      (window.api.products as ProductsApiExtended).getCartonStats(id),
    ])
      .then(([p, m, s, c]) => {
        setProduct(p as Product)
        setMovements((m as Movement[]).sort((a, b) =>
          new Date(b.movementDate).getTime() - new Date(a.movementDate).getTime(),
        ))
        setStock((s as StockEntry[]).filter((e) => e.productId === id))
        setCartonStats(c as { totalCartons: number; totalPairsFromCartons: number })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const images = useMemo(() => product ? parseProductImages(product.imageData) : [], [product])

  const stockByWarehouse = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of stock) {
      map.set(e.warehouseId, (map.get(e.warehouseId) ?? 0) + e.totalPairs)
    }
    return map
  }, [stock])

  const ppc = product?.pairsPerCarton ?? 12

  const totalStockPairs = useMemo(() =>
    Array.from(stockByWarehouse.values()).reduce((s, n) => s + n, 0),
  [stockByWarehouse])

  const totalStock = useMemo(() => pairsToCartons(totalStockPairs, ppc), [totalStockPairs, ppc])

  const totalSold = useMemo(() =>
    pairsToCartons(movements.filter((m) => m.movementType === 'sale').reduce((s, m) => s + Math.abs(m.quantity), 0), ppc),
  [movements, ppc])

  const totalReceived = useMemo(() =>
    pairsToCartons(movements.filter((m) => m.movementType === 'reception').reduce((s, m) => s + m.quantity, 0), ppc),
  [movements, ppc])

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!product) return <div className="empty-state"><p className="text-slate-500">Produit introuvable</p></div>

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto">

      {/* ── Fiche produit principale ────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={product.name}
          subtitle={`Réf. ${product.reference}`}
          action={
            <Button size="sm" variant="secondary" onClick={() => openDrawer('edit-product', product)}>
              <Pencil className="w-3.5 h-3.5 mr-1" />Modifier
            </Button>
          }
        />
        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Image gallery */}
          <ImageGallery images={images} productName={product.name} />

          {/* Infos détaillées */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Marque</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{product.brand ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Catégorie</p>
                {product.category
                  ? <Badge color="slate">{product.category}</Badge>
                  : <p className="text-slate-400">—</p>
                }
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Photos</p>
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  {images.length} photo{images.length > 1 ? 's' : ''}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ajouté le</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{formatDate(product.createdAt)}</p>
              </div>
            </div>

            {/* KPIs stock */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-3">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stock actuel</p>
                <p className={`text-2xl font-extrabold tabular-nums ${totalStock > 0 ? 'text-slate-900 dark:text-slate-100' : 'text-red-500'}`}>
                  {totalStock.toLocaleString('fr-FR')}
                </p>
                <p className="text-xs text-slate-400">cartons</p>
              </div>
              <div className="card p-3">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total reçu</p>
                <p className="text-2xl font-extrabold tabular-nums text-emerald-600">
                  {totalReceived.toLocaleString('fr-FR')}
                </p>
                <p className="text-xs text-slate-400">cartons</p>
              </div>
              <div className="card p-3">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total vendu</p>
                <p className="text-2xl font-extrabold tabular-nums text-primary-600">
                  {totalSold.toLocaleString('fr-FR')}
                </p>
                <p className="text-xs text-slate-400">cartons</p>
              </div>
              <div className="card p-3">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Seuil alerte</p>
                {product.alertThreshold > 0 ? (
                  <>
                    <p className={`text-2xl font-extrabold tabular-nums ${totalStock <= product.alertThreshold ? 'text-amber-500' : 'text-slate-700 dark:text-slate-300'}`}>
                      {product.alertThreshold}
                    </p>
                    <p className="text-xs text-slate-400">cartons</p>
                  </>
                ) : (
                  <p className="text-slate-400 text-sm">Non défini</p>
                )}
              </div>
            </div>

            {/* Cartons */}
            {cartonStats && cartonStats.totalCartons > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Box className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Cartons reçus (total)</p>
                  <p className="text-xl font-extrabold text-slate-800 dark:text-slate-200">
                    {cartonStats.totalCartons.toLocaleString('fr-FR')}
                    <span className="text-sm font-medium text-slate-400 ml-1.5">cartons</span>
                    <span className="text-xs text-slate-400 ml-2">= {cartonStats.totalPairsFromCartons.toLocaleString('fr-FR')} paires</span>
                  </p>
                </div>
              </div>
            )}

            {product.description && (
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Description</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{product.description}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── Stock par boutique ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {warehouses.map((wh) => {
          const pairs = stockByWarehouse.get(wh.id) ?? 0
          const qty   = pairsToCartons(pairs, ppc)
          const low   = product.alertThreshold > 0 && qty <= product.alertThreshold
          return (
            <div key={wh.id} className={`card p-4 ${low ? 'border-amber-200 dark:border-amber-700/50' : ''}`}>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1 truncate">{wh.name}</p>
              <Badge color={wh.type === 'warehouse' ? 'purple' : 'blue'} className="mb-2">{wh.type === 'warehouse' ? 'Entrepôt' : 'Boutique'}</Badge>
              <p className={`text-2xl font-extrabold tabular-nums ${qty === 0 ? 'text-slate-300 dark:text-slate-600' : low ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100'}`}>
                {qty}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">cartons</p>
              {low && qty > 0 && <p className="text-[10px] text-amber-500 font-semibold mt-1">⚠ Stock bas</p>}
            </div>
          )
        })}
      </div>

      {/* ── Répartition par taille ──────────────────────────────────────── */}
      {stock.length > 0 && (() => {
        const sizes = [...new Set(stock.map((e) => e.size))].sort((a, b) => {
          const na = parseFloat(a), nb = parseFloat(b)
          return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb
        })
        return (
          <Card>
            <CardHeader title="Répartition par taille" subtitle="Stock actuel toutes boutiques" />
            <div className="px-5 pb-5 flex flex-wrap gap-2">
              {sizes.map((sz) => {
                const qty = stock.filter((e) => e.size === sz).reduce((s, e) => s + e.totalPairs, 0)
                return (
                  <div key={sz} className={`flex flex-col items-center px-3 py-2.5 rounded-xl border text-center min-w-[56px] ${
                    qty === 0
                      ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700 opacity-50'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600'
                  }`}>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{sz}</span>
                    <span className={`text-lg font-extrabold tabular-nums mt-0.5 ${qty === 0 ? 'text-slate-300' : 'text-slate-900 dark:text-slate-100'}`}>{qty}</span>
                    <span className="text-[10px] text-slate-400">p</span>
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })()}

      {/* ── Historique mouvements ───────────────────────────────────────── */}
      <TableCard
        title="Historique des mouvements"
        subtitle="Entrées et sorties de stock"
        items={movements}
        loading={false}
        pageSize={10}
        filename={`mouvements-${product.reference}.pdf`}
        label="mouvements"
        emptyIcon={<Package className="w-6 h-6 text-slate-300" />}
        emptyText="Aucun mouvement enregistré"
      >
        {(slice) => (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Boutique</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Taille</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Qté</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest no-print">Coût/p</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest no-print">Référence</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((m) => {
                  const wh   = warehouses.find((w) => w.id === m.warehouseId)
                  const isIn = m.quantity > 0
                  return (
                    <tr key={m.id} className="table-row-hover group">
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(m.movementDate)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge color={MOVEMENT_COLOR[m.movementType] ?? 'slate'}>
                          <MovementIcon type={m.movementType} />
                          {MOVEMENT_LABEL[m.movementType] ?? m.movementType}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300 font-medium">
                        {wh?.name ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-medium text-slate-600 dark:text-slate-300">
                          {m.size}
                        </span>
                      </td>
                      <td className={`px-5 py-3 text-right font-bold tabular-nums ${isIn ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isIn ? '+' : ''}{m.quantity}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500 dark:text-slate-400 tabular-nums no-print">
                        {m.unitCostFcfa ? formatFcfa(m.unitCostFcfa) : '—'}
                      </td>
                      <td className="px-5 py-3 no-print">
                        {m.referenceId && m.referenceType ? (
                          <button
                            onClick={() => openDetail(m.referenceType!, m.referenceId!)}
                            className="text-xs text-primary-600 dark:text-primary-400 font-mono hover:underline"
                            title={`Voir ${m.referenceType}`}
                          >
                            {m.referenceId.slice(-10)}
                          </button>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </TableCard>

    </div>
  )
}

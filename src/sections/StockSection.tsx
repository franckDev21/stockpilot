import { useState, useMemo, useEffect, useId, useCallback } from 'react'
import {
  Package, Store, BarChart3, Pencil, Trash2, Eye, Search, AlertTriangle, TrendingDown, FileText, Loader2,
  LayoutGrid, List,
} from 'lucide-react'
import { TableCard }    from '@/components/ui/TableCard'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button }       from '@/components/ui/Button'
import { Badge }        from '@/components/ui/Badge'
import { Pagination }   from '@/components/ui/Pagination'
import { useAppStore }  from '@/store/app.store'
import { useProducts }  from '@/hooks/useProducts'
import { useWarehouses } from '@/hooks/useWarehouses'
import { useStock }     from '@/hooks/useStock'
import { usePagination } from '@/hooks/usePagination'
import { parseProductImages, pairsToCartons } from '@/lib/utils'
import { useSortable, SortIcon } from '@/hooks/useSortable'
import type { Product, Warehouse, StockForecastItem } from '@/types/domain'

// ─── Products ─────────────────────────────────────────────────────────────────

function ProductCard({ p, onDetail, onEdit, onDelete }: {
  p: Product
  onDetail: () => void
  onEdit:   () => void
  onDelete: () => void
}) {
  const img = parseProductImages(p.imageData)[0]
  return (
    <div className="group relative card overflow-hidden p-0 flex flex-col cursor-pointer hover:shadow-lg hover:shadow-slate-200/60 dark:hover:shadow-slate-900/40 transition-all duration-200">
      {/* Image zone */}
      <div
        className="relative w-full aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden"
        onClick={onDetail}
      >
        {img ? (
          <img src={img} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Package className="w-10 h-10 text-slate-300 dark:text-slate-600" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

        {/* Reference chip */}
        <div className="absolute top-2 left-2">
          <span className="ref-badge text-[10px]">{p.reference}</span>
        </div>

        {/* Alert badge */}
        {p.alertThreshold > 0 && (
          <div className="absolute top-2 right-2">
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/90 text-white text-[10px] font-bold rounded-md">
              <AlertTriangle className="w-2.5 h-2.5" />
              {p.alertThreshold}
            </span>
          </div>
        )}

        {/* Name overlay on image */}
        <div className="absolute bottom-2 left-2 right-2">
          <p className="text-white text-xs font-bold truncate drop-shadow">{p.name}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 flex flex-col gap-1.5 flex-1">
        {p.brand && (
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">{p.brand}</p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          {p.category && <Badge color="slate">{p.category}</Badge>}
          <span className="text-[11px] text-slate-400">{p.pairsPerCarton ?? 12} p/ctn</span>
        </div>
      </div>

      {/* Actions — appear on hover */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 px-2 py-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm
                      translate-y-full group-hover:translate-y-0 transition-transform duration-200 no-print border-t border-slate-100 dark:border-slate-700">
        <button onClick={onDetail} className="icon-btn" title="Voir fiche"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={onEdit}   className="icon-btn" title="Modifier"><Pencil className="w-3.5 h-3.5" /></button>
        <button onClick={onDelete} className="icon-btn icon-btn-danger" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}

function ProductsPanel() {
  const { openDrawer, openModal, openDetail } = useAppStore()
  const { products, loading, remove }         = useProducts()
  const [search, setSearch]                   = useState('')
  const [viewMode, setViewMode]               = useState<'table' | 'grid'>('grid')

  const { sort: pSort, toggle: pToggle, sortFn: pSortFn } = useSortable<'reference' | 'name' | 'brand' | 'category'>('name')

  const filtered = pSortFn(
    products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.reference.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.category ?? '').toLowerCase().includes(search.toLowerCase()),
    ),
    (p, k) => k === 'reference' ? p.reference : k === 'name' ? p.name : k === 'brand' ? (p.brand ?? '') : (p.category ?? ''),
  )

  const handleDelete = (p: Product) =>
    openModal('Supprimer ce produit ?',
      `"${p.name}" (${p.reference}) sera supprimé définitivement.`,
      () => remove(p.id),
    )

  const pageSize = viewMode === 'grid' ? 12 : 6

  return (
    <TableCard
      title="Catalogue produits"
      subtitle="Modèles de chaussures avec référence et seuil d'alerte"
      items={filtered}
      loading={loading}
      pageSize={pageSize}
      filename="produits.pdf"
      label="produits"
      action={
        <div className="flex items-center gap-2 no-print">
          {/* View toggle */}
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              title="Vue grille"
              className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-primary-500 text-white' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Vue tableau"
              className={`p-1.5 transition-colors ${viewMode === 'table' ? 'bg-primary-500 text-white' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
          <Button size="sm" onClick={() => openDrawer('create-product')}>+ Nouveau produit</Button>
        </div>
      }
      emptyIcon={<Package className="w-6 h-6 text-slate-300" />}
      emptyText={search ? 'Aucun résultat' : 'Aucun produit'}
      footer={
        <div className="table-footer">
          {filtered.length} produit{filtered.length > 1 ? 's' : ''}
          {search && products.length !== filtered.length && ` sur ${products.length}`}
        </div>
      }
      toolbar={
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Référence, nom, marque…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      }
    >
      {(slice) => viewMode === 'grid' ? (
        /* ── Grid view ─────────────────────────────── */
        <div className="px-4 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {(slice as Product[]).map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              onDetail={() => openDetail('product', p.id)}
              onEdit={() => openDrawer('edit-product', p)}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      ) : (
        /* ── Table view ────────────────────────────── */
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-14" />
                <th className="th-sortable text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest" onClick={() => pToggle('reference')}>
                  Référence<SortIcon active={pSort.key === 'reference'} dir={pSort.dir} />
                </th>
                <th className="th-sortable text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest" onClick={() => pToggle('name')}>
                  Modèle<SortIcon active={pSort.key === 'name'} dir={pSort.dir} />
                </th>
                <th className="th-sortable text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest" onClick={() => pToggle('brand')}>
                  Marque<SortIcon active={pSort.key === 'brand'} dir={pSort.dir} />
                </th>
                <th className="th-sortable text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest" onClick={() => pToggle('category')}>
                  Catégorie<SortIcon active={pSort.key === 'category'} dir={pSort.dir} />
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Config carton</th>
                <th className="px-5 py-3 w-20 no-print" />
              </tr>
            </thead>
            <tbody>
              {(slice as Product[]).map((p) => (
                <tr key={p.id} className="table-row-hover group">
                  <td className="px-5 py-2">
                    {parseProductImages(p.imageData)[0] ? (
                      <img src={parseProductImages(p.imageData)[0]} alt={p.name} className="w-16 h-16 object-cover rounded-lg border border-slate-100" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        <Package className="w-6 h-6 text-slate-300" />
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5"><span className="ref-badge">{p.reference}</span></td>
                  <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200">{p.name}</td>
                  <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{p.brand ?? <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-3.5">
                    {p.category ? <Badge color="slate">{p.category}</Badge> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-xs text-slate-500">{p.pairsPerCarton ?? 12} p/carton</div>
                    {p.alertThreshold > 0 ? (
                      <div className="flex items-center gap-1.5 text-amber-600 text-xs font-medium mt-0.5">
                        <AlertTriangle className="w-3.5 h-3.5" />{p.alertThreshold} cartons
                      </div>
                    ) : null}
                  </td>
                  <td className="px-5 py-3.5 no-print">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openDetail('product', p.id)} className="icon-btn" title="Voir historique stock">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openDrawer('edit-product', p)} className="icon-btn" title="Modifier">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(p)} className="icon-btn icon-btn-danger" title="Supprimer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TableCard>
  )
}

// ─── Warehouses ───────────────────────────────────────────────────────────────

const WAREHOUSE_TYPE_BADGE: Record<Warehouse['type'], { label: string; color: 'blue' | 'purple' }> = {
  warehouse: { label: 'Entrepôt central', color: 'purple' },
  boutique:  { label: 'Boutique',         color: 'blue'   },
}

function WarehousesPanel() {
  const { openDrawer, openModal, openDetail } = useAppStore()
  const { warehouses, loading, remove } = useWarehouses()

  const handleDelete = (w: Warehouse) =>
    openModal('Supprimer cette boutique ?',
      `"${w.name}" sera supprimée définitivement.`,
      () => remove(w.id),
    )

  return (
    <TableCard
      title="Boutiques & Entrepôts"
      subtitle="Points de stockage et de vente"
      items={warehouses}
      loading={loading}
      pageSize={6}
      filename="boutiques.pdf"
      label="boutiques"
      action={<Button size="sm" onClick={() => openDrawer('create-warehouse')}>+ Ajouter</Button>}
      emptyIcon={<Store className="w-6 h-6 text-slate-300" />}
      emptyText="Aucune boutique"
      footer={<div className="table-footer">{warehouses.length} boutique{warehouses.length > 1 ? 's' : ''}</div>}
    >
      {(slice) => (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Nom</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Adresse</th>
                <th className="px-5 py-3 w-20 no-print" />
              </tr>
            </thead>
            <tbody>
              {slice.map((w) => {
                const badge = WAREHOUSE_TYPE_BADGE[w.type]
                return (
                  <tr key={w.id} className="table-row-hover group">
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{w.name}</td>
                    <td className="px-5 py-3.5"><Badge color={badge.color}>{badge.label}</Badge></td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{w.address ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-3.5 no-print">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openDetail('warehouse', w.id)} className="icon-btn" title="Voir le stock">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => openDrawer('edit-warehouse', w)} className="icon-btn" title="Modifier">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(w)} className="icon-btn icon-btn-danger" title="Supprimer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </TableCard>
  )
}

// ─── Stock Levels ─────────────────────────────────────────────────────────────

function StockLevelsPanel() {
  const { entries, loading }    = useStock()
  const { products }            = useProducts()
  const { warehouses }          = useWarehouses()
  const { openDetail }          = useAppStore()
  const [search, setSearch]     = useState('')
  const [filterWh, setFilterWh] = useState<string>('all')
  const [printing, setPrinting] = useState(false)
  const printId                 = useId()

  const productMap   = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const warehouseMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses])

  type GroupKey = `${string}|${string}`
  type Group = { productId: string; warehouseId: string; sizes: Record<string, number>; total: number }

  const groups = useMemo<Group[]>(() => {
    const map = new Map<GroupKey, Group>()
    for (const e of entries) {
      if (filterWh !== 'all' && e.warehouseId !== filterWh) continue
      const key: GroupKey = `${e.productId}|${e.warehouseId}`
      if (!map.has(key)) map.set(key, { productId: e.productId, warehouseId: e.warehouseId, sizes: {}, total: 0 })
      const g = map.get(key)!
      g.sizes[e.size] = (g.sizes[e.size] ?? 0) + e.totalPairs
      g.total += e.totalPairs
    }
    return Array.from(map.values())
  }, [entries, filterWh])

  const filtered = useMemo(() => {
    if (!search) return groups
    const q = search.toLowerCase()
    return groups.filter((g) => {
      const p = productMap.get(g.productId)
      return p?.name.toLowerCase().includes(q) || p?.reference.toLowerCase().includes(q)
    })
  }, [groups, search, productMap])

  const { sort: sSort, toggle: sToggle, sortFn: sSortFn } = useSortable<'name' | 'warehouse' | 'total'>('name')

  const sortedFiltered = sSortFn(filtered, (g, k) => {
    if (k === 'name')      return productMap.get(g.productId)?.name ?? ''
    if (k === 'warehouse') return warehouseMap.get(g.warehouseId)?.name ?? ''
    if (k === 'total')     return pairsToCartons(g.total, productMap.get(g.productId)?.pairsPerCarton ?? 12)
    return ''
  })

  const totalCartons = sortedFiltered.reduce((s, g) => {
    const ppc = productMap.get(g.productId)?.pairsPerCarton ?? 12
    return s + pairsToCartons(g.total, ppc)
  }, 0)
  const lowCount = sortedFiltered.filter((g) => {
    const p   = productMap.get(g.productId)
    const ppc = p?.pairsPerCarton ?? 12
    return p && p.alertThreshold > 0 && pairsToCartons(g.total, ppc) <= p.alertThreshold
  }).length

  const { page, totalPages, slice: pagedGroups, goTo, total: filteredTotal } = usePagination(sortedFiltered, 6)

  const handlePrint = useCallback(async () => {
    if (printing) return
    setPrinting(true)
    try {
      const el = document.getElementById(printId)
      if (el) {
        el.classList.add('print-target')
        await window.api.print.toPDF({ filename: 'stock-temps-reel.pdf' })
        el.classList.remove('print-target')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setPrinting(false)
    }
  }, [printing, printId])

  const isEmpty = !loading && filtered.length === 0

  return (
    <Card id={printId}>
      <CardHeader
        title="Stock en temps réel"
        subtitle="Cartons disponibles par produit et boutique"
        action={
          <div className="flex items-center gap-3 no-print">
            {lowCount > 0 && (
              <div className="flex items-center gap-1.5 text-amber-600 text-xs font-semibold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                <TrendingDown className="w-3.5 h-3.5" />{lowCount} alerte{lowCount > 1 ? 's' : ''}
              </div>
            )}
            <span className="text-xs text-slate-400 font-medium">{totalCartons.toLocaleString('fr-FR')} cartons</span>
            {!isEmpty && (
              <button
                onClick={handlePrint}
                disabled={printing}
                title="Exporter en PDF"
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {printing ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                PDF
              </button>
            )}
          </div>
        }
      />

      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap no-print">
          <button
            onClick={() => setFilterWh('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${filterWh === 'all' ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            Tous
          </button>
          {warehouses.map((w) => (
            <button
              key={w.id}
              onClick={() => setFilterWh(w.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${filterWh === w.id ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {w.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isEmpty ? (
        <div className="empty-state">
          <div className="empty-state-icon"><BarChart3 className="w-6 h-6 text-slate-300" /></div>
          <p className="font-semibold text-slate-500">
            {entries.length === 0 ? 'Aucune donnée de stock' : 'Aucun résultat'}
          </p>
          <p className="text-xs text-slate-400 max-w-xs">
            {entries.length === 0
              ? 'Le stock apparaîtra ici après votre première réception fournisseur.'
              : 'Essayez un autre mot-clé ou changez de filtre.'}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 w-10" />
                  <th className="th-sortable text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest" onClick={() => sToggle('name')}>
                    Produit<SortIcon active={sSort.key === 'name'} dir={sSort.dir} />
                  </th>
                  <th className="th-sortable text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest" onClick={() => sToggle('warehouse')}>
                    Boutique<SortIcon active={sSort.key === 'warehouse'} dir={sSort.dir} />
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Tailles disponibles</th>
                  <th className="th-sortable text-right px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest" onClick={() => sToggle('total')}>
                    Total<SortIcon active={sSort.key === 'total'} dir={sSort.dir} />
                  </th>
                  <th className="px-5 py-3 w-12 no-print" />
                </tr>
              </thead>
              <tbody>
                {pagedGroups.map((g) => {
                  const p          = productMap.get(g.productId)
                  const w          = warehouseMap.get(g.warehouseId)
                  const ppc        = p?.pairsPerCarton ?? 12
                  const totalCrts  = pairsToCartons(g.total, ppc)
                  const isLow      = p && p.alertThreshold > 0 && totalCrts <= p.alertThreshold
                  const sortedSizes = Object.entries(g.sizes).sort(([a], [b]) => {
                    const na = parseFloat(a), nb = parseFloat(b)
                    return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb
                  })
                  return (
                    <tr key={`${g.productId}|${g.warehouseId}`} className="table-row-hover group border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3.5">
                        {parseProductImages(p?.imageData)[0] ? (
                          <img src={parseProductImages(p?.imageData)[0]} alt={p?.name} className="w-8 h-8 object-cover rounded-lg border border-slate-100" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                            <Package className="w-3.5 h-3.5 text-slate-300" />
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-800 text-sm">{p?.name ?? g.productId}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{p?.reference}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge color={w?.type === 'warehouse' ? 'purple' : 'blue'}>{w?.name ?? '—'}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {sortedSizes.map(([size, qty]) => (
                            <span
                              key={size}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                qty === 0
                                  ? 'bg-red-50 text-red-400 border-red-100'
                                  : qty <= 3
                                  ? 'bg-amber-50 text-amber-600 border-amber-100'
                                  : 'bg-slate-50 text-slate-600 border-slate-100'
                              }`}
                            >
                              {size}<span className="opacity-60">·</span>{qty}p
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className={`inline-flex items-center gap-1.5 font-bold text-sm ${isLow ? 'text-amber-500' : 'text-slate-800'}`}>
                          {isLow && <AlertTriangle className="w-3.5 h-3.5" />}
                          {totalCrts.toLocaleString('fr-FR')}
                          <span className="font-normal text-xs text-slate-400">cartons</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 no-print">
                        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openDetail('product', g.productId)}
                            className="icon-btn"
                            title="Voir les détails du produit"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            {filteredTotal} ligne{filteredTotal > 1 ? 's' : ''}
            {filteredTotal !== groups.length && ` sur ${groups.length}`}
          </div>
          <div className="no-print">
            <Pagination page={page} totalPages={totalPages} total={filteredTotal} pageSize={6} onPage={goTo} label="lignes" />
          </div>
        </>
      )}
    </Card>
  )
}

// ─── Stock Forecast ───────────────────────────────────────────────────────────

function StockForecastPanel() {
  const [forecast, setForecast] = useState<StockForecastItem[]>([])
  const [loading, setLoading]   = useState(true)
  const { products }            = useProducts()
  const dataVersion             = useAppStore((s) => s.dataVersion)

  useEffect(() => {
    setLoading(true)
    window.api.stats.getStockForecast()
      .then((d) => setForecast(d as StockForecastItem[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [dataVersion])

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const urgent = forecast.filter((f) => f.daysUntilStockout !== null && f.daysUntilStockout <= 14)
  const active  = forecast.filter((f) => f.dailySalesRate > 0).sort((a, b) => (a.daysUntilStockout ?? 999) - (b.daysUntilStockout ?? 999))

  if (!loading && active.length === 0) return null

  return (
    <TableCard
      title="Prévision de rupture de stock"
      subtitle="Basé sur la vitesse de vente des 30 derniers jours"
      items={active}
      loading={loading}
      pageSize={6}
      filename="prevision-rupture.pdf"
      label="produits"
      action={
        urgent.length > 0
          ? <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
              {urgent.length} rupture{urgent.length > 1 ? 's' : ''} imminente{urgent.length > 1 ? 's' : ''}
            </span>
          : undefined
      }
      emptyIcon={<BarChart3 className="w-6 h-6 text-slate-300" />}
      emptyText="Aucun produit en mouvement"
      footer={<div className="table-footer">{active.length} produit{active.length > 1 ? 's' : ''} en mouvement</div>}
    >
      {(slice) => (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Produit</th>
                <th className="text-right px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Stock actuel</th>
                <th className="text-right px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ventes/jour</th>
                <th className="text-right px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Jours restants</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Urgence</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((f) => {
                const p       = productMap.get(f.productId)
                const days    = f.daysUntilStockout
                const isUrgent  = days !== null && days <= 7
                const isWarning = days !== null && days <= 14 && !isUrgent
                return (
                  <tr key={f.productId} className="table-row-hover border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-800">{p?.name ?? f.productId}</div>
                      <div className="text-xs text-slate-400">{p?.reference}</div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-700">
                      {pairsToCartons(f.totalPairs, p?.pairsPerCarton ?? 12)} <span className="text-xs text-slate-400">crt</span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-500">
                      {(f.dailySalesRate / (p?.pairsPerCarton ?? 12)).toFixed(2)} <span className="text-xs text-slate-400">crt/j</span>
                    </td>
                    <td className={`px-5 py-3.5 text-right font-bold ${isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-700'}`}>
                      {days === null ? '—' : days}
                    </td>
                    <td className="px-5 py-3.5">
                      {isUrgent
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100"><AlertTriangle className="w-3 h-3" />Critique</span>
                        : isWarning
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100"><AlertTriangle className="w-3 h-3" />Attention</span>
                        : <span className="text-[11px] text-slate-400">OK</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </TableCard>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function StockSection() {
  return (
    <div className="flex flex-col gap-5">
      <StockLevelsPanel />
      <StockForecastPanel />
      <ProductsPanel />
      <WarehousesPanel />
    </div>
  )
}

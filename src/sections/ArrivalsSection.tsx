import { useState, useEffect, useCallback } from 'react'
import { Truck, ArrowRight, Calendar, Eye, TrendingUp } from 'lucide-react'
import { TableCard }        from '@/components/ui/TableCard'
import { Button }           from '@/components/ui/Button'
import { Badge }            from '@/components/ui/Badge'
import { useAppStore }      from '@/store/app.store'
import { useTransfers }     from '@/hooks/useTransfers'
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders'
import { useWarehouses }    from '@/hooks/useWarehouses'
import { formatFcfa, formatDate } from '@/lib/utils'
import type { Transfer } from '@/types/domain'

interface EnrichedReception {
  id:            string
  orderId:       string
  warehouseId:   string
  receptionDate: string
  notes:         string | null
  totalCartons:  number
  caEstimeFcfa:  number
  coutTotalFcfa: number
}

// ─── Réceptions ───────────────────────────────────────────────────────────────

function ReceptionsPanel() {
  const { openDrawer, openDetail } = useAppStore()
  const { orders }                 = usePurchaseOrders()
  const { warehouses }             = useWarehouses()
  const dataVersion                = useAppStore((s) => s.dataVersion)

  const [receptions, setReceptions] = useState<EnrichedReception[]>([])
  const [loading, setLoading]       = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.api.receptions.getEnrichedList()
      setReceptions(data as EnrichedReception[])
    } catch {
      setReceptions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll, dataVersion])

  const orderRef = (id: string) => orders.find((o) => o.id === id)?.reference ?? '—'
  const wName    = (id: string) => warehouses.find((w) => w.id === id)?.name ?? '—'
  const wType    = (id: string) => warehouses.find((w) => w.id === id)?.type ?? 'boutique'

  const totalCaAll = receptions.reduce((s, r) => s + r.caEstimeFcfa, 0)

  return (
    <TableCard
      title="Réceptions fournisseur"
      subtitle="Arrivage #1 — Marchandise reçue du fournisseur"
      items={receptions}
      loading={loading}
      pageSize={8}
      filename="receptions.pdf"
      label="réceptions"
      action={
        <div className="flex items-center gap-3">
          {totalCaAll > 0 && (
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-bold bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
              <TrendingUp className="w-3.5 h-3.5" />
              CA total : {formatFcfa(totalCaAll)}
            </div>
          )}
          <Button size="sm" onClick={() => openDrawer('create-reception')}>+ Nouvelle réception</Button>
        </div>
      }
      emptyIcon={<Truck className="w-6 h-6 text-slate-300" />}
      emptyText="Aucune réception"
      footer={<div className="table-footer">{receptions.length} réception{receptions.length > 1 ? 's' : ''}</div>}
    >
      {(slice) => (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Commande</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Destination</th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Cartons</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Coût total</th>
                <th className="text-right px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">CA en caisse</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-5 py-3 w-12 no-print" />
              </tr>
            </thead>
            <tbody>
              {(slice as EnrichedReception[]).map((r) => {
                const hasPrice = r.caEstimeFcfa > 0
                return (
                  <tr key={r.id} className="table-row-hover group">
                    <td className="px-5 py-3.5">
                      <span className="ref-badge">{orderRef(r.orderId)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{wName(r.warehouseId)}</div>
                      <Badge color={wType(r.warehouseId) === 'warehouse' ? 'purple' : 'blue'} className="mt-0.5">
                        {wType(r.warehouseId) === 'warehouse' ? 'Entrepôt' : 'Boutique'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{r.totalCartons}</span>
                      <span className="text-xs text-slate-400 ml-1">ctn</span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-500 dark:text-slate-400 tabular-nums text-xs">
                      {r.coutTotalFcfa > 0 ? formatFcfa(r.coutTotalFcfa) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {hasPrice ? (
                        <div>
                          <p className="font-bold text-emerald-700 dark:text-emerald-400">{formatFcfa(r.caEstimeFcfa)}</p>
                          {r.coutTotalFcfa > 0 && (
                            <p className="text-[11px] text-slate-400">
                              +{Math.round(((r.caEstimeFcfa - r.coutTotalFcfa) / r.coutTotalFcfa) * 100)} % marge
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">Prix non renseigné</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-xs">
                      {formatDate(r.receptionDate)}
                    </td>
                    <td className="px-5 py-3.5 no-print">
                      <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openDetail('reception', r.id)} className="icon-btn" title="Voir détail">
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
      )}
    </TableCard>
  )
}

// ─── Transferts ───────────────────────────────────────────────────────────────

function TransfersPanel() {
  const { openDrawer, openDetail } = useAppStore()
  const { transfers, loading }     = useTransfers()
  const { warehouses }             = useWarehouses()

  const wName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? '—'

  return (
    <TableCard
      title="Transferts vers boutiques"
      subtitle="Arrivage #2 — Réapprovisionnement de vos boutiques"
      items={transfers}
      loading={loading}
      pageSize={6}
      filename="transferts.pdf"
      label="transferts"
      action={<Button size="sm" variant="secondary" onClick={() => openDrawer('create-transfer')}>+ Nouveau transfert</Button>}
      emptyIcon={<Truck className="w-6 h-6 text-slate-300" />}
      emptyText="Aucun transfert"
      footer={<div className="table-footer">{transfers.length} transfert{transfers.length > 1 ? 's' : ''}</div>}
    >
      {(slice) => (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">De</th>
                <th className="px-2 py-3 w-6" />
                <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Vers</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-5 py-3 w-16 no-print" />
              </tr>
            </thead>
            <tbody>
              {slice.map((t: Transfer) => (
                <tr key={t.id} className="table-row-hover group">
                  <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-sm">{wName(t.fromWarehouseId)}</td>
                  <td className="py-3.5 text-slate-300">
                    <ArrowRight className="w-4 h-4" />
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200">{wName(t.toWarehouseId)}</td>
                  <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {formatDate(t.transferDate)}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 no-print">
                    <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openDetail('transfer', t.id)} className="icon-btn" title="Voir détail">
                        <Eye className="w-3.5 h-3.5" />
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

// ─── Export ───────────────────────────────────────────────────────────────────

export function ArrivalsSection() {
  return (
    <div className="flex flex-col gap-5">
      <ReceptionsPanel />
      <TransfersPanel />
    </div>
  )
}

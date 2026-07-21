import { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp, Package, Truck,
  AlertTriangle, ShoppingCart, Clock, Award,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { StatCard }         from '@/components/ui/StatCard'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge }            from '@/components/ui/Badge'
import { useAppStore }      from '@/store/app.store'
import { useDarkMode }      from '@/hooks/useDarkMode'
import { formatFcfa, pctChange } from '@/lib/utils'

interface DashboardStats {
  caToday:            number
  caThisMonth:        number
  caLastMonth:        number
  totalReceivables:   number
  pendingOrdersCount: number
  totalStockPairs:    number
  lowStockCount:      number
}

interface TimelinePoint { date: string; total: number; count: number }
interface TopProduct    { productName: string; reference: string; totalPairs: number; totalRevenue: number }

// ─── Tooltip CA ───────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 text-white px-3 py-2 rounded-xl shadow-xl text-xs">
      <p className="text-slate-400 mb-0.5">{label}</p>
      <p className="font-bold">{formatFcfa(payload[0].value)}</p>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-100 dark:bg-slate-700 rounded-lg ${className ?? ''}`} />
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function DashboardSection() {
  const dataVersion  = useAppStore((s) => s.dataVersion)
  const { dark }     = useDarkMode()
  const gridColor    = dark ? '#334155' : '#f1f5f9'
  const tickColor    = dark ? '#64748b' : '#94a3b8'

  const [stats,    setStats]    = useState<DashboardStats | null>(null)
  const [timeline, setTimeline] = useState<TimelinePoint[]>([])
  const [topProds, setTopProds] = useState<TopProduct[]>([])
  const [loading,  setLoading]  = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [s, t, p] = await Promise.all([
        window.api.stats.getDashboard() as Promise<DashboardStats>,
        window.api.stats.getSalesTimeline(30) as Promise<TimelinePoint[]>,
        window.api.stats.getTopProducts({ limit: 5 }) as Promise<TopProduct[]>,
      ])
      setStats(s)
      setTimeline(t)
      setTopProds(p)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll, dataVersion])

  const monthChange = stats ? pctChange(stats.caThisMonth, stats.caLastMonth) : undefined

  // Fill timeline gaps — show 0 for days with no sales
  const timelineWithGaps = (() => {
    const map = new Map(timeline.map((p) => [p.date, p.total]))
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (29 - i))
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
      return { date: label, total: map.get(key) ?? 0 }
    })
  })()

  return (
    <div className="flex flex-col gap-5">

      {/* ─── KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="CA aujourd'hui"
          value={loading ? '—' : formatFcfa(stats?.caToday ?? 0)}
          numericValue={stats?.caToday}
          icon={<TrendingUp />}
          accentClass="from-primary-500 to-primary-600"
          bgClass="bg-primary-50 text-primary-600"
        />
        <StatCard
          label="CA ce mois"
          value={loading ? '—' : formatFcfa(stats?.caThisMonth ?? 0)}
          numericValue={stats?.caThisMonth}
          icon={<ShoppingCart />}
          accentClass="from-emerald-400 to-emerald-600"
          bgClass="bg-emerald-50 text-emerald-600"
          change={monthChange}
          subtitle="vs mois dernier"
        />
        <StatCard
          label="Stock total"
          value={loading ? '—' : `${(stats?.totalStockPairs ?? 0).toLocaleString('fr-FR')} cartons`}
          numericValue={stats?.totalStockPairs}
          icon={<Package />}
          accentClass="from-purple-400 to-purple-600"
          bgClass="bg-purple-50 text-purple-600"
        />
      </div>

      {/* ─── Graphes ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Courbe CA 30 jours */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Chiffre d'affaires — 30 derniers jours"
            subtitle="Évolution quotidienne des ventes"
          />
          <div className="px-4 pb-4 pt-2">
            {loading ? (
              <Sk className="w-full h-48" />
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={timelineWithGaps} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: tickColor }}
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: tickColor }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1000).toFixed(0)}k` : v}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#7c3aed"
                    strokeWidth={2.5}
                    fill="url(#gradCA)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#7c3aed', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Panneau alertes + commandes */}
        <div className="flex flex-col gap-4">
          {/* Commandes en transit */}
          <Card>
            <div className="p-5 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${(stats?.pendingOrdersCount ?? 0) > 0 ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                <Truck className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">En transit</p>
                {loading ? <Sk className="w-20 h-6 mt-1" /> : (
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                    {stats?.pendingOrdersCount ?? 0}
                    <span className="text-sm font-medium text-slate-400 dark:text-slate-500 ml-1">
                      commande{(stats?.pendingOrdersCount ?? 0) > 1 ? 's' : ''}
                    </span>
                  </p>
                )}
              </div>
              {(stats?.pendingOrdersCount ?? 0) > 0 && (
                <Badge color="amber" dot>En cours</Badge>
              )}
            </div>
          </Card>

          {/* Alertes stock bas */}
          <Card>
            <div className="p-5 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${(stats?.lowStockCount ?? 0) > 0 ? 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Alertes stock</p>
                {loading ? <Sk className="w-16 h-6 mt-1" /> : (
                  <p className={`text-2xl font-extrabold tabular-nums ${(stats?.lowStockCount ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                    {stats?.lowStockCount ?? 0}
                    <span className="text-sm font-medium text-slate-400 dark:text-slate-500 ml-1">
                      alerte{(stats?.lowStockCount ?? 0) > 1 ? 's' : ''}
                    </span>
                  </p>
                )}
              </div>
              {(stats?.lowStockCount ?? 0) > 0 && (
                <Badge color="red" dot>Stock bas</Badge>
              )}
            </div>
          </Card>

          {/* Vente du jour */}
          <Card>
            <div className="p-5 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${(stats?.caToday ?? 0) > 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Aujourd'hui</p>
                {loading ? <Sk className="w-28 h-6 mt-1" /> : (
                  <p className={`text-lg font-extrabold tabular-nums ${(stats?.caToday ?? 0) > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {(stats?.caToday ?? 0) > 0 ? formatFcfa(stats!.caToday) : 'Aucune vente'}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ─── Top produits ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Top 5 produits"
          subtitle="Classement par volume vendu ce mois"
          action={<Award className="w-4 h-4 text-amber-500" />}
        />
        {loading ? (
          <div className="p-5 flex flex-col gap-3">
            {[1,2,3,4,5].map((i) => <Sk key={i} className="w-full h-8" />)}
          </div>
        ) : topProds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Award className="w-8 h-8 text-slate-200" />
            <p className="text-sm text-slate-400">Aucune vente enregistrée</p>
          </div>
        ) : (
          <div className="px-4 pb-4 pt-2">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={topProds.map((p) => ({ name: p.reference, paires: p.totalPairs, ca: p.totalRevenue }))}
                margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: tickColor }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v} paires`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: dark ? '#94a3b8' : '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="bg-slate-900 text-white px-3 py-2 rounded-xl shadow-xl text-xs">
                        <p className="font-semibold mb-0.5">{label}</p>
                        <p className="text-slate-300">{payload[0].value} paires</p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="paires" fill="#7c3aed" radius={[0, 6, 6, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

    </div>
  )
}

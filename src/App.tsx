import { type ReactNode, useEffect, useState, useRef } from 'react'
import { AppShell }          from '@/components/layout/AppShell'
import { DashboardSection }  from '@/sections/DashboardSection'
import { StockSection }      from '@/sections/StockSection'
import { OrdersSection }     from '@/sections/OrdersSection'
import { ArrivalsSection }   from '@/sections/ArrivalsSection'
import { CustomersSection }  from '@/sections/CustomersSection'
import { SuppliersSection }  from '@/sections/SuppliersSection'
import {
  LayoutDashboard, Package, ShoppingCart, Truck, Users, Building2,
} from 'lucide-react'

// ─── Sections registry ──────────────────────────────────────────────────────────

interface SectionDef {
  id:        string
  label:     string
  icon:      ReactNode
  iconClass: string
}

const SECTIONS: SectionDef[] = [
  { id: 'orders',    label: 'Commandes',    icon: <ShoppingCart />,    iconClass: 'bg-blue-100 text-blue-600' },
  { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard />, iconClass: 'bg-primary-100 text-primary-600' },
  { id: 'stock',     label: 'Stock',        icon: <Package />,         iconClass: 'bg-emerald-100 text-emerald-600' },
  { id: 'arrivals',  label: 'Arrivages',    icon: <Truck />,           iconClass: 'bg-amber-100 text-amber-600' },
  { id: 'customers', label: 'Clients',      icon: <Users />,           iconClass: 'bg-teal-100 text-teal-600' },
  { id: 'suppliers', label: 'Fournisseurs', icon: <Building2 />,       iconClass: 'bg-purple-100 text-purple-600' },
]

// ─── Sticky quick-nav ────────────────────────────────────────────────────────────

function SectionNav() {
  const [active, setActive] = useState('orders')
  const clicking = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (clicking.current) return
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: [0, 0.25, 0.5, 1] },
    )
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const handleClick = (id: string) => {
    setActive(id)
    clicking.current = true
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => { clicking.current = false }, 700)
  }

  return (
    <div className="sticky top-0 z-30 -mx-6 px-6 py-3 mb-2 bg-slate-100/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800">
      <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {SECTIONS.map((s) => {
          const isActive = active === s.id
          return (
            <button
              key={s.id}
              onClick={() => handleClick(s.id)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <span className={`w-5 h-5 rounded-lg flex items-center justify-center [&>svg]:w-3 [&>svg]:h-3 transition-colors ${
                isActive ? s.iconClass : 'bg-slate-200/70 text-slate-400 dark:bg-slate-700'
              }`}>
                {s.icon}
              </span>
              {s.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

// ─── Section label ───────────────────────────────────────────────────────────────

interface SectionLabelProps {
  label:     string
  icon:      ReactNode
  iconClass: string
  id?:       string
}

function SectionLabel({ label, icon, iconClass, id }: SectionLabelProps) {
  return (
    <div id={id} className="flex items-center gap-3 mb-4 scroll-mt-20">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 [&>svg]:w-4 [&>svg]:h-4 ${iconClass}`}>
        {icon}
      </div>
      <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200 tracking-tight">{label}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-slate-700 to-transparent" />
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AppShell>
      <SectionNav />

      <div className="flex flex-col gap-10 pt-2">

        {/* 1 — Commandes fournisseur */}
        <section>
          <SectionLabel id="orders" label="Commandes fournisseur" icon={<ShoppingCart />} iconClass="bg-blue-100 text-blue-600" />
          <OrdersSection />
        </section>

        {/* 2 — Tableau de bord */}
        <section>
          <SectionLabel id="dashboard" label="Tableau de bord" icon={<LayoutDashboard />} iconClass="bg-primary-100 text-primary-600" />
          <DashboardSection />
        </section>

        {/* 3 — Stock & Catalogue */}
        <section>
          <SectionLabel id="stock" label="Stock & Catalogue" icon={<Package />} iconClass="bg-emerald-100 text-emerald-600" />
          <StockSection />
        </section>

        {/* 4 — Arrivages */}
        <section>
          <SectionLabel id="arrivals" label="Arrivages" icon={<Truck />} iconClass="bg-amber-100 text-amber-600" />
          <ArrivalsSection />
        </section>

        {/* 5 — Clients + Fournisseurs (côte à côte) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-10">
          <section>
            <SectionLabel id="customers" label="Clients" icon={<Users />} iconClass="bg-teal-100 text-teal-600" />
            <CustomersSection />
          </section>
          <section>
            <SectionLabel id="suppliers" label="Fournisseurs" icon={<Building2 />} iconClass="bg-purple-100 text-purple-600" />
            <SuppliersSection />
          </section>
        </div>

      </div>
    </AppShell>
  )
}

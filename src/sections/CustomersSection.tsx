import { useState } from 'react'
import { Users, Pencil, Trash2, Phone, Search, Eye } from 'lucide-react'
import { TableCard }    from '@/components/ui/TableCard'
import { Button }       from '@/components/ui/Button'
import { Badge }        from '@/components/ui/Badge'
import { useAppStore }  from '@/store/app.store'
import { useCustomers } from '@/hooks/useCustomers'
import type { Customer } from '@/types/domain'

const TYPE_BADGE: Record<Customer['type'], { label: string; color: 'blue' | 'green' }> = {
  wholesale: { label: 'Grossiste', color: 'blue'  },
  retail:    { label: 'Détail',    color: 'green' },
}

// ─── Customers list ───────────────────────────────────────────────────────────

export function CustomersSection() {
  const { openDrawer, openModal, openDetail } = useAppStore()
  const { customers, loading, remove }        = useCustomers()
  const [search, setSearch]                   = useState('')

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search) ||
    (c.address ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  const handleDelete = (c: Customer) =>
    openModal('Supprimer ce client ?',
      `"${c.name}" sera supprimé définitivement.`,
      () => remove(c.id),
    )

  return (
    <div className="flex flex-col gap-5">
      <TableCard
        title="Clients"
        subtitle="Gros clients (cartons) et clients détail (paires)"
        items={filtered}
        loading={loading}
        pageSize={6}
        filename="clients.pdf"
        label="clients"
        action={<Button size="sm" onClick={() => openDrawer('create-customer')}>+ Nouveau client</Button>}
        emptyIcon={<Users className="w-6 h-6 text-slate-300" />}
        emptyText={search ? 'Aucun résultat' : 'Aucun client'}
        footer={
          <div className="table-footer">
            {filtered.length} client{filtered.length > 1 ? 's' : ''}
            {search && customers.length !== filtered.length && ` sur ${customers.length}`}
          </div>
        }
        toolbar={
          <div className="px-5 py-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher un client…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        }
      >
        {(slice) => (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Client</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Contact</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Adresse</th>
                  <th className="px-5 py-3 w-28 no-print" />
                </tr>
              </thead>
              <tbody>
                {slice.map((c) => {
                  const badge = TYPE_BADGE[c.type]
                  return (
                    <tr key={c.id} className="table-row-hover group">
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{c.name}</td>
                      <td className="px-5 py-3.5"><Badge color={badge.color}>{badge.label}</Badge></td>
                      <td className="px-5 py-3.5">
                        {c.phone || c.whatsapp ? (
                          <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                            <Phone className="w-3 h-3 text-slate-400" />{c.phone ?? c.whatsapp}
                          </div>
                        ) : c.email ? (
                          <span className="text-slate-500 text-xs">{c.email}</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs max-w-[160px] truncate">
                        {c.address ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 no-print">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openDetail('customer', c.id)} className="icon-btn" title="Voir fiche">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openDrawer('edit-customer', c)} className="icon-btn" title="Modifier">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(c)} className="icon-btn icon-btn-danger" title="Supprimer">
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
    </div>
  )
}

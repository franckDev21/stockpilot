import { useState } from 'react'
import { Building2, Pencil, Trash2, Phone, Search, Globe, Eye } from 'lucide-react'
import { TableCard }    from '@/components/ui/TableCard'
import { Button }       from '@/components/ui/Button'
import { useAppStore }  from '@/store/app.store'
import { useSuppliers } from '@/hooks/useSuppliers'
import type { Supplier } from '@/types/domain'

export function SuppliersSection() {
  const { openDrawer, openModal, openDetail } = useAppStore()
  const { suppliers, loading, remove }        = useSuppliers()
  const [search, setSearch]                   = useState('')

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.country ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (s.city ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  const handleDelete = (s: Supplier) =>
    openModal('Supprimer ce fournisseur ?',
      `"${s.name}" sera supprimé définitivement.`,
      () => remove(s.id),
    )

  return (
    <TableCard
      title="Fournisseurs"
      subtitle="Contacts de vos fournisseurs (Chine, Dubaï, Europe…)"
      items={filtered}
      loading={loading}
      pageSize={6}
      filename="fournisseurs.pdf"
      label="fournisseurs"
      action={<Button size="sm" onClick={() => openDrawer('create-supplier')}>+ Nouveau fournisseur</Button>}
      emptyIcon={<Building2 className="w-6 h-6 text-slate-300" />}
      emptyText={search ? 'Aucun résultat' : 'Aucun fournisseur'}
      footer={
        <div className="table-footer">
          {filtered.length} fournisseur{filtered.length > 1 ? 's' : ''}
          {search && suppliers.length !== filtered.length && ` sur ${suppliers.length}`}
        </div>
      }
      toolbar={
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un fournisseur…"
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
                <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Nom</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Localisation</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Contact</th>
                <th className="px-5 py-3 w-28 no-print" />
              </tr>
            </thead>
            <tbody>
              {slice.map((s) => (
                <tr key={s.id} className="table-row-hover group">
                  <td className="px-5 py-3.5 font-semibold text-slate-800">{s.name}</td>
                  <td className="px-5 py-3.5">
                    {s.country || s.city ? (
                      <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                        <Globe className="w-3 h-3 text-slate-400" />
                        {[s.city, s.country].filter(Boolean).join(', ')}
                      </div>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {s.phone || s.whatsapp ? (
                      <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                        <Phone className="w-3 h-3 text-slate-400" />{s.phone ?? s.whatsapp}
                      </div>
                    ) : s.email ? (
                      <span className="text-slate-500 text-xs">{s.email}</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 no-print">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openDetail('supplier', s.id)} className="icon-btn" title="Voir fiche">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openDrawer('edit-supplier', s)} className="icon-btn" title="Modifier">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(s)} className="icon-btn icon-btn-danger" title="Supprimer">
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

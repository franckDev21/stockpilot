import { useState, useEffect } from 'react'
import { Phone, Mail, MapPin } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge }            from '@/components/ui/Badge'
import { Button }           from '@/components/ui/Button'
import { useAppStore }      from '@/store/app.store'
import type { Customer } from '@/types/domain'

const TYPE_COLOR: Record<Customer['type'], 'blue' | 'green'> = {
  wholesale: 'blue',
  retail:    'green',
}
const TYPE_LABEL: Record<Customer['type'], string> = {
  wholesale: 'Grossiste',
  retail:    'Détail',
}

export function CustomerDetail({ id }: { id: string }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading]   = useState(true)
  const { openDrawer }          = useAppStore()

  useEffect(() => {
    setLoading(true)
    window.api.customers.getById(id)
      .then((d) => setCustomer(d as Customer))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!customer) return (
    <div className="empty-state"><p className="text-slate-500">Client introuvable</p></div>
  )

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">
      <Card>
        <CardHeader
          title={customer.name}
          subtitle="Fiche client"
          action={
            <div className="flex items-center gap-2">
              <Badge color={TYPE_COLOR[customer.type]}>{TYPE_LABEL[customer.type]}</Badge>
              <Button size="sm" onClick={() => openDrawer('edit-customer', customer)}>Modifier</Button>
            </div>
          }
        />
        <div className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Contact</p>
            {customer.phone && (
              <div className="flex items-center gap-2 text-slate-600 mb-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />{customer.phone}
              </div>
            )}
            {customer.whatsapp && (
              <div className="flex items-center gap-2 text-slate-600 mb-1">
                <Phone className="w-3.5 h-3.5 text-green-400" />WhatsApp: {customer.whatsapp}
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="w-3.5 h-3.5 text-slate-400" />{customer.email}
              </div>
            )}
            {!customer.phone && !customer.whatsapp && !customer.email && (
              <span className="text-slate-300">—</span>
            )}
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Adresse</p>
            {customer.address ? (
              <div className="flex items-start gap-2 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />{customer.address}
              </div>
            ) : <span className="text-slate-300">—</span>}
          </div>
        </div>
        {customer.notes && (
          <div className="px-5 pb-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notes</p>
            <p className="text-sm text-slate-600">{customer.notes}</p>
          </div>
        )}
      </Card>
    </div>
  )
}

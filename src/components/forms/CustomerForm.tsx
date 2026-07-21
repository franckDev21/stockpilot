import { useState } from 'react'
import type { Customer } from '@/types/domain'
import { useCustomers } from '@/hooks/useCustomers'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

interface CustomerFormProps {
  data?:     Customer
  onSuccess: () => void
}

interface FormState {
  name: string; phone: string; email: string
  whatsapp: string; address: string
  type: 'wholesale' | 'retail'; notes: string
}

const EMPTY: FormState = {
  name: '', phone: '', email: '', whatsapp: '', address: '', type: 'wholesale', notes: '',
}

const TYPE_OPTIONS = [
  { value: 'wholesale', label: 'Grossiste (cartons)' },
  { value: 'retail',    label: 'Détail (paires)'     },
]

export function CustomerForm({ data, onSuccess }: CustomerFormProps) {
  const { create, update } = useCustomers()
  const isEdit = !!data

  const [form, setForm]       = useState<FormState>(
    data
      ? { name: data.name, phone: data.phone ?? '', email: data.email ?? '',
          whatsapp: data.whatsapp ?? '', address: data.address ?? '',
          type: data.type, notes: data.notes ?? '' }
      : EMPTY,
  )
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState<Partial<FormState>>({})

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setErrors({ name: 'Le nom est obligatoire' }); return }
    setLoading(true)
    try {
      const payload = {
        name:     form.name.trim(),
        phone:    form.phone.trim()    || null,
        email:    form.email.trim()    || null,
        whatsapp: form.whatsapp.trim() || null,
        address:  form.address.trim()  || null,
        type:     form.type,
        notes:    form.notes.trim()    || null,
        deletedAt: null,
      }
      if (isEdit && data) { await update(data.id, payload) }
      else                { await create(payload) }
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrors({ name: msg || 'Une erreur est survenue' })
      console.error('Erreur client:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Nom du client" required placeholder="Jean Mbarga" value={form.name} onChange={set('name')} error={errors.name} />

      <Select label="Type de client" options={TYPE_OPTIONS} value={form.type} onChange={set('type')} />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Téléphone" placeholder="+237 6…" value={form.phone} onChange={set('phone')} />
        <Input label="WhatsApp" placeholder="+237 6…" value={form.whatsapp} onChange={set('whatsapp')} />
      </div>

      <Input label="Email" type="email" placeholder="client@email.com" value={form.email} onChange={set('email')} />
      <Input label="Adresse / Quartier" placeholder="Akwa, Douala…" value={form.address} onChange={set('address')} />

      <Textarea label="Notes" placeholder="Conditions habituelles, préférences…" value={form.notes} onChange={set('notes')} />

      <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
        <Button type="button" variant="secondary" onClick={onSuccess}>Annuler</Button>
        <Button type="submit" loading={loading}>{isEdit ? 'Enregistrer' : 'Ajouter le client'}</Button>
      </div>
    </form>
  )
}

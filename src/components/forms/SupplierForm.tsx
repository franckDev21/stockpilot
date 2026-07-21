import { useState } from 'react'
import type { Supplier } from '@/types/domain'
import { useSuppliers } from '@/hooks/useSuppliers'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

interface SupplierFormProps {
  data?:     Supplier
  onSuccess: () => void
}

interface FormState {
  name: string; country: string; city: string
  phone: string; email: string; whatsapp: string
  address: string; notes: string
}

const EMPTY: FormState = {
  name: '', country: '', city: '', phone: '', email: '', whatsapp: '', address: '', notes: '',
}

export function SupplierForm({ data, onSuccess }: SupplierFormProps) {
  const { create, update } = useSuppliers()
  const isEdit = !!data

  const [form, setForm]       = useState<FormState>(
    data
      ? { name: data.name, country: data.country ?? '', city: data.city ?? '',
          phone: data.phone ?? '', email: data.email ?? '', whatsapp: data.whatsapp ?? '',
          address: data.address ?? '', notes: data.notes ?? '' }
      : EMPTY,
  )
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState<Partial<FormState>>({})

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setErrors({ name: 'Le nom est obligatoire' }); return }
    setLoading(true)
    try {
      const payload = {
        name:     form.name.trim(),
        country:  form.country.trim()  || null,
        city:     form.city.trim()     || null,
        phone:    form.phone.trim()    || null,
        email:    form.email.trim()    || null,
        whatsapp: form.whatsapp.trim() || null,
        address:  form.address.trim()  || null,
        notes:    form.notes.trim()    || null,
        deletedAt: null,
      }
      if (isEdit && data) { await update(data.id, payload) }
      else                { await create(payload) }
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrors({ name: msg || 'Une erreur est survenue' })
      console.error('Erreur fournisseur:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Nom du fournisseur" required placeholder="Guangzhou Trading Co." value={form.name} onChange={set('name')} error={errors.name} />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Pays" placeholder="Chine" value={form.country} onChange={set('country')} />
        <Input label="Ville" placeholder="Guangzhou" value={form.city} onChange={set('city')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Téléphone" placeholder="+86 138 …" value={form.phone} onChange={set('phone')} />
        <Input label="WhatsApp" placeholder="+86 138 …" value={form.whatsapp} onChange={set('whatsapp')} />
      </div>

      <Input label="Email" type="email" placeholder="contact@supplier.com" value={form.email} onChange={set('email')} />

      <Textarea label="Adresse" placeholder="Rue, quartier, code postal…" value={form.address} onChange={set('address')} />

      <Textarea label="Notes" placeholder="Conditions de paiement, délais habituels…" value={form.notes} onChange={set('notes')} />

      <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
        <Button type="button" variant="secondary" onClick={onSuccess}>Annuler</Button>
        <Button type="submit" loading={loading}>{isEdit ? 'Enregistrer' : 'Ajouter le fournisseur'}</Button>
      </div>
    </form>
  )
}

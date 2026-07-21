import { useState } from 'react'
import type { Warehouse } from '@/types/domain'
import { useWarehouses } from '@/hooks/useWarehouses'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface WarehouseFormProps {
  data?:     Warehouse
  onSuccess: () => void
}

interface FormState {
  name: string; type: 'warehouse' | 'boutique'; address: string
}

const TYPE_OPTIONS = [
  { value: 'boutique',  label: 'Boutique (vente au détail)' },
  { value: 'warehouse', label: 'Entrepôt central' },
]

export function WarehouseForm({ data, onSuccess }: WarehouseFormProps) {
  const { create, update } = useWarehouses()
  const isEdit = !!data

  const [form, setForm]       = useState<FormState>(
    data
      ? { name: data.name, type: data.type, address: data.address ?? '' }
      : { name: '', type: 'boutique', address: '' },
  )
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Le nom est obligatoire'); return }
    setLoading(true)
    try {
      const payload = {
        name:      form.name.trim(),
        type:      form.type,
        address:   form.address.trim() || null,
        isDefault: false,
        deletedAt: null,
      }
      if (isEdit && data) { await update(data.id, payload) }
      else                { await create(payload) }
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || 'Une erreur est survenue')
      console.error('Erreur boutique:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Nom" required placeholder="Boutique Centre-ville" value={form.name} onChange={set('name')} error={error} />
      <Select label="Type" options={TYPE_OPTIONS} value={form.type} onChange={set('type')} />
      <Input label="Adresse" placeholder="Rue, quartier, ville…" value={form.address} onChange={set('address')} />

      <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
        <Button type="button" variant="secondary" onClick={onSuccess}>Annuler</Button>
        <Button type="submit" loading={loading}>{isEdit ? 'Enregistrer' : 'Ajouter'}</Button>
      </div>
    </form>
  )
}

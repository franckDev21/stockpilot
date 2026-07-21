import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTransfers } from '@/hooks/useTransfers'
import { useWarehouses } from '@/hooks/useWarehouses'
import { useProducts } from '@/hooks/useProducts'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

interface TransferItem {
  _key:       string
  productId:  string
  size:       string
  pairsCount: string
}

interface FormState {
  fromWarehouseId: string
  toWarehouseId:   string
  transferDate:    string
  notes:           string
}

const today = () => new Date().toISOString().slice(0, 10)

const emptyItem = (): TransferItem => ({
  _key: crypto.randomUUID(), productId: '', size: '', pairsCount: '',
})

export function TransferForm({ onSuccess }: { onSuccess: () => void }) {
  const { create }    = useTransfers()
  const { warehouses } = useWarehouses()
  const { products }  = useProducts()

  const [form, setForm]   = useState<FormState>({
    fromWarehouseId: '', toWarehouseId: '', transferDate: today(), notes: '',
  })
  const [items, setItems]   = useState<TransferItem[]>([emptyItem()])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState<Record<string, string>>({})

  const warehouseOptions = warehouses.map((w) => ({
    value: w.id,
    label: `${w.name} (${w.type === 'warehouse' ? 'Entrepôt' : 'Boutique'})`,
  }))
  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.reference} — ${p.name}`,
  }))

  const setField = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const updateItem = (key: string, field: keyof TransferItem, value: string) =>
    setItems((prev) => prev.map((it) => it._key === key ? { ...it, [field]: value } : it))

  const addItem    = () => setItems((prev) => [...prev, emptyItem()])
  const removeItem = (key: string) =>
    setItems((prev) => prev.length > 1 ? prev.filter((it) => it._key !== key) : prev)

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.fromWarehouseId) e.from = 'Choisissez la source'
    if (!form.toWarehouseId)   e.to   = 'Choisissez la destination'
    if (form.fromWarehouseId && form.fromWarehouseId === form.toWarehouseId)
      e.to = 'La source et la destination doivent être différentes'
    items.forEach((it, i) => {
      if (!it.productId)        e[`p_${i}`] = 'Produit requis'
      if (!it.size.trim())      e[`s_${i}`] = 'Pointure requise'
      if (!Number(it.pairsCount)) e[`q_${i}`] = 'Quantité requise'
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await create({
        fromWarehouseId: form.fromWarehouseId,
        toWarehouseId:   form.toWarehouseId,
        transferDate:    form.transferDate,
        notes:           form.notes.trim() || null,
        items: items.map((it) => ({
          productId:  it.productId,
          size:       it.size.trim(),
          pairsCount: Number(it.pairsCount),
        })),
      })
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrors({ _form: msg || 'Une erreur est survenue, veuillez réessayer' })
      console.error('Erreur transfert:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="De (source)"
          options={warehouseOptions}
          value={form.fromWarehouseId}
          onChange={setField('fromWarehouseId')}
          error={errors.from}
          placeholder="Entrepôt source…"
        />
        <Select
          label="Vers (destination)"
          options={warehouseOptions}
          value={form.toWarehouseId}
          onChange={setField('toWarehouseId')}
          error={errors.to}
          placeholder="Boutique destination…"
        />
      </div>

      <Input
        label="Date de transfert"
        type="date"
        value={form.transferDate}
        onChange={setField('transferDate')}
      />

      {/* Items */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
          Articles à transférer
        </p>
        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <div key={it._key} className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex-1 flex flex-col gap-2">
                <Select
                  options={productOptions}
                  value={it.productId}
                  onChange={(e) => updateItem(it._key, 'productId', e.target.value)}
                  error={errors[`p_${i}`]}
                  placeholder="Produit…"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Pointure (ex: 42)"
                    value={it.size}
                    onChange={(e) => updateItem(it._key, 'size', e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100
                               focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                  />
                  <input
                    type="number"
                    placeholder="Paires"
                    min="1"
                    value={it.pairsCount}
                    onChange={(e) => updateItem(it._key, 'pairsCount', e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100
                               focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                  />
                </div>
                {(errors[`s_${i}`] || errors[`q_${i}`]) && (
                  <p className="text-xs text-red-500">{errors[`s_${i}`] || errors[`q_${i}`]}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeItem(it._key)}
                disabled={items.length === 1}
                className="mt-1 p-1.5 rounded-lg text-slate-300 hover:text-red-400 disabled:opacity-30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addItem}
          className="mt-2 flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 dark:border-slate-600
                     rounded-md text-sm text-slate-500 dark:text-slate-400 hover:text-primary-600 hover:border-primary-300
                     hover:bg-primary-50/50 transition-colors w-full"
        >
          <Plus className="w-4 h-4" />
          Ajouter un article
        </button>
      </div>

      <Textarea
        label="Notes (optionnel)"
        placeholder="Motif du transfert, remarques…"
        value={form.notes}
        onChange={setField('notes')}
      />

      {errors._form && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errors._form}</p>
      )}

      <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
        <Button type="button" variant="secondary" onClick={onSuccess}>Annuler</Button>
        <Button type="submit" loading={loading}>Enregistrer le transfert</Button>
      </div>
    </form>
  )
}

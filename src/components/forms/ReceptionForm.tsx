import { useState, useEffect } from 'react'
import { Package } from 'lucide-react'
import { useReceptions } from '@/hooks/useReceptions'
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders'
import { useWarehouses } from '@/hooks/useWarehouses'
import { useProducts } from '@/hooks/useProducts'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

interface OrderItem {
  id:              string
  productId:       string
  cartonsOrdered:  number
  pairsPerCarton:  number
  cartonsReceived: string
}

interface FormState {
  orderId:       string
  warehouseId:   string
  receptionDate: string
  notes:         string
}

const today = () => new Date().toISOString().slice(0, 10)

export function ReceptionForm({ receptionId, onSuccess }: { receptionId?: string; onSuccess: () => void }) {
  const isEdit = Boolean(receptionId)
  const { create }    = useReceptions()
  const { orders }    = usePurchaseOrders()
  const { warehouses } = useWarehouses()
  const { products }  = useProducts()

  const [form, setForm]     = useState<FormState>({
    orderId: '', warehouseId: '', receptionDate: today(), notes: '',
  })
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loading, setLoading]       = useState(false)
  const [errors, setErrors]         = useState<Record<string, string>>({})

  // En édition : quantités déjà reçues, par orderItemId. `null` tant que la
  // réception n'est pas chargée (empêche de préremplir avec les quantités commandées).
  const [initialReceived, setInitialReceived] = useState<Record<string, string> | null>(isEdit ? null : {})

  // Filter orders eligible for reception
  const eligibleOrders = orders.filter(
    (o) => o.status === 'confirmed' || o.status === 'partial' || o.status === 'draft',
  )

  const orderOptions = eligibleOrders.map((o) => ({
    value: o.id,
    label: `${o.reference} — ${o.orderDate}`,
  }))
  const warehouseOptions = warehouses.map((w) => ({
    value: w.id,
    label: `${w.name} (${w.type === 'warehouse' ? 'Entrepôt' : 'Boutique'})`,
  }))

  const currentOrderRef = orders.find((o) => o.id === form.orderId)?.reference ?? '—'

  // En édition : charger la réception existante pour préremplir le formulaire.
  useEffect(() => {
    if (!receptionId) return
    window.api.receptions.getById(receptionId).then((raw) => {
      const r = raw as {
        orderId: string; warehouseId: string; receptionDate: string; notes: string | null
        items: Array<{ orderItemId: string; cartonsReceived: number }>
      }
      if (!r) return
      setForm({ orderId: r.orderId, warehouseId: r.warehouseId, receptionDate: r.receptionDate, notes: r.notes ?? '' })
      const map: Record<string, string> = {}
      for (const it of r.items) map[it.orderItemId] = String(it.cartonsReceived)
      setInitialReceived(map)
    }).catch(() => setInitialReceived({}))
  }, [receptionId])

  // Load order items when orderId changes
  useEffect(() => {
    if (!form.orderId) { setOrderItems([]); return }
    if (initialReceived === null) return // édition : on attend la réception
    window.api.purchaseOrders.getById(form.orderId).then((raw) => {
      const detail = raw as { items: Array<{ id: string; productId: string; cartonsOrdered: number; pairsPerCarton: number }> }
      setOrderItems(
        (detail?.items ?? []).map((it) => ({
          id:              it.id,
          productId:       it.productId,
          cartonsOrdered:  it.cartonsOrdered,
          pairsPerCarton:  it.pairsPerCarton,
          // édition → quantité déjà reçue ; création → prérempli avec la qté commandée
          cartonsReceived: initialReceived[it.id] ?? String(it.cartonsOrdered),
        })),
      )
    }).catch(() => setOrderItems([]))
  }, [form.orderId, initialReceived])

  const setField = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const setReceived = (itemId: string, value: string) =>
    setOrderItems((prev) => prev.map((it) => it.id === itemId ? { ...it, cartonsReceived: value } : it))

  const productName = (id: string) => {
    const p = products.find((p) => p.id === id)
    return p ? `${p.reference} — ${p.name}` : id
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.orderId)     e.orderId     = 'Choisissez une commande'
    if (!form.warehouseId) e.warehouseId = 'Choisissez un entrepôt de destination'
    if (!form.receptionDate) e.receptionDate = 'La date est obligatoire'
    orderItems.forEach((it, i) => {
      const n = Number(it.cartonsReceived)
      if (isNaN(n) || n < 0 || n > it.cartonsOrdered)
        e[`item_${i}`] = `Max ${it.cartonsOrdered} cartons`
    })
    if (orderItems.length > 0 && !orderItems.some((it) => Number(it.cartonsReceived) > 0))
      e._form = 'Renseignez au moins un article reçu (quantité supérieure à 0).'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const items = orderItems
        .filter((it) => Number(it.cartonsReceived) > 0)
        .map((it) => ({ orderItemId: it.id, cartonsReceived: Number(it.cartonsReceived) }))

      if (isEdit && receptionId) {
        await window.api.receptions.update(receptionId, {
          warehouseId:   form.warehouseId,
          receptionDate: form.receptionDate,
          notes:         form.notes.trim() || null,
          items,
        })
      } else {
        await create({
          orderId:       form.orderId,
          warehouseId:   form.warehouseId,
          receptionDate: form.receptionDate,
          notes:         form.notes.trim() || null,
          items,
        })
      }
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrors({ _form: msg || 'Une erreur est survenue, veuillez réessayer' })
      console.error('Erreur réception:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {isEdit ? (
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Commande fournisseur</label>
          <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200">
            <span className="ref-badge">{currentOrderRef}</span>
            <span className="text-xs text-slate-400 ml-2">Commande non modifiable</span>
          </div>
        </div>
      ) : (
        <Select
          label="Commande fournisseur"
          options={orderOptions}
          value={form.orderId}
          onChange={setField('orderId')}
          error={errors.orderId}
          placeholder="Sélectionner une commande…"
        />
      )}

      <Select
        label="Entrepôt de destination"
        options={warehouseOptions}
        value={form.warehouseId}
        onChange={setField('warehouseId')}
        error={errors.warehouseId}
        placeholder="Entrepôt ou boutique…"
      />

      <Input
        label="Date de réception"
        type="date"
        value={form.receptionDate}
        onChange={setField('receptionDate')}
        error={errors.receptionDate}
      />

      {/* Order items */}
      {orderItems.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
            Cartons reçus par article
          </p>
          <div className="flex flex-col gap-2">
            {orderItems.map((it, i) => (
              <div key={it.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <Package className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{productName(it.productId)}</p>
                  <p className="text-xs text-slate-400">
                    Commandés : {it.cartonsOrdered} cartons ({it.pairsPerCarton} paires/carton)
                  </p>
                </div>
                <div className="shrink-0">
                  <input
                    type="number"
                    min="0"
                    max={it.cartonsOrdered}
                    value={it.cartonsReceived}
                    onChange={(e) => setReceived(it.id, e.target.value)}
                    className="w-20 px-2 py-1.5 text-sm text-center border border-slate-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                  />
                  {errors[`item_${i}`] && (
                    <p className="text-xs text-red-500 mt-0.5">{errors[`item_${i}`]}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {form.orderId && orderItems.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4">
          Chargement des articles…
        </p>
      )}

      <Textarea
        label="Notes (optionnel)"
        placeholder="État de la marchandise, remarques…"
        value={form.notes}
        onChange={setField('notes')}
      />

      {errors._form && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errors._form}</p>
      )}

      <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
        <Button type="button" variant="secondary" onClick={onSuccess}>Annuler</Button>
        <Button type="submit" loading={loading}>{isEdit ? 'Enregistrer les modifications' : 'Enregistrer la réception'}</Button>
      </div>
    </form>
  )
}

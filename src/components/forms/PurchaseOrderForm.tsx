import { useState, useCallback } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react'
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders'
import { useProducts } from '@/hooks/useProducts'
import { useSuppliers } from '@/hooks/useSuppliers'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { formatFcfa } from '@/lib/utils'

// ─── Local types ─────────────────────────────────────────────────────────────

interface SizeRow { size: string; pairsCount: string }

interface ItemState {
  _key:                  string
  productId:             string
  cartonsOrdered:        string
  pairsPerCarton:        string
  unitPriceFcfa:         string
  unitCostPerCartonFcfa: string
  notes:                 string
  sizes:                 SizeRow[]
  expanded:              boolean
}

interface FormState {
  supplierId:                     string
  orderDate:                      string
  expectedDeliveryDate:           string
  freightCostFcfa:                string
  customsCostFcfa:                string
  otherCostsFcfa:                 string
  simulatedSalePricePerCartonFcfa: string
  notes:                          string
}

const today = () => new Date().toISOString().slice(0, 10)

const EMPTY_ITEM = (): ItemState => ({
  _key:                  crypto.randomUUID(),
  productId:             '',
  cartonsOrdered:        '',
  pairsPerCarton:        '',
  unitPriceFcfa:         '',
  unitCostPerCartonFcfa: '',
  notes:                 '',
  sizes:                 [{ size: '', pairsCount: '' }],
  expanded:              true,
})

const EMPTY_FORM: FormState = {
  supplierId:                     '',
  orderDate:                      today(),
  expectedDeliveryDate:           '',
  freightCostFcfa:                '',
  customsCostFcfa:                '',
  otherCostsFcfa:                 '',
  simulatedSalePricePerCartonFcfa:'',
  notes:                          '',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 mt-1">
      {children}
    </h3>
  )
}

function Divider() {
  return <hr className="border-slate-100 my-4" />
}

// ─── Component ───────────────────────────────────────────────────────────────

interface PurchaseOrderFormProps {
  onSuccess: () => void
}

export function PurchaseOrderForm({ onSuccess }: PurchaseOrderFormProps) {
  const { create }    = usePurchaseOrders()
  const { products }  = useProducts()
  const { suppliers } = useSuppliers()

  const [form, setForm]   = useState<FormState>(EMPTY_FORM)
  const [items, setItems] = useState<ItemState[]>([EMPTY_ITEM()])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const setField = useCallback(
    (key: keyof FormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    [],
  )

  // ── Item mutators ────────────────────────────────────────────────────────

  const updateItem = (key: string, field: keyof ItemState, value: unknown) => {
    setItems((prev) => prev.map((it) => it._key === key ? { ...it, [field]: value } : it))
    // Clear item-specific errors when user modifies it
    setErrors((prev) => {
      const next = { ...prev }
      const idx = items.findIndex(it => it._key === key)
      if (idx !== -1) {
        delete next[`item_${idx}_product`]
        delete next[`item_${idx}_cartons`]
        delete next[`item_${idx}_pairs`]
        delete next[`item_${idx}_cost`]
        delete next[`item_${idx}_sizes`]
      }
      return next
    })
  }

  const addItem = () => setItems((prev) => [...prev, EMPTY_ITEM()])

  const removeItem = (key: string) =>
    setItems((prev) => prev.length > 1 ? prev.filter((it) => it._key !== key) : prev)

  const toggleExpand = (key: string) =>
    setItems((prev) => prev.map((it) => it._key === key ? { ...it, expanded: !it.expanded } : it))

  const addSizeRow = (key: string) =>
    setItems((prev) => prev.map((it) =>
      it._key === key ? { ...it, sizes: [...it.sizes, { size: '', pairsCount: '' }] } : it,
    ))

  const removeSizeRow = (key: string, idx: number) => {
    setItems((prev) => prev.map((it) =>
      it._key === key
        ? { ...it, sizes: it.sizes.length > 1 ? it.sizes.filter((_, i) => i !== idx) : it.sizes }
        : it,
    ))
    const itemIdx = items.findIndex(it => it._key === key)
    if (itemIdx !== -1) setErrors(prev => ({ ...prev, [`item_${itemIdx}_sizes`]: '' }))
  }

  const updateSizeRow = (key: string, idx: number, field: keyof SizeRow, value: string) => {
    setItems((prev) => prev.map((it) =>
      it._key === key
        ? { ...it, sizes: it.sizes.map((s, i) => i === idx ? { ...s, [field]: value } : s) }
        : it,
    ))
    // Clear composition error when user modifies a row
    const itemIdx = items.findIndex(it => it._key === key)
    if (itemIdx !== -1) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[`item_${itemIdx}_sizes`]
        return next
      })
    }
  }

  // ── Live calculations ────────────────────────────────────────────────────

  const productCostFcfa = items.reduce((sum, it) =>
    sum + (Number(it.cartonsOrdered) || 0) * (Number(it.unitCostPerCartonFcfa) || 0), 0,
  )
  const totalCartons = items.reduce((sum, it) => sum + (Number(it.cartonsOrdered) || 0), 0)
  const freight      = Number(form.freightCostFcfa)  || 0
  const customs      = Number(form.customsCostFcfa)  || 0
  const others       = Number(form.otherCostsFcfa)   || 0
  const totalCost    = productCostFcfa + freight + customs + others
  const salePrice    = Number(form.simulatedSalePricePerCartonFcfa) || 0
  const totalRevenue = salePrice * totalCartons
  const grossProfit  = totalRevenue - totalCost
  const marginPct    = totalCost > 0 ? (grossProfit / totalCost) * 100 : 0
  const costPerCarton = totalCartons > 0 ? Math.round(totalCost / totalCartons) : 0

  // ── Validation ───────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.supplierId) e.supplierId = 'Choisissez un fournisseur'
    if (!form.orderDate)  e.orderDate  = 'La date est obligatoire'
    
    items.forEach((it, i) => {
      const perCarton = Number(it.pairsPerCarton) || 0
      
      if (!it.productId)             e[`item_${i}_product`]  = 'Produit requis'
      if (!Number(it.cartonsOrdered)) e[`item_${i}_cartons`]  = 'Nombre requis'
      if (!perCarton)                e[`item_${i}_pairs`]    = 'Paires/carton requis'
      if (!Number(it.unitCostPerCartonFcfa)) e[`item_${i}_cost`] = 'Prix requis'
      
    })
    
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await create({
        supplierId:            form.supplierId,
        orderDate:             form.orderDate,
        expectedDeliveryDate:  form.expectedDeliveryDate || null,
        productCostFcfa,
        freightCostFcfa:       freight,
        customsCostFcfa:       customs,
        otherCostsFcfa:        others,
        simulatedSalePricePerCartonFcfa: salePrice || null,
        notes:                 form.notes.trim() || null,
        status:                'draft',
        deletedAt:             null,
        items: items.map((it) => ({
          productId:             it.productId,
          cartonsOrdered:        Number(it.cartonsOrdered),
          pairsPerCarton:        Number(it.pairsPerCarton),
          unitCostPerCartonFcfa: Number(it.unitCostPerCartonFcfa),
          notes:                 it.notes.trim() || null,
          sizes: it.sizes
            .filter((s) => s.size.trim() && Number(s.pairsCount) > 0)
            .map((s) => ({ size: s.size.trim(), pairsCount: Number(s.pairsCount) })),
        })),
      })
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrors({ _form: msg || 'Une erreur est survenue, veuillez réessayer' })
      console.error('Erreur commande:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Dropdown options ─────────────────────────────────────────────────────

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }))
  const productOptions  = products.map((p) => ({ value: p.id, label: `${p.reference} — ${p.name}` }))

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-0">

      {/* ── 1. Informations générales ───────────────────────────── */}
      <SectionTitle>Informations générales</SectionTitle>

      <div className="flex flex-col gap-3">
        <Select
          label="Fournisseur"
          options={supplierOptions}
          value={form.supplierId}
          onChange={setField('supplierId')}
          error={errors.supplierId}
          placeholder="Sélectionner un fournisseur…"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date de commande"
            type="date"
            value={form.orderDate}
            onChange={setField('orderDate')}
            error={errors.orderDate}
          />
          <Input
            label="Livraison prévue"
            type="date"
            value={form.expectedDeliveryDate}
            onChange={setField('expectedDeliveryDate')}
          />
        </div>

        <Textarea
          label="Notes (optionnel)"
          placeholder="Conditions, remarques…"
          value={form.notes}
          onChange={setField('notes')}
        />
      </div>

      <Divider />

      {/* ── 2. Articles commandés ────────────────────────────────── */}
      <SectionTitle>Articles commandés</SectionTitle>

      <div className="flex flex-col gap-3">
        {items.map((item, idx) => {
          const perCarton = Number(item.pairsPerCarton) || 0
          const assigned  = item.sizes.reduce((sum, srow) => sum + (Number(srow.pairsCount) || 0), 0)
          const diff      = perCarton - assigned

          return (
            <div key={item._key} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              {/* Item header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-500 w-5">#{idx + 1}</span>
                <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                  {item.productId
                    ? (products.find((p) => p.id === item.productId)?.name ?? '…')
                    : 'Nouveau produit'}
                </span>
                <button
                  type="button"
                  onClick={() => toggleExpand(item._key)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600"
                >
                  {item.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item._key)}
                    className="p-1 rounded text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {item.expanded && (
                <div className="p-4 flex flex-col gap-3">
                  <Select
                    label="Produit"
                    options={productOptions}
                    value={item.productId}
                    onChange={(e) => updateItem(item._key, 'productId', e.target.value)}
                    error={errors[`item_${idx}_product`]}
                    placeholder="Choisir un modèle…"
                  />

                  <div className="grid grid-cols-4 gap-2">
                    <Input
                      label="Cartons"
                      type="number"
                      min="1"
                      placeholder="10"
                      value={item.cartonsOrdered}
                      onChange={(e) => updateItem(item._key, 'cartonsOrdered', e.target.value)}
                      error={errors[`item_${idx}_cartons`]}
                    />
                    <Input
                      label="Paires/carton"
                      type="number"
                      min="1"
                      placeholder="24"
                      value={item.pairsPerCarton}
                      onChange={(e) => {
                        updateItem(item._key, 'pairsPerCarton', e.target.value)
                        const pairs = Number(e.target.value) || 0
                        const unitPrice = Number(item.unitPriceFcfa) || 0
                        updateItem(item._key, 'unitCostPerCartonFcfa', pairs > 0 && unitPrice > 0 ? String(pairs * unitPrice) : '')
                      }}
                      error={errors[`item_${idx}_pairs`]}
                    />
                    <Input
                      label="Prix unitaire (FCFA)"
                      type="number"
                      min="0"
                      placeholder="1000"
                      value={item.unitPriceFcfa}
                      onChange={(e) => {
                        updateItem(item._key, 'unitPriceFcfa', e.target.value)
                        const unitPrice = Number(e.target.value) || 0
                        const pairs = Number(item.pairsPerCarton) || 0
                        updateItem(item._key, 'unitCostPerCartonFcfa', pairs > 0 && unitPrice > 0 ? String(pairs * unitPrice) : '')
                      }}
                      error={errors[`item_${idx}_cost`]}
                    />
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-slate-500">Prix du carton</label>
                      <div className="flex items-center h-[38px] px-3 rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 text-sm font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                        {Number(item.unitCostPerCartonFcfa) > 0
                          ? formatFcfa(Number(item.unitCostPerCartonFcfa))
                          : <span className="text-slate-300 dark:text-slate-600 font-normal">—</span>}
                      </div>
                    </div>
                  </div>

                  {/* Size composition */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-medium text-slate-500">
                        Composition par pointure (par carton)
                      </p>
                      {perCarton > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${diff === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {assigned} / {perCarton} paires
                          {diff !== 0 && ` (Reste ${diff})`}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      {item.sizes.map((srow, si) => (
                        <div key={si} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Pointure (ex: 42)"
                            value={srow.size}
                            onChange={(e) => updateSizeRow(item._key, si, 'size', e.target.value)}
                            className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100
                                       focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                          />
                          <input
                            type="number"
                            placeholder="Paires"
                            min="1"
                            value={srow.pairsCount}
                            onChange={(e) => updateSizeRow(item._key, si, 'pairsCount', e.target.value)}
                            className="w-20 px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100
                                       focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                          />
                          <button
                            type="button"
                            onClick={() => removeSizeRow(item._key, si)}
                            disabled={item.sizes.length === 1}
                            className="p-1 rounded text-slate-300 hover:text-red-400 disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <button
                        type="button"
                        onClick={() => addSizeRow(item._key)}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        + Ajouter une pointure
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-slate-300 dark:border-slate-600
                     rounded-md text-sm text-slate-500 dark:text-slate-400 hover:text-primary-600 hover:border-primary-300
                     hover:bg-primary-50/50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter un article
        </button>
      </div>

      <Divider />

      {/* ── 3. Coûts logistiques ─────────────────────────────────── */}
      <SectionTitle>Coûts logistiques</SectionTitle>

      <div className="grid grid-cols-3 gap-3">
        <Input
          label="Fret (FCFA)"
          type="number"
          min="0"
          placeholder="0"
          value={form.freightCostFcfa}
          onChange={setField('freightCostFcfa')}
        />
        <Input
          label="Douane (FCFA)"
          type="number"
          min="0"
          placeholder="0"
          value={form.customsCostFcfa}
          onChange={setField('customsCostFcfa')}
        />
        <Input
          label="Autres frais (FCFA)"
          type="number"
          min="0"
          placeholder="0"
          value={form.otherCostsFcfa}
          onChange={setField('otherCostsFcfa')}
        />
      </div>

      {/* Cost summary */}
      {totalCost > 0 && (
        <div className="mt-3 flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-md px-4 py-3 border border-slate-100 dark:border-slate-700">
          <div className="flex justify-between">
            <span>Coût marchandise</span>
            <span className="font-medium">{formatFcfa(productCostFcfa)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Logistique</span>
            <span>{formatFcfa(freight + customs + others)}</span>
          </div>
          <div className="flex justify-between font-semibold text-slate-800 border-t border-slate-200 pt-1 mt-1">
            <span>Coût total</span>
            <span>{formatFcfa(totalCost)}</span>
          </div>
          {totalCartons > 0 && (
            <div className="flex justify-between text-xs text-slate-400">
              <span>Revient / carton</span>
              <span>{formatFcfa(costPerCarton)}</span>
            </div>
          )}
        </div>
      )}

      <Divider />

      {/* ── 4. Simulation de profit ──────────────────────────────── */}
      <SectionTitle>Simulation de profit</SectionTitle>

      <Input
        label="Prix de vente estimé par carton (FCFA)"
        type="number"
        min="0"
        placeholder="50000"
        value={form.simulatedSalePricePerCartonFcfa}
        onChange={setField('simulatedSalePricePerCartonFcfa')}
      />

      {salePrice > 0 && totalCost > 0 && (
        <div className={`mt-3 rounded-md px-4 py-3 border ${grossProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30'}`}>
          <div className="flex items-center gap-2 mb-2">
            {grossProfit >= 0
              ? <TrendingUp className="w-4 h-4 text-emerald-600" />
              : <TrendingDown className="w-4 h-4 text-red-600" />}
            <span className={`text-sm font-semibold ${grossProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {grossProfit >= 0 ? 'Opération rentable' : 'Opération déficitaire'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Revenu estimé</p>
              <p className="font-semibold text-slate-800">{formatFcfa(totalRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Bénéfice brut</p>
              <p className={`font-semibold ${grossProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatFcfa(grossProfit)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Marge</p>
              <p className={`font-semibold ${grossProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {marginPct.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {errors._form && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">{errors._form}</p>
      )}

      {/* ── Actions ─────────────────────────────────────────────── */}
      <div className="flex gap-2 justify-end pt-4 mt-4 border-t border-slate-100">
        <Button type="button" variant="secondary" onClick={onSuccess}>Annuler</Button>
        <Button type="submit" loading={loading}>Créer la commande</Button>
      </div>
    </form>
  )
}

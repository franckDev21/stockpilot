import { useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import type { Product } from '@/types/domain'
import { useProducts } from '@/hooks/useProducts'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { parseProductImages, serializeProductImages } from '@/lib/utils'

const MAX_IMAGES = 6

interface ProductFormProps {
  data?:     Product
  onSuccess: () => void
}

interface FormState {
  reference:             string
  name:                  string
  brand:                 string
  category:              string
  description:           string
  pairsPerCarton:        string
  alertThreshold:        string
  sellingPricePerCarton: string
  images:                string[]
}

const EMPTY: FormState = {
  reference: '', name: '', brand: '', category: '', description: '',
  pairsPerCarton: '12', alertThreshold: '0', sellingPricePerCarton: '0', images: [],
}

export function ProductForm({ data, onSuccess }: ProductFormProps) {
  const { create, update } = useProducts()
  const isEdit = !!data

  const [form, setForm] = useState<FormState>(
    data
      ? {
          reference:             data.reference,
          name:                  data.name,
          brand:                 data.brand ?? '',
          category:              data.category ?? '',
          description:           data.description ?? '',
          pairsPerCarton:        String(data.pairsPerCarton ?? 12),
          alertThreshold:        String(data.alertThreshold),
          sellingPricePerCarton: String(data.sellingPricePerCarton ?? 0),
          images:                parseProductImages(data.imageData),
        }
      : EMPTY,
  )
  const [loading, setLoading]       = useState(false)
  const [imgLoading, setImgLoading] = useState(false)
  const [errors, setErrors]         = useState<Partial<Record<keyof FormState | '_form', string>>>({})

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const handlePickImage = async () => {
    if (imgLoading || form.images.length >= MAX_IMAGES) return
    setImgLoading(true)
    setErrors((prev) => ({ ...prev, images: undefined }))
    try {
      const result = await window.api.dialog.pickImage()
      if (result) {
        setForm((f) => ({ ...f, images: [...f.images, result] }))
      }
    } catch (e) {
      console.error('Erreur image:', e)
      setErrors((prev) => ({
        ...prev,
        images: e instanceof Error ? e.message : "Impossible de charger l'image",
      }))
    } finally {
      setImgLoading(false)
    }
  }

  const removeImage = (index: number) =>
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }))

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.reference.trim()) e.reference = 'La référence est obligatoire'
    if (!form.name.trim())      e.name      = 'Le nom est obligatoire'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        reference:             form.reference.trim(),
        name:                  form.name.trim(),
        brand:                 form.brand.trim()       || null,
        category:              form.category.trim()    || null,
        description:           form.description.trim() || null,
        imageData:             serializeProductImages(form.images),
        pairsPerCarton:        Number(form.pairsPerCarton) || 12,
        alertThreshold:        Number(form.alertThreshold) || 0,
        sellingPricePerCarton: Number(form.sellingPricePerCarton) || 0,
        deletedAt:             null,
      }
      if (isEdit && data) {
        await update(data.id, payload)
      } else {
        await create(payload as Parameters<typeof create>[0])
      }
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrors({ _form: msg || 'Une erreur est survenue, veuillez réessayer' })
      console.error('Erreur enregistrement produit:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* ── Multi-image picker ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
          Photos du produit ({form.images.length}/{MAX_IMAGES})
        </label>

        <div className="grid grid-cols-3 gap-2">
          {form.images.map((src, idx) => (
            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <img src={src} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 p-0.5 bg-black/50 backdrop-blur rounded-full text-white hover:bg-red-600/80 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              {idx === 0 && (
                <span className="absolute bottom-1 left-1 text-[10px] font-bold bg-black/50 text-white px-1.5 py-0.5 rounded">
                  Principal
                </span>
              )}
            </div>
          ))}

          {form.images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={handlePickImage}
              disabled={imgLoading}
              className="aspect-square flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-200 dark:border-slate-700
                         rounded-xl text-slate-400 hover:border-primary-400 hover:text-primary-500 hover:bg-primary-50/30 dark:hover:bg-primary-900/10
                         transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <ImagePlus className="w-5 h-5" />
              <span className="text-[11px] font-medium">
                {imgLoading ? 'Chargement…' : 'Ajouter'}
              </span>
            </button>
          )}
        </div>

        {errors.images && (
          <p className="text-[11px] font-medium text-red-500">{errors.images}</p>
        )}

        {form.images.length > 0 && (
          <p className="text-[11px] text-slate-400">La première photo sera affichée comme image principale.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Référence"
          required
          placeholder="NAF-42"
          value={form.reference}
          onChange={set('reference')}
          error={errors.reference}
        />
        <Input
          label="Nom du modèle"
          required
          placeholder="Nike Air Force 1"
          value={form.name}
          onChange={set('name')}
          error={errors.name}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Marque"
          placeholder="Nike"
          value={form.brand}
          onChange={set('brand')}
        />
        <Input
          label="Catégorie"
          placeholder="Baskets, Sandales…"
          value={form.category}
          onChange={set('category')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Paires par carton"
          type="number"
          min="1"
          placeholder="12"
          value={form.pairsPerCarton}
          onChange={set('pairsPerCarton')}
          suffix="paires"
        />
        <Input
          label="Prix de vente / carton"
          type="number"
          min="0"
          placeholder="25000"
          value={form.sellingPricePerCarton}
          onChange={set('sellingPricePerCarton')}
          suffix="FCFA"
        />
      </div>

      <Input
        label="Seuil d'alerte stock"
        type="number"
        min="0"
        placeholder="5"
        value={form.alertThreshold}
        onChange={set('alertThreshold')}
        suffix="cartons"
      />

      <Textarea
        label="Description (optionnel)"
        placeholder="Coloris, matière, autres détails…"
        value={form.description}
        onChange={set('description')}
      />

      {errors._form && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {errors._form}
        </p>
      )}

      <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
        <Button type="button" variant="secondary" onClick={onSuccess}>Annuler</Button>
        <Button type="submit" loading={loading}>
          {isEdit ? 'Enregistrer' : 'Ajouter le produit'}
        </Button>
      </div>
    </form>
  )
}

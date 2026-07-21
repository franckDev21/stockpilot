import { useState } from 'react'
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

interface OrderPaymentFormProps {
  orderId:   string
  onSuccess: () => void
}

interface FormState {
  amountFcfa:  string
  paymentDate: string
  type:        'deposit' | 'balance' | 'full'
  notes:       string
}

const today = () => new Date().toISOString().slice(0, 10)

const TYPE_OPTIONS = [
  { value: 'deposit', label: 'Acompte'           },
  { value: 'balance', label: 'Solde'              },
  { value: 'full',    label: 'Paiement intégral'  },
]

export function OrderPaymentForm({ orderId, onSuccess }: OrderPaymentFormProps) {
  const { addPayment } = usePurchaseOrders()
  const [form, setForm]     = useState<FormState>({
    amountFcfa: '', paymentDate: today(), type: 'deposit', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!Number(form.amountFcfa)) { setError('Montant invalide'); return }
    setLoading(true)
    try {
      await addPayment(orderId, {
        amountFcfa:  Number(form.amountFcfa),
        paymentDate: form.paymentDate,
        type:        form.type,
        notes:       form.notes.trim() || null,
      })
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || 'Une erreur est survenue')
      console.error('Erreur paiement commande:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Montant (FCFA)"
          type="number"
          min="1"
          placeholder="500000"
          value={form.amountFcfa}
          onChange={set('amountFcfa')}
          error={error}
        />
        <Input
          label="Date de paiement"
          type="date"
          value={form.paymentDate}
          onChange={set('paymentDate')}
        />
      </div>

      <Select
        label="Type de paiement"
        options={TYPE_OPTIONS}
        value={form.type}
        onChange={set('type') as (e: React.ChangeEvent<HTMLSelectElement>) => void}
      />

      <Textarea
        label="Notes (optionnel)"
        placeholder="Référence virement, remarques…"
        value={form.notes}
        onChange={set('notes')}
      />

      <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
        <Button type="button" variant="secondary" onClick={onSuccess}>Annuler</Button>
        <Button type="submit" loading={loading}>Enregistrer le paiement</Button>
      </div>
    </form>
  )
}

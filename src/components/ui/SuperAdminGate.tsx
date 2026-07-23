import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Modal } from './Modal'
import { Input } from './Input'
import { Button } from './Button'

/**
 * Porte de confirmation « super-admin » : demande le mot de passe dédié avant
 * une action sensible (ex. modifier un arrivage). Vérification côté process main
 * (auth:verifySuperAdmin) — le mot de passe ne transite jamais en clair dans le
 * renderer autrement que le temps de la saisie.
 */
export function SuperAdminGate({
  isOpen, onClose, onVerified, title = 'Action réservée au super-admin', message,
}: {
  isOpen:     boolean
  onClose:    () => void
  onVerified: () => void
  title?:     string
  message?:   string
}) {
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  const reset = () => { setPassword(''); setError(null); setLoading(false) }

  const handleClose = () => { reset(); onClose() }

  const submit = async () => {
    if (!password) { setError('Saisissez le mot de passe super-admin.'); return }
    setLoading(true)
    setError(null)
    try {
      const { ok } = await window.api.auth.verifySuperAdmin(password)
      if (!ok) { setError('Mot de passe super-admin incorrect.'); setLoading(false); return }
      reset()
      onVerified()
    } catch {
      setError('Erreur de vérification, veuillez réessayer.')
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
        <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
          <ShieldCheck className="w-4 h-4 text-primary-600" />
        </div>
        <p className="text-sm">{message ?? 'Cette action est protégée. Confirmez avec le mot de passe super-admin.'}</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit() }} className="flex flex-col gap-3">
        <Input
          label="Mot de passe super-admin"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error ?? undefined}
          autoFocus
          placeholder="••••••••"
        />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={handleClose}>Annuler</Button>
          <Button type="submit" size="sm" loading={loading}>Déverrouiller</Button>
        </div>
      </form>
    </Modal>
  )
}

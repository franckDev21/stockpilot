import { useEffect, useState } from 'react'
import { Loader2, Server, X, CheckCircle2, AlertTriangle } from 'lucide-react'

/**
 * Envoi de la base du poste vers le serveur.
 *
 * Sert à réunir les données de plusieurs postes sans transfert manuel.
 *
 * Deux clics et rien à saisir : l'app embarque un jeton dont l'unique pouvoir
 * est de déposer une base, et le nom du poste vient de la machine. La saisie
 * d'identifiants n'apparaît qu'en dernier recours — build sans jeton, ou jeton
 * révoqué côté serveur — pour que le bouton reste utilisable dans tous les cas.
 *
 * Envoyer sa base ne déclenche jamais la synchronisation périodique : rien
 * n'est enregistré sur ce poste.
 */
export function SendDatabaseModal({ onClose }: { onClose: () => void }) {
  const [posteLabel, setPosteLabel] = useState('')
  const [apiUrl, setApiUrl]         = useState('https://stockpilot.feujio.com')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [besoinIdentifiants, setBesoinIdentifiants] = useState(false)
  const [chargement, setChargement] = useState(true)
  const [envoi, setEnvoi]           = useState(false)
  const [erreur, setErreur]         = useState<string | null>(null)
  const [succes, setSucces]         = useState<{ sizeBytes?: number } | null>(null)

  // Nom du poste et destination sont connus de l'app : on les affiche pour que
  // l'utilisateur confirme en connaissance de cause, sans avoir à les taper.
  useEffect(() => {
    let vivant = true
    window.api.backup
      .uploadInfo()
      .then((infos) => {
        if (!vivant) return
        setPosteLabel(infos.posteLabel)
        setApiUrl(infos.apiUrl)
        setBesoinIdentifiants(!infos.sansIdentifiants)
      })
      .catch(() => undefined)
      .finally(() => vivant && setChargement(false))
    return () => {
      vivant = false
    }
  }, [])

  const envoyer = async () => {
    setEnvoi(true)
    setErreur(null)
    try {
      const res = await window.api.backup.upload({
        posteLabel,
        credentials: besoinIdentifiants ? { apiUrl, email, password } : undefined,
      })

      if (res.success) {
        setSucces({ sizeBytes: res.sizeBytes })
        return
      }

      // Le jeton embarqué peut avoir été révoqué : on bascule alors sur la
      // saisie manuelle plutôt que de laisser l'utilisateur sans recours.
      if (!besoinIdentifiants) {
        setBesoinIdentifiants(true)
        setErreur(
          `${res.message ?? 'Échec de l’envoi.'} Vous pouvez réessayer avec vos identifiants.`,
        )
        return
      }
      setErreur(res.message ?? 'Échec de l’envoi.')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e))
    } finally {
      setEnvoi(false)
    }
  }

  const champsManquants =
    !posteLabel.trim() || (besoinIdentifiants && (!apiUrl.trim() || !email.trim() || !password))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-3">
          <span className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            <Server className="h-4 w-4" />
            Envoyer ma base au serveur
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {succes ? (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Base envoyée</p>
                <p className="text-xs">
                  {succes.sizeBytes
                    ? `${(succes.sizeBytes / 1048576).toFixed(1)} Mo transmis.`
                    : 'Transmission terminée.'}
                </p>
              </div>
            </div>
          ) : chargement ? (
            <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Préparation…
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Une copie complète de la base de ce poste va être envoyée au serveur.
              </p>

              <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-3 text-xs">
                <div className="flex justify-between gap-3 py-0.5">
                  <span className="text-slate-500 dark:text-slate-400">Ce poste</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{posteLabel}</span>
                </div>
                <div className="flex justify-between gap-3 py-0.5">
                  <span className="text-slate-500 dark:text-slate-400">Destination</span>
                  <span className="truncate font-semibold text-slate-700 dark:text-slate-200">
                    {apiUrl.replace(/^https?:\/\//, '')}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rien n’est modifié sur ce poste, et la synchronisation n’est pas activée.
              </p>

              {besoinIdentifiants && (
                <div className="space-y-2 rounded-lg bg-slate-50 dark:bg-slate-700/50 p-3">
                  <input
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="URL de l’API"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
                               px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    autoComplete="off"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
                               px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mot de passe"
                    autoComplete="off"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
                               px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Utilisés uniquement pour cet envoi, ils ne sont pas enregistrés.
                  </p>
                </div>
              )}

              {erreur && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{erreur}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-700 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300
                       hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            {succes ? 'Fermer' : 'Annuler'}
          </button>
          {!succes && (
            <button
              onClick={envoyer}
              disabled={envoi || chargement || champsManquants}
              className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold
                         text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {envoi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Server className="h-3.5 w-3.5" />}
              {envoi ? 'Envoi…' : 'Confirmer l’envoi'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

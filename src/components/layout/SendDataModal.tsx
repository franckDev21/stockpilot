import { useEffect, useRef, useState } from 'react'
import { Loader2, UploadCloud, X, CheckCircle2, AlertTriangle, Database } from 'lucide-react'

/**
 * « Envoyer mes données au serveur ».
 *
 * Envoie tout ce que ce poste contient — produits, fournisseurs, clients,
 * commandes, réceptions, transferts, ventes — vers le serveur, en deux clics et
 * sans mot de passe : l'app embarque un jeton dont le seul pouvoir est de
 * déposer des données (il ne peut rien lire).
 *
 * Rien n'est modifié sur ce poste : c'est un envoi, pas une synchronisation.
 * Les données de l'autre poste ne descendent pas ici tant que la synchronisation
 * n'a pas été activée — comparer les deux bases doit rester une décision.
 */
export function SendDataModal({
  onClose, onSendFile,
}: {
  onClose: () => void
  /** Repli : envoyer le FICHIER de base plutôt que les données (fusion manuelle). */
  onSendFile?: () => void
}) {
  const [posteLabel, setPosteLabel] = useState('')
  const [apiUrl, setApiUrl]         = useState('https://stockpilot.feujio.com')
  const [besoinIdentifiants, setBesoinIdentifiants] = useState(false)
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [chargement, setChargement] = useState(true)
  const [envoi, setEnvoi]           = useState(false)
  const [progres, setProgres]       = useState<{ entity: string; done: number; total: number } | null>(null)
  const [erreur, setErreur]         = useState<string | null>(null)
  const [resume, setResume]         = useState<PushSummary | null>(null)

  // Le désabonnement doit survivre au démontage même en plein envoi.
  const desabonner = useRef<() => void>(() => {})

  useEffect(() => {
    let vivant = true
    window.api.sync
      .pushInfo()
      .then((infos) => {
        if (!vivant) return
        setPosteLabel(infos.posteLabel)
        setApiUrl(infos.apiUrl)
        setBesoinIdentifiants(!infos.sansIdentifiants)
      })
      .catch(() => undefined)
      .finally(() => vivant && setChargement(false))

    desabonner.current = window.api.sync.onPushProgress((p) => setProgres(p))
    return () => {
      vivant = false
      desabonner.current()
    }
  }, [])

  const envoyer = async () => {
    setEnvoi(true)
    setErreur(null)
    setProgres(null)
    try {
      const res = await window.api.sync.pushAll(
        besoinIdentifiants ? { credentials: { apiUrl, email, password } } : undefined,
      )

      // Un envoi peut réussir dans l'ensemble tout en refusant des lignes : on
      // montre le détail plutôt qu'un « terminé » trompeur.
      if (res.success || Object.keys(res.counts).length > 0) {
        setResume(res)
        if (res.message) setErreur(res.message)
        return
      }

      // Jeton révoqué ou build sans jeton : on bascule sur la saisie manuelle
      // plutôt que de laisser l'utilisateur sans recours.
      if (!besoinIdentifiants) {
        setBesoinIdentifiants(true)
        setErreur(`${res.message ?? 'Échec de l’envoi.'} Vous pouvez réessayer avec vos identifiants.`)
        return
      }
      setErreur(res.message ?? 'Échec de l’envoi.')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e))
    } finally {
      setEnvoi(false)
      setProgres(null)
    }
  }

  const champsManquants = besoinIdentifiants && (!apiUrl.trim() || !email.trim() || !password)
  const pourcentage = progres && progres.total > 0 ? Math.round((progres.done / progres.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-3">
          <span className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            <UploadCloud className="h-4 w-4" />
            Envoyer mes données au serveur
          </span>
          <button onClick={onClose} disabled={envoi} className="text-slate-400 hover:text-slate-600 disabled:opacity-40">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
          {resume ? (
            <ResumeEnvoi resume={resume} />
          ) : chargement ? (
            <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Préparation…
            </div>
          ) : envoi ? (
            <div className="space-y-2 py-2">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progres ? `Envoi — ${progres.entity}…` : 'Préparation de l’envoi…'}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-primary-600 transition-all duration-300"
                  style={{ width: `${pourcentage}%` }}
                />
              </div>
              {progres && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {progres.done} / {progres.total} lignes envoyées
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ne fermez pas l’application. Un envoi interrompu reprend là où il s’est arrêté.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Toutes les données de ce poste (produits, clients, fournisseurs, commandes,
                réceptions, transferts, ventes) vont être envoyées au serveur.
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
                Rien n’est modifié sur ce poste et la synchronisation automatique n’est pas activée.
                Le serveur garde, pour chaque ligne, la version la plus récente.
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
            </>
          )}

          {erreur && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{erreur}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-700 px-5 py-3">
          {onSendFile && !envoi && !resume ? (
            <button
              onClick={onSendFile}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-700
                         dark:text-slate-400 dark:hover:text-slate-200"
              title="Envoyer le fichier de base complet (pour une fusion manuelle)"
            >
              <Database className="h-3 w-3" />
              Envoyer plutôt le fichier de base
            </button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={envoi}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300
                         hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
            >
              {resume ? 'Fermer' : 'Annuler'}
            </button>
            {!resume && (
              <button
                onClick={envoyer}
                disabled={envoi || chargement || champsManquants}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold
                           text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {envoi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                {envoi ? 'Envoi…' : 'Confirmer l’envoi'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const LIBELLES: Record<string, string> = {
  warehouses:      'Entrepôts',
  suppliers:       'Fournisseurs',
  customers:       'Clients',
  products:        'Produits',
  purchase_orders: 'Commandes',
  receptions:      'Réceptions',
  transfers:       'Transferts',
  sales:           'Ventes',
}

/**
 * Le détail de ce que le serveur a fait. « Déjà à jour » n'est pas un échec :
 * c'est le cas normal quand on renvoie deux fois — d'où l'affichage séparé,
 * sinon un second envoi donnerait l'impression que rien n'est parti.
 */
function ResumeEnvoi({ resume }: { resume: PushSummary }) {
  const lignes = Object.entries(resume.counts)
  const totalCree = lignes.reduce((n, [, c]) => n + c.created, 0)
  const totalMaj  = lignes.reduce((n, [, c]) => n + c.updated, 0)

  return (
    <div className="space-y-3">
      <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
        resume.rejectedCount === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}>
        {resume.rejectedCount === 0
          ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
        <div>
          <p className="font-semibold">
            {resume.rejectedCount === 0 ? 'Données envoyées' : 'Envoyées, avec des lignes refusées'}
          </p>
          <p className="text-xs">
            {totalCree} ajoutée{totalCree > 1 ? 's' : ''} au serveur, {totalMaj} mise{totalMaj > 1 ? 's' : ''} à jour
            {resume.durationMs > 0 && ` — ${Math.max(1, Math.round(resume.durationMs / 1000))} s`}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        L’autre poste recevra ces données automatiquement — ou tout de suite, en cliquant sur
        « Synchroniser maintenant » dans l’indicateur de synchronisation.
      </p>

      {lignes.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400">
              <th className="py-1 text-left font-medium">Entité</th>
              <th className="py-1 text-right font-medium">Ajoutées</th>
              <th className="py-1 text-right font-medium">À jour</th>
              <th className="py-1 text-right font-medium">Déjà à jour</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(([key, c]) => (
              <tr key={key} className="border-t border-slate-100 dark:border-slate-700">
                <td className="py-1 text-slate-600 dark:text-slate-300">{LIBELLES[key] ?? key}</td>
                <td className="py-1 text-right font-semibold text-slate-700 dark:text-slate-200">{c.created}</td>
                <td className="py-1 text-right text-slate-500">{c.updated}</td>
                <td className="py-1 text-right text-slate-400">{c.unchanged}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {resume.rejectedCount > 0 && (
        <div className="space-y-1 rounded-lg bg-amber-50 p-3 text-[11px] text-amber-800">
          <p className="font-semibold">{resume.rejectedCount} ligne(s) refusée(s)</p>
          {resume.rejected.slice(0, 8).map((r) => (
            <p key={`${r.entity}-${r.id}`} className="truncate">
              {LIBELLES[r.entity] ?? r.entity} — {r.reason}
            </p>
          ))}
          {resume.rejected.length > 8 && <p>…et {resume.rejected.length - 8} autre(s).</p>}
        </div>
      )}
    </div>
  )
}

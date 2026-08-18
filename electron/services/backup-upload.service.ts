import { app } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getSqlite } from '../db/index'
import { getDefaultApiUrl, readConfig, readDotEnv } from './sync-config.service'

// Jeton d'envoi injecte a la compilation (voir vite.config.ts et le workflow de
// release). Il n'est PAS dans le depot : celui-ci est public, condition de
// l'auto-update. Sans lui — build local sans le secret — on retombe sur la
// demande d'identifiants.
declare const __UPLOAD_TOKEN__: string | undefined

// ─── Envoi de la base du poste vers le serveur ───────────────────────────────
// Sert à réunir sur le serveur les données de plusieurs postes sans transfert
// manuel. On envoie le FICHIER de base entier, pas des entités : c'est ce qui
// permet ensuite de comparer et fusionner deux postes qui ont divergé.
//
// ⚠️ Volontairement DÉCOUPLÉ de la synchronisation. Se connecter via le panneau
// de synchro écrit `sync-config.json` et déclenche la synchro périodique — ce
// qu'on ne veut pas forcément avant d'avoir fusionné. Ici, si aucune config
// n'existe, on obtient un jeton pour cet envoi seulement, sans rien persister.
//
// L'app embarque un jeton dédié, dont l'unique pouvoir côté serveur est de
// déposer une base (ability `backups:upload`) : il ne peut ni écrire ailleurs,
// ni lire, ni supprimer les bases déjà déposées. C'est ce qui permet d'envoyer
// en deux clics, sans mot de passe à saisir.

export interface UploadResult {
  success:    boolean
  message?:   string
  sizeBytes?: number
  backupId?:  string
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Jeton pour un envoi ponctuel, sans écrire de configuration de synchro. */
async function tokenSansPersistance(
  apiUrl: string, email: string, password: string,
): Promise<{ token: string } | { erreur: string }> {
  const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify({ email, password }),
  })
  const text = await res.text()
  const json = (text ? JSON.parse(text) : {}) as Record<string, unknown>
  if (!res.ok) {
    return { erreur: typeof json.message === 'string' ? json.message : `HTTP ${res.status}` }
  }
  if (typeof json.token !== 'string') return { erreur: 'Réponse API invalide (token manquant).' }
  return { token: json.token }
}

/** Le jeton d'envoi embarqué, ou '' si ce build n'en contient pas. */
function jetonEmbarque(): string {
  const compile = typeof __UPLOAD_TOKEN__ === 'string' ? __UPLOAD_TOKEN__ : ''
  if (compile) return compile
  // En dev, un .env permet de tester sans reconstruire.
  const env = readDotEnv()
  return env.UPLOAD_TOKEN || env.VITE_UPLOAD_TOKEN || ''
}

/**
 * Nom par défaut du poste : celui de la machine.
 *
 * C'est ce qui distingue les bases côté serveur ; le demander à l'utilisateur
 * ajoutait une saisie sans rien apporter, la machine connaissant déjà son nom.
 */
export function nomPosteParDefaut(): string {
  return (os.hostname() || 'poste').trim().slice(0, 100)
}

/** Ce que l'interface doit savoir avant de proposer l'envoi. */
export function infosEnvoi(): { posteLabel: string; apiUrl: string; sansIdentifiants: boolean } {
  const cfg = readConfig()
  return {
    posteLabel:       nomPosteParDefaut(),
    apiUrl:           cfg?.apiUrl ?? getDefaultApiUrl(),
    sansIdentifiants: Boolean(cfg?.token) || Boolean(jetonEmbarque()),
  }
}

export async function uploadDatabase(opts: {
  posteLabel?:  string
  credentials?: { apiUrl: string; email: string; password: string }
}): Promise<UploadResult> {
  const label = (opts.posteLabel ?? '').trim() || nomPosteParDefaut()

  // 1) De quoi s'authentifier. Des identifiants saisis passent DEVANT le reste :
  //    c'est la porte de secours si le jeton embarqué venait à être révoqué,
  //    sinon un jeton mort rendrait le bouton inutilisable sans recours.
  const cfg = readConfig()
  const embarque = jetonEmbarque()
  let apiUrl: string
  let token: string

  if (opts.credentials) {
    apiUrl = opts.credentials.apiUrl.trim().replace(/\/$/, '')
    const r = await tokenSansPersistance(apiUrl, opts.credentials.email.trim(), opts.credentials.password)
    if ('erreur' in r) return { success: false, message: r.erreur }
    token = r.token
  } else if (cfg) {
    apiUrl = cfg.apiUrl
    token  = cfg.token
  } else if (embarque) {
    apiUrl = getDefaultApiUrl()
    token  = embarque
  } else {
    return { success: false, message: 'Aucune connexion à l’API : renseignez URL, email et mot de passe.' }
  }

  // 2) Copie cohérente de la base. `.backup()` et pas une copie brute : en mode
  //    WAL, le fichier principal seul est incomplet, voire vide.
  const tmp = path.join(app.getPath('temp'), `stockpilot-envoi-${Date.now()}.db`)

  try {
    await getSqlite().backup(tmp)
    const contenu = fs.readFileSync(tmp)

    const form = new FormData()
    form.append('poste_label', label)
    form.append('app_version', app.getVersion())
    form.append('database', new Blob([contenu]), `${label}.db`)

    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/backups`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body:    form,
    })

    const text = await res.text()
    const json = (text ? JSON.parse(text) : {}) as Record<string, unknown>

    if (!res.ok) {
      const message = typeof json.message === 'string' ? json.message : `HTTP ${res.status}`
      return { success: false, message }
    }

    return {
      success:   true,
      sizeBytes: typeof json.sizeBytes === 'number' ? json.sizeBytes : contenu.length,
      backupId:  typeof json.id === 'string' ? json.id : undefined,
    }
  } catch (e) {
    return { success: false, message: errMessage(e) }
  } finally {
    fs.rmSync(tmp, { force: true })
  }
}

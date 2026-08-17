import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { getSqlite } from '../db/index'
import { readConfig } from './sync-config.service'

// ─── Envoi de la base du poste vers le serveur ───────────────────────────────
// Sert à réunir sur le serveur les données de plusieurs postes sans transfert
// manuel. On envoie le FICHIER de base entier, pas des entités : c'est ce qui
// permet ensuite de comparer et fusionner deux postes qui ont divergé.
//
// ⚠️ Volontairement DÉCOUPLÉ de la synchronisation. Se connecter via le panneau
// de synchro écrit `sync-config.json` et déclenche la synchro périodique — ce
// qu'on ne veut pas forcément avant d'avoir fusionné. Ici, si aucune config
// n'existe, on obtient un jeton pour cet envoi seulement, sans rien persister.

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

export async function uploadDatabase(opts: {
  posteLabel:   string
  credentials?: { apiUrl: string; email: string; password: string }
}): Promise<UploadResult> {
  const label = opts.posteLabel.trim()
  if (!label) return { success: false, message: 'Indiquez un nom de poste (ex. « bureau »).' }

  // 1) De quoi s'authentifier : config de synchro existante, sinon identifiants fournis.
  const cfg = readConfig()
  let apiUrl: string
  let token: string

  if (cfg) {
    apiUrl = cfg.apiUrl
    token  = cfg.token
  } else if (opts.credentials) {
    apiUrl = opts.credentials.apiUrl.trim().replace(/\/$/, '')
    const r = await tokenSansPersistance(apiUrl, opts.credentials.email.trim(), opts.credentials.password)
    if ('erreur' in r) return { success: false, message: r.erreur }
    token = r.token
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

import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

// ── Configuration de synchronisation avec l'API en ligne ─────────────────────
// Stockée dans un fichier userData (comme session.json) : URL de l'API, email
// de connexion, et le bearer token Sanctum obtenu après login. Le mot de passe
// n'est JAMAIS persisté — seul le token qui en résulte est conservé.

// Jeton embarque a la compilation (voir vite.config.ts et le workflow de
// release). Il n'est PAS dans le depot : celui-ci est public, condition de
// l'auto-update. Ses abilities cote serveur sont volontairement etroites —
// deposer une base, envoyer ses donnees, tirer le bundle — et rien d'autre.
declare const __UPLOAD_TOKEN__: string | undefined

export interface SyncConfig {
  apiUrl: string
  email:  string
  token:  string
}

function configFile(): string {
  return path.join(app.getPath('userData'), 'sync-config.json')
}

// ─── .env (dev uniquement) ────────────────────────────────────────────────────
// Fallback pratique en développement : un fichier .env à la racine du projet
// peut définir VITE_API_URL / VITE_API_EMAIL / VITE_API_PASSWORD. Jamais commité
// (voir .gitignore). En production packagée, ce fichier n'existe simplement pas.

let cachedEnvFile: Record<string, string> | null = null

export function readDotEnv(): Record<string, string> {
  if (cachedEnvFile) return cachedEnvFile
  const map: Record<string, string> = {}
  try {
    const envPath = path.join(process.env.APP_ROOT ?? process.cwd(), '.env')
    const raw = fs.readFileSync(envPath, 'utf-8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      let value = trimmed.slice(idx + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      map[key] = value
    }
  } catch {
    // Pas de .env — normal en production packagée
  }
  cachedEnvFile = map
  return map
}

const DEFAULT_API_URL = 'https://stockpilot.feujio.com'

/** URL de l'API par défaut : config persistée > .env (dev) > fallback local. */
export function getDefaultApiUrl(): string {
  const persisted = readConfig()
  if (persisted?.apiUrl) return persisted.apiUrl
  const env = readDotEnv()
  return env.VITE_API_URL || env.API_URL || DEFAULT_API_URL
}

/** Identifiants par défaut pour préremplir le formulaire en dev (jamais le mot de passe en persistant). */
export function getDevDefaults(): { apiUrl: string; email: string; password: string } {
  const env = readDotEnv()
  return {
    apiUrl:   env.VITE_API_URL || env.API_URL || DEFAULT_API_URL,
    email:    env.VITE_API_EMAIL || env.API_EMAIL || '',
    password: env.VITE_API_PASSWORD || env.API_PASSWORD || '',
  }
}

/** Le jeton embarque au build, ou '' si ce build n'en contient pas. */
export function jetonPoste(): string {
  const compile = typeof __UPLOAD_TOKEN__ === 'string' ? __UPLOAD_TOKEN__ : ''
  if (compile) return compile
  // En dev, un .env permet de tester sans reconstruire.
  const env = readDotEnv()
  return env.UPLOAD_TOKEN || env.VITE_UPLOAD_TOKEN || ''
}

/**
 * Configuration implicite d'un poste jamais connecte : le jeton embarque suffit
 * a envoyer ses donnees et a recuperer celles du serveur. C'est ce qui permet a
 * la synchronisation de fonctionner sans que personne n'ait a saisir un mot de
 * passe — et donc de fonctionner tout court, personne ne l'ayant jamais activee.
 *
 * Rien n'est ecrit sur le disque : ce n'est pas une configuration persistee,
 * c'est le mode par defaut.
 */
export function posteConfig(): SyncConfig | null {
  const token = jetonPoste()
  if (!token) return null
  return { apiUrl: getDefaultApiUrl(), email: '', token }
}

/** La configuration a utiliser : celle saisie par l'utilisateur, sinon le mode poste. */
export function effectiveConfig(): SyncConfig | null {
  return readConfig() ?? posteConfig()
}

export function readConfig(): SyncConfig | null {
  try {
    const raw = JSON.parse(fs.readFileSync(configFile(), 'utf-8')) as Partial<SyncConfig>
    if (!raw.apiUrl || !raw.token) return null
    return { apiUrl: raw.apiUrl, email: raw.email ?? '', token: raw.token }
  } catch {
    return null
  }
}

export function writeConfig(cfg: SyncConfig): void {
  fs.mkdirSync(path.dirname(configFile()), { recursive: true })
  fs.writeFileSync(configFile(), JSON.stringify(cfg, null, 2), 'utf-8')
}

export function clearConfig(): void {
  try {
    fs.unlinkSync(configFile())
  } catch {
    // rien à supprimer
  }
}

export function isConfigured(): boolean {
  return readConfig() !== null
}

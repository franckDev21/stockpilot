import type { IpcMain } from 'electron'
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

// ── Identifiants administrateur ───────────────────────────────────────────────
// Modifiez ces valeurs pour changer les identifiants de connexion
const ADMIN_EMAIL    = 'feujiodoungue@gmail.com'
const ADMIN_PASSWORD = 'password'

// Mot de passe « super-admin » exigé pour les actions sensibles réservées à
// l'administrateur (ex. modifier un arrivage déjà réceptionné). Distinct du mot
// de passe de connexion : à changer ici pour le personnaliser.
const SUPER_ADMIN_PASSWORD = 'superadmin'

// Session persistée dans un fichier (userData) → survit à la fermeture de l'app,
// plus fiable que le localStorage du renderer en mode packagé (origine file://).
function sessionFile(): string {
  return path.join(app.getPath('userData'), 'session.json')
}

function readSession(): boolean {
  try {
    const raw = fs.readFileSync(sessionFile(), 'utf-8')
    return JSON.parse(raw).authenticated === true
  } catch {
    return false
  }
}

function writeSession(authenticated: boolean): void {
  try {
    fs.writeFileSync(sessionFile(), JSON.stringify({ authenticated }), 'utf-8')
  } catch (err) {
    console.error('writeSession error:', err)
  }
}

export function registerAuthHandlers(ipc: IpcMain): void {
  ipc.handle('auth:login', (_e, email: string, password: string) => {
    if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      writeSession(true)
      return { success: true }
    }
    return { success: false, message: 'Email ou mot de passe incorrect.' }
  })

  ipc.handle('auth:getSession', () => ({ authenticated: readSession() }))

  ipc.handle('auth:logout', () => {
    writeSession(false)
    return { success: true }
  })

  // Vérifie le mot de passe super-admin pour débloquer une action sensible.
  // Ne modifie pas la session : c'est une confirmation ponctuelle.
  ipc.handle('auth:verifySuperAdmin', (_e, password: string) => ({
    ok: password === SUPER_ADMIN_PASSWORD,
  }))
}

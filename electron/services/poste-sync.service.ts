import { app } from 'electron'
import os from 'node:os'
import { getDb } from '../db/index'
import {
  warehouses, products, suppliers, customers,
  purchaseOrders, purchaseOrderItems, cartonSizeCompositions, orderPayments,
  receptions, receptionItems, transfers, transferItems,
  sales, saleItems, salePayments,
} from '../db/schema'
import { getDefaultApiUrl, jetonPoste, readConfig } from './sync-config.service'
import {
  applyBundle, getLastSyncedAt, marquerSynchronise, ORDRE_ENTITES, runSync,
  type SyncBundle, type SyncSummary,
} from './sync.service'

// ─── « Envoyer mes données au serveur » ───────────────────────────────────────
//
// Envoie au serveur TOUT ce que ce poste contient (produits, fournisseurs,
// clients, commandes, réceptions, transferts, ventes), en deux clics et sans
// mot de passe. C'est ce qui fait qu'un poste isolé rejoint enfin le serveur :
// tant que personne n'a poussé, les deux postes n'ont aucun point de rendez-vous
// et « les versions ne se synchronisent pas ».
//
// Trois différences volontaires avec la synchronisation périodique :
//
// 1. **On n'écrit rien ici.** Aucune configuration de synchro n'est créée, aucune
//    donnée du serveur n'est ramenée. Envoyer est sans effet sur ce poste : tant
//    que les deux bases n'ont pas été comparées, ramener les données de l'autre
//    poste doit rester une décision, pas un effet de bord.
// 2. **On ne lit pas l'API.** La synchro commence par tirer chaque entité pour
//    savoir quoi pousser ; il lui faut donc un jeton de lecture. Le jeton
//    embarqué dans l'exécutable n'a que l'ability `sync:push` : il dépose et ne
//    peut rien consulter. Comme l'exécutable est public, c'est ce qui évite qu'un
//    jeton extrait du binaire donne accès aux données du client.
// 3. **On envoie par lots.** Un poste avec 500 ventes fait 500 requêtes en synchro
//    classique — sur une liaison lente, l'envoi n'arrivait jamais au bout. Ici
//    quelques requêtes suffisent, et chaque lot est réessayé s'il échoue.
//
// Le serveur tranche les conflits à la dernière écriture (comparaison des
// `updated_at`) et rejoue lui-même les mouvements de stock ; les envoyer serait
// le seul moyen sûr de doubler le stock (chaque poste génère ses propres lignes
// de mouvement pour un même événement réel).

/** Nombre de lignes maximum par requête, toutes entités confondues. */
const MAX_ROWS_PAR_LOT = 200

/**
 * Taille visée d'un lot. Le plafond réel de la chaîne est de 50 Mo (nginx public),
 * mais viser petit permet de réessayer un lot sans tout recommencer, et de voir
 * la progression avancer sur une liaison lente. Les produits portent leur image
 * en base64 : un seul peut peser plusieurs centaines de Ko.
 */
const MAX_OCTETS_PAR_LOT = 2_000_000

const TIMEOUT_LOT_MS = 120_000
const ESSAIS_PAR_LOT = 3

export interface PushCounts { created: number; updated: number; unchanged: number }

export interface PushSummary {
  success:       boolean
  message?:      string
  /** Lignes lues sur ce poste et envoyées, par entité. */
  sent:          Record<string, number>
  /** Ce que le serveur en a fait, par entité. */
  counts:        Record<string, PushCounts>
  rejectedCount: number
  rejected:      Array<{ entity: string; id: string; reason: string }>
  requests:      number
  durationMs:    number
}

export interface PushProgress {
  /** Entité en cours d'envoi (nom lisible). */
  entity:  string
  /** Lignes déjà envoyées, toutes entités confondues. */
  done:    number
  /** Lignes à envoyer en tout. */
  total:   number
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function toSnakeCase(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toSnakeCase)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`)] = toSnakeCase(v)
    }
    return out
  }
  return value
}

/**
 * Compare des horodatages quel que soit leur format : SQLite écrit
 * « YYYY-MM-DD HH:MM:SS » en UTC sans fuseau, l'API renvoie de l'ISO 8601.
 * Les comparer comme des chaînes désignerait le mauvais gagnant.
 */
function toEpoch(value: string | null | undefined): number {
  if (!value) return 0
  const normalise = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value
  const t = new Date(normalise).getTime()
  return Number.isNaN(t) ? 0 : t
}

function groupBy<T>(rows: T[], keyFn: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyFn(row)
    const list = map.get(key)
    if (list) list.push(row)
    else map.set(key, [row])
  }
  return map
}

export function nomPoste(): string {
  return (os.hostname() || 'poste').trim().slice(0, 100)
}

// ─── Lecture du poste ─────────────────────────────────────────────────────────

type Row = Record<string, unknown>

/**
 * Tout ce que ce poste a à dire, dans l'ordre imposé par les clés étrangères :
 * une vente ne peut pas arriver avant son produit.
 *
 * @param depuis ne renvoyer que ce qui a bougé depuis cet horodatage. La synchro
 *        automatique tourne toutes les 3 minutes : sans ce filtre elle
 *        réexpédierait toute la base — photos produit comprises — à chaque
 *        passage. Le bouton, lui, envoie tout (depuis = null), c'est le sens de
 *        « renvoyer mes données ».
 *
 * Une commande ou une vente est incluse dès qu'UNE de ses lignes a bougé : un
 * règlement ajouté après coup ne touche pas toujours l'en-tête, et il serait
 * resté à quai.
 */
function lireDonneesLocales(depuis?: string | null): Array<{ key: string; label: string; rows: Row[] }> {
  const db = getDb()
  const seuil = toEpoch(depuis)
  const recent = (row: { updatedAt?: string | null }): boolean => seuil === 0 || toEpoch(row.updatedAt) > seuil
  const recentParmi = (rows: Array<{ updatedAt?: string | null }>): boolean => rows.some(recent)

  const snake = (rows: unknown[]): Row[] => rows.map((r) => toSnakeCase(r) as Row)

  // Commandes : lignes, tailles et règlements voyagent avec leur en-tête.
  const orderItems  = db.select().from(purchaseOrderItems).all()
  const sizes       = groupBy(db.select().from(cartonSizeCompositions).all(), (s) => s.orderItemId)
  const itemsByOrder = groupBy(orderItems, (i) => i.orderId)
  const paymentsByOrder = groupBy(db.select().from(orderPayments).all(), (p) => p.orderId)

  const orders = db.select().from(purchaseOrders).all().filter((o) =>
    recent(o)
    || recentParmi(itemsByOrder.get(o.id) ?? [])
    || recentParmi(paymentsByOrder.get(o.id) ?? []),
  ).map((o) => ({
    ...(toSnakeCase(o) as Row),
    items: (itemsByOrder.get(o.id) ?? []).map((i) => ({
      ...(toSnakeCase(i) as Row),
      size_compositions: snake(sizes.get(i.id) ?? []),
    })),
    payments: snake(paymentsByOrder.get(o.id) ?? []),
  }))

  const receptionItemsByReception = groupBy(db.select().from(receptionItems).all(), (i) => i.receptionId)
  const receptionRows = db.select().from(receptions).all().filter((r) =>
    recent(r) || recentParmi(receptionItemsByReception.get(r.id) ?? []),
  ).map((r) => ({
    ...(toSnakeCase(r) as Row),
    items: snake(receptionItemsByReception.get(r.id) ?? []),
  }))

  const transferItemsByTransfer = groupBy(db.select().from(transferItems).all(), (i) => i.transferId)
  const transferRows = db.select().from(transfers).all().filter((t) =>
    recent(t) || recentParmi(transferItemsByTransfer.get(t.id) ?? []),
  ).map((t) => ({
    ...(toSnakeCase(t) as Row),
    items: snake(transferItemsByTransfer.get(t.id) ?? []),
  }))

  const saleItemsBySale    = groupBy(db.select().from(saleItems).all(), (i) => i.saleId)
  const salePaymentsBySale = groupBy(db.select().from(salePayments).all(), (p) => p.saleId)
  const saleRows = db.select().from(sales).all().filter((s) =>
    recent(s)
    || recentParmi(saleItemsBySale.get(s.id) ?? [])
    || recentParmi(salePaymentsBySale.get(s.id) ?? []),
  ).map((s) => ({
    ...(toSnakeCase(s) as Row),
    items:    snake(saleItemsBySale.get(s.id) ?? []),
    payments: snake(salePaymentsBySale.get(s.id) ?? []),
  }))

  return [
    { key: 'warehouses',      label: 'Entrepôts',    rows: snake(db.select().from(warehouses).all().filter(recent)) },
    { key: 'suppliers',       label: 'Fournisseurs', rows: snake(db.select().from(suppliers).all().filter(recent)) },
    { key: 'customers',       label: 'Clients',      rows: snake(db.select().from(customers).all().filter(recent)) },
    { key: 'products',        label: 'Produits',     rows: snake(db.select().from(products).all().filter(recent)) },
    { key: 'purchase_orders', label: 'Commandes',    rows: orders },
    { key: 'receptions',      label: 'Réceptions',   rows: receptionRows },
    { key: 'transfers',       label: 'Transferts',   rows: transferRows },
    { key: 'sales',           label: 'Ventes',       rows: saleRows },
  ]
}

/** Découpe en lots bornés à la fois en lignes et en octets. */
function decouper(rows: Row[]): Row[][] {
  const lots: Row[][] = []
  let courant: Row[] = []
  let octets = 0

  for (const row of rows) {
    const taille = JSON.stringify(row).length
    // Un lot ne peut pas être vide : une ligne plus grosse que le plafond part seule.
    if (courant.length > 0 && (courant.length >= MAX_ROWS_PAR_LOT || octets + taille > MAX_OCTETS_PAR_LOT)) {
      lots.push(courant)
      courant = []
      octets = 0
    }
    courant.push(row)
    octets += taille
  }
  if (courant.length > 0) lots.push(courant)

  return lots
}

// ─── Envoi ────────────────────────────────────────────────────────────────────

/** Erreur qu'il ne sert à rien de réessayer : le jeton ne changera pas d'avis. */
class ErreurDefinitive extends Error {}

interface ReponsePush {
  success?:       boolean
  counts?:        Record<string, PushCounts>
  rejectedCount?: number
  rejected?:      Array<{ entity: string; id: string; reason: string }>
}

async function envoyerLot(apiUrl: string, token: string, body: unknown): Promise<ReponsePush> {
  let derniereErreur = ''

  for (let essai = 1; essai <= ESSAIS_PAR_LOT; essai++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_LOT_MS)
    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/sync/push`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept:         'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body:   JSON.stringify(body),
        signal: controller.signal,
      })
      const text = await res.text()
      const json = (text ? JSON.parse(text) : {}) as Record<string, unknown>

      if (!res.ok) {
        const message = typeof json.error === 'string'
          ? json.error
          : typeof json.message === 'string' ? json.message : `HTTP ${res.status}`
        // 401/403/422 : rien ne servirait de réessayer.
        if (res.status === 401 || res.status === 403 || res.status === 422) {
          throw new ErreurDefinitive(message)
        }
        derniereErreur = message
        continue
      }

      return json as ReponsePush
    } catch (e) {
      if (e instanceof ErreurDefinitive) throw e
      derniereErreur = errMessage(e)
    } finally {
      clearTimeout(timer)
    }
  }

  throw new Error(derniereErreur || 'Envoi impossible.')
}

/**
 * De quoi parler à l'API. Des identifiants saisis passent DEVANT le reste :
 * c'est la porte de secours si le jeton embarqué venait à être révoqué, sinon
 * un jeton mort rendrait le bouton inutilisable sans recours.
 */
async function resoudreAuth(
  credentials?: { apiUrl: string; email: string; password: string },
): Promise<{ apiUrl: string; token: string } | { message: string }> {
  if (credentials) {
    const apiUrl = credentials.apiUrl.trim().replace(/\/$/, '')
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify({ email: credentials.email.trim(), password: credentials.password }),
      })
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok || typeof json.token !== 'string') {
        return { message: typeof json.message === 'string' ? json.message : `HTTP ${res.status}` }
      }
      return { apiUrl, token: json.token }
    } catch (e) {
      return { message: errMessage(e) }
    }
  }

  const cfg = readConfig()
  if (cfg) return { apiUrl: cfg.apiUrl, token: cfg.token }

  const embarque = jetonPoste()
  if (embarque) return { apiUrl: getDefaultApiUrl(), token: embarque }

  return { message: 'Aucune connexion à l’API : renseignez URL, email et mot de passe.' }
}

/**
 * Envoie toutes les données de ce poste au serveur.
 *
 * @param onProgress appelé après chaque lot — l'envoi d'une grosse base prend
 *        plusieurs minutes, et un écran figé pousse à croire que ça a planté.
 */
export async function pushAllData(opts: {
  credentials?: { apiUrl: string; email: string; password: string }
  onProgress?:  (p: PushProgress) => void
  /** null = tout envoyer (le bouton) ; sinon, seulement ce qui a bougé depuis. */
  depuis?:      string | null
} = {}): Promise<PushSummary> {
  const debut = Date.now()
  const vide: PushSummary = {
    success: false, sent: {}, counts: {}, rejectedCount: 0, rejected: [], requests: 0, durationMs: 0,
  }

  // 1) De quoi s'authentifier.
  const auth = await resoudreAuth(opts.credentials)
  if ('message' in auth) return { ...vide, message: auth.message }
  const { apiUrl, token } = auth

  // 2) Lecture locale, puis envoi lot par lot dans l'ordre des dépendances.
  let entites: Array<{ key: string; label: string; rows: Row[] }>
  try {
    entites = lireDonneesLocales(opts.depuis)
  } catch (e) {
    return { ...vide, message: `Lecture de la base impossible : ${errMessage(e)}` }
  }

  const sent: Record<string, number> = {}
  const counts: Record<string, PushCounts> = {}
  const rejected: PushSummary['rejected'] = []
  let rejectedCount = 0
  let requests = 0

  const total = entites.reduce((n, e) => n + e.rows.length, 0)
  let done = 0

  if (total === 0) {
    return {
      ...vide,
      success: true,
      message: opts.depuis ? undefined : 'Ce poste n’a aucune donnée à envoyer.',
      durationMs: Date.now() - debut,
    }
  }

  for (const entite of entites) {
    sent[entite.key] = entite.rows.length
    if (entite.rows.length === 0) continue

    for (const lot of decouper(entite.rows)) {
      let reponse: ReponsePush
      try {
        reponse = await envoyerLot(apiUrl, token, { [entite.key]: lot })
      } catch (e) {
        // On rend ce qui est déjà passé : un envoi interrompu au bout de 4 lots
        // n'est pas perdu, il reprendra là où il en est au prochain clic.
        return {
          success: false,
          message: `${entite.label} : ${errMessage(e)}`,
          sent, counts, rejected, rejectedCount,
          requests, durationMs: Date.now() - debut,
        }
      }

      requests++
      for (const [brut, valeur] of Object.entries(reponse.counts ?? {})) {
        // L'API renvoie ses clés en camelCase (CamelCaseResponseMiddleware) alors
        // qu'on les envoie en snake_case : sans cette remise à plat, le résumé
        // affichait « purchaseOrders » à côté de « purchase_orders ».
        const key = brut.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`)
        const acc = counts[key] ?? { created: 0, updated: 0, unchanged: 0 }
        counts[key] = {
          created:   acc.created + (valeur.created ?? 0),
          updated:   acc.updated + (valeur.updated ?? 0),
          unchanged: acc.unchanged + (valeur.unchanged ?? 0),
        }
      }
      rejectedCount += reponse.rejectedCount ?? 0
      for (const refus of reponse.rejected ?? []) {
        if (rejected.length < 60) rejected.push(refus)
      }

      done += lot.length
      opts.onProgress?.({ entity: entite.label, done, total })
    }
  }

  return {
    success: rejectedCount === 0,
    sent, counts, rejected, rejectedCount,
    requests,
    durationMs: Date.now() - debut,
  }
}

/** Ce que l'interface doit savoir avant de proposer l'envoi. */
export function infosPush(): { posteLabel: string; apiUrl: string; sansIdentifiants: boolean; appVersion: string } {
  const cfg = readConfig()
  return {
    posteLabel:       nomPoste(),
    apiUrl:           cfg?.apiUrl ?? getDefaultApiUrl(),
    sansIdentifiants: Boolean(jetonPoste()) || Boolean(cfg?.token),
    appVersion:       app.getVersion(),
  }
}

// ─── « Synchroniser » : récupérer ce que le serveur a de plus récent ─────────
//
// Le pendant de l'envoi. Le poste tire le bundle entité par entité — une base
// avec des photos produit pèse plusieurs dizaines de Mo — et applique
// exactement la même logique que la synchronisation classique (applyBundle),
// rejeu des mouvements de stock compris.

export interface PullSummary {
  success:    boolean
  message?:   string
  pulled:     number
  errors:     string[]
  durationMs: number
}

async function tirerEntite(apiUrl: string, token: string, entite: string): Promise<SyncBundle> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_LOT_MS)
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/sync/pull?entity=${entite}`, {
      method:  'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal:  controller.signal,
    })
    const text = await res.text()
    const json = (text ? JSON.parse(text) : {}) as Record<string, unknown>
    if (!res.ok) {
      const message = typeof json.error === 'string'
        ? json.error
        : typeof json.message === 'string' ? json.message : `HTTP ${res.status}`
      throw new ErreurDefinitive(message)
    }
    return json as SyncBundle
  } finally {
    clearTimeout(timer)
  }
}

/** Récupère du serveur tout ce que ce poste n'a pas encore. */
export async function pullAllData(opts: {
  credentials?: { apiUrl: string; email: string; password: string }
  onProgress?:  (p: PushProgress) => void
} = {}): Promise<PullSummary> {
  const debut = Date.now()

  const auth = await resoudreAuth(opts.credentials)
  if ('message' in auth) return { success: false, message: auth.message, pulled: 0, errors: [], durationMs: 0 }

  const errors: string[] = []
  let pulled = 0
  let fait = 0

  for (const entite of ORDRE_ENTITES) {
    let bundle: SyncBundle
    try {
      bundle = await tirerEntite(auth.apiUrl, auth.token, entite.api)
    } catch (e) {
      // Ce qui est déjà descendu est conservé : la reprise repartira de là.
      return {
        success: false,
        message: `${entite.label} : ${errMessage(e)}`,
        pulled, errors, durationMs: Date.now() - debut,
      }
    }

    try {
      pulled += await applyBundle({ apiUrl: auth.apiUrl, email: '', token: auth.token }, bundle, errors)
    } catch (e) {
      errors.push(`${entite.label} : ${errMessage(e)}`)
    }

    fait++
    opts.onProgress?.({ entity: entite.label, done: fait, total: ORDRE_ENTITES.length })
  }

  return { success: errors.length === 0, pulled, errors, durationMs: Date.now() - debut }
}

/**
 * Synchronisation complète d'un poste : il envoie ce qu'il a, puis récupère ce
 * qui lui manque. Dans cet ordre — pousser d'abord garantit qu'un poste qui
 * vient de saisir une vente ne se la fait pas écraser par une version du
 * serveur plus ancienne que la sienne.
 */
export async function runPosteSync(opts: {
  onProgress?: (p: PushProgress) => void
  /** true = tout renvoyer, sans tenir compte de la dernière synchro (le bouton). */
  complet?:    boolean
} = {}): Promise<SyncSummary> {
  const envoi = await pushAllData({
    onProgress: opts.onProgress,
    depuis:     opts.complet ? null : getLastSyncedAt(),
  })
  const retour = await pullAllData({ onProgress: opts.onProgress })

  const pushed = Object.values(envoi.counts).reduce((n, c) => n + c.created + c.updated, 0)
  const errors = [
    ...(envoi.message ? [envoi.message] : []),
    ...envoi.rejected.map((r) => `${r.entity} ${r.id}: ${r.reason}`),
    ...(retour.message ? [retour.message] : []),
    ...retour.errors,
  ]

  // L'horodatage n'avance QUE si tout est passé : sinon la prochaine synchro
  // incrémentale sauterait ce qui vient d'échouer, et la ligne resterait à quai
  // pour toujours.
  if (envoi.success && retour.success) marquerSynchronise()

  return {
    success:    envoi.success && retour.success,
    online:     true,
    configured: true,
    pushed,
    pulled:     retour.pulled,
    errors,
  }
}

/**
 * Le point d'entrée unique de la synchronisation, manuelle comme automatique.
 *
 * Un poste connecté par l'utilisateur garde la synchro classique (son jeton peut
 * tout faire). Un poste qui n'a jamais été configuré — le cas des deux postes du
 * client — passe par les points d'entrée en bloc avec le jeton embarqué : c'est
 * ce qui fait qu'il se synchronise tout seul, sans que personne n'ait à saisir
 * quoi que ce soit.
 */
export async function syncMaintenant(opts: {
  onProgress?: (p: PushProgress) => void
} = {}): Promise<SyncSummary> {
  if (readConfig()) return runSync()
  if (!jetonPoste()) {
    return { success: false, online: false, configured: false, pushed: 0, pulled: 0, errors: [], reason: 'not_configured' }
  }
  return runPosteSync(opts)
}

import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

import { useDatabase, getSqlite } from './stubs/db-index'
import { appliquerSuppressions, suppressionsEnAttente } from '/repo/electron/services/poste-sync.service'
import { PurchaseOrderService } from '/repo/electron/services/purchase-order.service'

// Le 19/08 à 16 h 15, « Supprimer partout » a répondu « Invalid ability
// provided. » — le serveur refusait l'envoi, le droit d'écriture du jeton ayant
// été retiré la veille au soir. Deux défauts se sont révélés à cette occasion,
// et ce banc les tient tous les deux :
//
//   1. le message du serveur était affiché tel quel, en anglais et en langage de
//      serveur (lu par le client comme « une erreur post token key ») ;
//   2. les lignes étaient marquées supprimées ICI avant l'envoi, et y restaient
//      quand l'envoi échouait : elles disparaissaient du poste alors qu'elles
//      vivaient toujours sur le serveur, puis revenaient seules trois minutes
//      plus tard, sans qu'un mot explique ce va-et-vient.
//
// Pas besoin de l'API Laravel ici : c'est la RÉACTION DU POSTE à un refus qu'on
// éprouve. Un serveur bouchon suffit, et il permet de rejouer le 403 à volonté.

let echecs = 0
function verifier(nom: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok    ${nom}`)
  else { echecs++; console.log(`  ECHEC ${nom} ${detail}`) }
}

const BASE = '/bench/refus.db'
const USERDATA = '/bench/userdataRefus'
const T = '2026-08-19 08:00:00'

const ids = { warehouse: randomUUID(), supplier: randomUUID(), product: randomUUID() }

/** Ce que le serveur bouchon doit répondre au prochain POST /sync/push. */
let reponse: { status: number; body: unknown } = {
  status: 403,
  body:   { message: 'Invalid ability provided.' },
}
/** Ce qu'il a reçu, pour vérifier que la suppression part vraiment quand il accepte. */
let recu: Array<Record<string, unknown>> = []

function semerBase(): void {
  const db = getSqlite()
  const x = (sql: string, ...args: unknown[]) => db.prepare(sql).run(...args)
  x(`INSERT INTO warehouses (id,name,type,address,is_default,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`,
    ids.warehouse, 'Depot principal', 'warehouse', null, 1, T, T)
  x(`INSERT INTO suppliers (id,name,country,created_at,updated_at) VALUES (?,?,?,?,?)`,
    ids.supplier, 'Fournisseur Chine', 'Chine', T, T)
  x(`INSERT INTO products (id,reference,name,pairs_per_carton,alert_threshold,selling_price_per_carton,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`, ids.product, 'REFUS-REF-1', 'Gucci Homme', 12, 2, 240000, T, T)
}

function commandeVivante(id: string): boolean {
  const ligne = getSqlite()
    .prepare('SELECT deleted_at FROM purchase_orders WHERE id = ?')
    .get(id) as { deleted_at: string | null } | undefined
  return ligne !== undefined && ligne.deleted_at === null
}

async function main(): Promise<void> {
  // ─── Un poste, une commande, et l'état d'après une synchro qui l'a rétablie ──
  fs.mkdirSync(USERDATA, { recursive: true })
  process.env.BENCH_USERDATA = USERDATA
  fs.rmSync(BASE, { force: true })
  fs.rmSync(`${BASE}-wal`, { force: true })
  fs.rmSync(`${BASE}-shm`, { force: true })
  useDatabase(BASE)
  semerBase()

  const commande = new PurchaseOrderService().create({
    supplierId: ids.supplier, orderDate: '2026-08-19', status: 'confirmed',
    productCostFcfa: 1000000, freightCostFcfa: 0, customsCostFcfa: 0, otherCostsFcfa: 0,
    items: [{ productId: ids.product, cartonsOrdered: 5, pairsPerCarton: 12,
      unitCostPerCartonFcfa: 200000, sizes: [{ size: '42', pairsCount: 12 }] }],
  } as any) as { id: string }

  // L'utilisateur l'avait supprimée, la synchro l'a rétablie : c'est exactement
  // l'état dans lequel le panneau propose « Supprimer partout ».
  fs.writeFileSync(
    `${USERDATA}/suppressions-retablies.json`,
    JSON.stringify([{ entite: 'purchase_orders', id: commande.id }], null, 2), 'utf-8',
  )

  const serveur = http.createServer((req, res) => {
    let corps = ''
    req.on('data', (c) => { corps += c })
    req.on('end', () => {
      if (reponse.status === 200) {
        const json = JSON.parse(corps || '{}') as Record<string, unknown[]>
        recu = recu.concat((json.purchase_orders ?? []) as Array<Record<string, unknown>>)
      }
      res.writeHead(reponse.status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(reponse.body))
    })
  })
  await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r))
  const port = (serveur.address() as AddressInfo).port
  fs.writeFileSync(`${USERDATA}/sync-config.json`, JSON.stringify({
    apiUrl: `http://127.0.0.1:${port}`, email: 'banc@local', token: 'jeton-de-banc',
  }), 'utf-8')

  console.log('\n══ Le serveur refuse l’envoi (403, jeton sans droit d’écriture) ══')
  const refus = await appliquerSuppressions()

  verifier('l’échec est signalé', refus.success === false)
  verifier('le message est en français et dit ce qui s’est passé',
    (refus.message ?? '').includes('n’a pas le droit d’écrire sur le serveur'), `→ ${refus.message}`)
  verifier('il rassure sur les données, qui ne sont pas perdues',
    (refus.message ?? '').includes('Rien n’est perdu'), `→ ${refus.message}`)
  verifier('le message technique reste, entre parenthèses, pour le diagnostic',
    (refus.message ?? '').includes('Invalid ability provided.'), `→ ${refus.message}`)
  verifier('il dit quoi faire, au lieu de laisser le client devant une phrase anglaise',
    (refus.message ?? '').includes('Prévenez le support'), `→ ${refus.message}`)
  verifier('la commande est TOUJOURS VIVANTE sur le poste (rien n’a été supprimé à moitié)',
    commandeVivante(commande.id))
  verifier('la demande de suppression reste mémorisée : le bouton pourra être recliqué',
    suppressionsEnAttente().length === 1)

  console.log('\n══ Le droit est rendu : le même clic supprime pour de bon ══')
  reponse = { status: 200, body: { success: true, counts: {}, rejectedCount: 0, rejected: [] } }
  const ok = await appliquerSuppressions()

  verifier('l’envoi réussit', ok.success === true, `→ ${ok.message ?? ''}`)
  verifier('une ligne est annoncée supprimée', ok.supprimees === 1)
  verifier('la commande est supprimée sur le poste', !commandeVivante(commande.id))
  verifier('la suppression est bien PARTIE au serveur (deleted_at renseigné)',
    recu.some((r) => r.id === commande.id && typeof r.deleted_at === 'string' && r.deleted_at !== ''),
    `→ ${JSON.stringify(recu.map((r) => ({ id: r.id, deleted_at: r.deleted_at })))}`)
  verifier('l’avertissement disparaît', suppressionsEnAttente().length === 0)

  serveur.close()
  console.log(echecs === 0 ? '\n✅ banc refus : tout est vert' : `\n❌ banc refus : ${echecs} échec(s)`)
  process.exit(echecs === 0 ? 0 : 1)
}

void main()

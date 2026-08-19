import { randomUUID } from 'node:crypto'
import fs from 'node:fs'

import { useDatabase, getSqlite } from './stubs/db-index'
import {
  appliquerSuppressions, pushAllData, runPosteSync, suppressionsEnAttente,
} from '/repo/electron/services/poste-sync.service'
import { PurchaseOrderService } from '/repo/electron/services/purchase-order.service'

// Le scénario exact du 19/08, celui qui a coûté 24 commandes :
//
//   « le poste B n'était pas à jour, la récupération était incomplète, j'ai donc
//     supprimé les lignes de commande sur B en pensant qu'en cliquant sur
//     Synchroniser j'allais récupérer les données du serveur et du poste A. »
//
// Avant : B poussait ses suppressions, le serveur détruisait les commandes, et A
// les perdait à son tour. Après : B les récupère, et personne ne perd rien.

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

let echecs = 0
function verifier(nom: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok    ${nom}`)
  else { echecs++; console.log(`  ECHEC ${nom} ${detail}`) }
}

const A = '/bench/supprA.db'
const B = '/bench/supprB.db'
const USERDATA_A = '/bench/userdataA'
const USERDATA_B = '/bench/userdataB'
const T = '2026-08-19 08:00:00'

const commandes = new PurchaseOrderService()
const ids = { warehouse: randomUUID(), supplier: randomUUID(), product: randomUUID() }

/** Bascule de poste : base ET dossier userData (le fichier des suppressions y vit). */
function poste(fichier: string, userData: string): void {
  fs.mkdirSync(userData, { recursive: true })
  process.env.BENCH_USERDATA = userData
  useDatabase(fichier)
}

function compte(table: string, where = '1=1'): number {
  return (getSqlite().prepare(`SELECT COUNT(*) n FROM ${table} WHERE ${where}`).get() as { n: number }).n
}
function commandesVivantes(): number { return compte('purchase_orders', 'deleted_at IS NULL') }

function semerBase(): void {
  const db = getSqlite()
  const x = (sql: string, ...args: unknown[]) => db.prepare(sql).run(...args)
  x(`INSERT INTO warehouses (id,name,type,address,is_default,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`,
    ids.warehouse, 'Depot principal', 'warehouse', null, 1, T, T)
  x(`INSERT INTO suppliers (id,name,country,created_at,updated_at) VALUES (?,?,?,?,?)`,
    ids.supplier, 'Fournisseur Chine', 'Chine', T, T)
  x(`INSERT INTO products (id,reference,name,pairs_per_carton,alert_threshold,selling_price_per_carton,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`, ids.product, 'SUPPR-REF-1', 'Gucci Homme', 12, 2, 240000, T, T)
}

async function main(): Promise<void> {
  console.log('\n══ Poste A : trois commandes, envoyées au serveur ══')
  poste(A, USERDATA_A)
  semerBase()
  for (let i = 0; i < 3; i++) {
    commandes.create({
      supplierId: ids.supplier, orderDate: '2026-08-19', status: 'confirmed',
      productCostFcfa: 1000000, freightCostFcfa: 0, customsCostFcfa: 0, otherCostsFcfa: 0,
      items: [{ productId: ids.product, cartonsOrdered: 5, pairsPerCarton: 12,
        unitCostPerCartonFcfa: 200000, sizes: [{ size: '42', pairsCount: 12 }] }],
    } as any)
  }
  verifier('A a 3 commandes', commandesVivantes() === 3, `obtenu ${commandesVivantes()}`)
  const envoiA = await pushAllData()
  verifier('A envoie tout sans refus', envoiA.rejectedCount === 0, JSON.stringify(envoiA.rejected))

  console.log('\n══ Poste B : « Synchroniser » ══')
  poste(B, USERDATA_B)
  const sync1 = await runPosteSync({ complet: true })
  verifier('B reçoit les 3 commandes', commandesVivantes() === 3, `obtenu ${commandesVivantes()}`)
  verifier('B reçoit leur détail', compte('purchase_order_items') === 3, `obtenu ${compte('purchase_order_items')}`)
  verifier('B se synchronise sans erreur', sync1.errors.length === 0, JSON.stringify(sync1.errors))

  console.log('\n══ B SUPPRIME les commandes (le geste du 19/08) ══')
  await pause(1100)
  for (const c of getSqlite().prepare(`SELECT id FROM purchase_orders`).all() as Array<{ id: string }>) {
    commandes.delete(c.id)
  }
  verifier('B n\'affiche plus aucune commande', commandesVivantes() === 0, `obtenu ${commandesVivantes()}`)

  console.log('\n══ B clique « Synchroniser » — il doit TOUT récupérer ══')
  const sync2 = await runPosteSync({ complet: true })
  verifier('B retrouve ses 3 commandes', commandesVivantes() === 3, `obtenu ${commandesVivantes()}`)
  verifier('avec leur détail', compte('purchase_order_items') === 3, `obtenu ${compte('purchase_order_items')}`)
  verifier('et la synchro le DIT (3 rétablies)', sync2.retablis === 3, `obtenu ${String(sync2.retablis)}`)
  verifier('l\'intention de suppression est mémorisée, pas perdue',
    suppressionsEnAttente().length === 3, JSON.stringify(suppressionsEnAttente()))

  console.log('\n══ Poste A : il ne doit RIEN avoir perdu ══')
  poste(A, USERDATA_A)
  const syncA = await runPosteSync({ complet: true })
  verifier('A a toujours ses 3 commandes', commandesVivantes() === 3, `obtenu ${commandesVivantes()}`)
  verifier('A n\'a rien à rétablir', syncA.retablis === 0, String(syncA.retablis))

  console.log('\n══ Supprimer pour de bon reste possible : « Supprimer partout » sur B ══')
  poste(B, USERDATA_B)
  await pause(1100)
  const applique = await appliquerSuppressions()
  verifier('les 3 suppressions sont appliquées', applique.success && applique.supprimees === 3,
    JSON.stringify(applique))
  verifier('B n\'affiche plus les commandes', commandesVivantes() === 0, `obtenu ${commandesVivantes()}`)
  verifier('l\'intention est consommée', suppressionsEnAttente().length === 0,
    JSON.stringify(suppressionsEnAttente()))

  const sync3 = await runPosteSync({ complet: true })
  verifier('et elles ne reviennent PAS à la synchro suivante', commandesVivantes() === 0,
    `obtenu ${commandesVivantes()}, retablis=${String(sync3.retablis)}`)

  console.log('\n══ Le poste A suit la suppression, comme n\'importe quelle modification ══')
  poste(A, USERDATA_A)
  await runPosteSync({ complet: true })
  verifier('A voit la suppression demandée par B', commandesVivantes() === 0, `obtenu ${commandesVivantes()}`)

  console.log(`\n${echecs === 0 ? 'TOUT EST VERT' : `${echecs} ECHEC(S)`}\n`)
  process.exit(echecs === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })

import { randomUUID } from 'node:crypto'

import { useDatabase, getSqlite } from './stubs/db-index'
import { pushAllData, pullAllData, verifierSynchronisation } from '/repo/electron/services/poste-sync.service'
import { PurchaseOrderService } from '/repo/electron/services/purchase-order.service'
import { ReceptionService } from '/repo/electron/services/reception.service'
import { ProductService } from '/repo/electron/services/product.service'

// Le scénario de Franck du 19/08, joué sur deux VRAIES bases SQLite contre une
// VRAIE API Laravel : « les commandes arrivent sur B mais pas leurs détails »,
// puis « le produit que je crée sur A n'apparaît pas sur B ».

// SQLite horodate à la seconde : sans ce délai, la modification porterait le même
// `updated_at` que la création et le serveur la verrait « pas plus récente ».
// Dans la vraie vie les minutes séparent une saisie de sa correction.
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

let echecs = 0
function verifier(nom: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok    ${nom}`)
  else { echecs++; console.log(`  ECHEC ${nom} ${detail}`) }
}

const A = '/bench/posteA.db'
const B = '/bench/posteB.db'
const T = '2026-08-19 08:00:00'

const commandes  = new PurchaseOrderService()
const arrivages  = new ReceptionService()
const produits   = new ProductService()

const ids = {
  warehouse: randomUUID(), supplier: randomUUID(), product: randomUUID(),
}

function q<T = any>(sql: string, ...args: unknown[]): T[] {
  return getSqlite().prepare(sql).all(...args) as T[]
}
function compte(table: string, where = '1=1'): number {
  return (getSqlite().prepare(`SELECT COUNT(*) n FROM ${table} WHERE ${where}`).get() as { n: number }).n
}
function stockNet(): number {
  return (getSqlite().prepare(`SELECT COALESCE(SUM(quantity),0) n FROM stock_movements`).get() as { n: number }).n
}

function semerBase(): void {
  const db = getSqlite()
  const x = (sql: string, ...args: unknown[]) => db.prepare(sql).run(...args)
  x(`INSERT INTO warehouses (id,name,type,address,is_default,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`,
    ids.warehouse, 'Depot principal', 'warehouse', null, 1, T, T)
  x(`INSERT INTO suppliers (id,name,country,created_at,updated_at) VALUES (?,?,?,?,?)`,
    ids.supplier, 'Fournisseur Chine', 'Chine', T, T)
  x(`INSERT INTO products (id,reference,name,pairs_per_carton,alert_threshold,selling_price_per_carton,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`, ids.product, 'BENCH-REF-1', 'Gucci Homme', 12, 2, 240000, T, T)
}

async function main(): Promise<void> {
  console.log('\n══ Poste A : une commande à deux lignes, avec pointures, puis un arrivage ══')
  useDatabase(A)
  semerBase()

  const commande = commandes.create({
    supplierId: ids.supplier, orderDate: '2026-08-19', status: 'confirmed',
    productCostFcfa: 1000000, freightCostFcfa: 0, customsCostFcfa: 0, otherCostsFcfa: 0,
    items: [
      { productId: ids.product, cartonsOrdered: 5, pairsPerCarton: 12, unitCostPerCartonFcfa: 200000,
        sizes: [{ size: '42', pairsCount: 7 }, { size: '43', pairsCount: 5 }] },
      { productId: ids.product, cartonsOrdered: 4, pairsPerCarton: 12, unitCostPerCartonFcfa: 150000,
        sizes: [{ size: '44', pairsCount: 12 }] },
    ],
  } as any)!

  const detailA = commandes.getForEdit(commande.id) as any
  const ligne1 = detailA.items[0]
  const ligne2 = detailA.items[1]
  verifier('A a bien 2 lignes et 3 pointures', compte('purchase_order_items') === 2 && compte('carton_size_compositions') === 3)

  arrivages.create({
    orderId: commande.id, warehouseId: ids.warehouse, receptionDate: '2026-08-19', notes: null,
    items: [{ orderItemId: ligne1.id, cartonsReceived: 5 }],
  } as any)
  const stockInitial = stockNet()
  verifier(`A a le stock de l'arrivage (${stockInitial})`, stockInitial === 60, `attendu 60, obtenu ${stockInitial}`)

  const envoi = await pushAllData()
  verifier('A envoie tout sans refus', envoi.rejectedCount === 0, JSON.stringify(envoi.rejected))

  console.log('\n══ Poste B (vide) : « Synchroniser » ══')
  useDatabase(B)
  const retour1 = await pullAllData()
  verifier('B reçoit sans erreur', retour1.errors.length === 0, JSON.stringify(retour1.errors))
  verifier('B a la commande', compte('purchase_orders') === 1)
  verifier('B a les 2 lignes', compte('purchase_order_items') === 2, `obtenu ${compte('purchase_order_items')}`)
  verifier('B a les 3 pointures', compte('carton_size_compositions') === 3, `obtenu ${compte('carton_size_compositions')}`)
  verifier(`B a le même stock que A (${stockInitial})`, stockNet() === stockInitial, `obtenu ${stockNet()}`)

  console.log('\n══ A MODIFIE la commande (le cas de Franck) ══')
  await pause(1100)
  useDatabase(A)
  commandes.update(commande.id, {
    items: [
      { id: ligne1.id, productId: ids.product, cartonsOrdered: 9, pairsPerCarton: 12,
        unitCostPerCartonFcfa: 200000, sizes: [{ size: '42', pairsCount: 9 }, { size: '43', pairsCount: 3 }] },
    ],
  } as any)
  verifier('A : la 2e ligne est retirée', compte('purchase_order_items') === 1)
  verifier('A : 2 pointures recréées', compte('carton_size_compositions') === 2)
  const envoi2 = await pushAllData()
  verifier('A renvoie la commande modifiée', envoi2.rejectedCount === 0, JSON.stringify(envoi2.rejected))

  useDatabase(B)
  const retour2 = await pullAllData()
  verifier('B applique sans erreur', retour2.errors.length === 0, JSON.stringify(retour2.errors))
  const ligneB = q(`SELECT cartons_ordered c FROM purchase_order_items WHERE id = ?`, ligne1.id)[0]
  verifier('B voit la quantité corrigée (9)', ligneB?.c === 9, `obtenu ${JSON.stringify(ligneB)}`)
  verifier('B a perdu la ligne retirée', compte('purchase_order_items') === 1, `obtenu ${compte('purchase_order_items')}`)
  verifier('B a les pointures refaites (2)', compte('carton_size_compositions') === 2, `obtenu ${compte('carton_size_compositions')}`)
  const p42 = q(`SELECT pairs_count p FROM carton_size_compositions WHERE size='42'`)[0]
  verifier('B voit la pointure 42 à 9 paires', p42?.p === 9, `obtenu ${JSON.stringify(p42)}`)
  verifier('les pointures ne se sont pas EMPILÉES sur B', compte('carton_size_compositions') === 2,
    `obtenu ${compte('carton_size_compositions')}`)

  console.log('\n══ A CORRIGE l\'arrivage : 5 cartons -> 3 ══')
  await pause(1100)
  useDatabase(A)
  const arrivage = q(`SELECT id FROM receptions LIMIT 1`)[0]
  arrivages.update(arrivage.id, {
    warehouseId: ids.warehouse, receptionDate: '2026-08-19', notes: null,
    items: [{ orderItemId: ligne1.id, cartonsReceived: 3 }],
  } as any)
  const stockCorrige = stockNet()
  verifier(`A : stock recalculé (${stockCorrige})`, stockCorrige === 36, `attendu 36 (3 x 12), obtenu ${stockCorrige}`)
  const envoi3 = await pushAllData()
  verifier('A renvoie l\'arrivage corrigé', envoi3.rejectedCount === 0, JSON.stringify(envoi3.rejected))

  useDatabase(B)
  await pullAllData()
  verifier(`B suit la correction de stock (${stockCorrige})`, stockNet() === stockCorrige, `attendu ${stockCorrige}, obtenu ${stockNet()}`)

  console.log('\n══ Le produit créé sur A avec une référence déjà prise sur B ══')
  useDatabase(B)
  produits.create({ reference: 'A237-17', name: 'Produit saisi sur B', pairsPerCarton: 12,
    alertThreshold: 0, sellingPricePerCarton: 100000 } as any)

  useDatabase(A)
  produits.create({ reference: 'A237-17', name: 'lv', pairsPerCarton: 12,
    alertThreshold: 0, sellingPricePerCarton: 150000 } as any)
  await pushAllData()

  useDatabase(B)
  const retour4 = await pullAllData()
  const lv = q(`SELECT id,reference FROM products WHERE name = 'lv'`)[0]
  verifier('B reçoit enfin le produit « lv »', lv !== undefined, JSON.stringify(q(`SELECT name,reference FROM products`)))
  verifier('« lv » garde sa référence', lv?.reference === 'A237-17', JSON.stringify(lv))
  const squatteur = q(`SELECT reference FROM products WHERE name = 'Produit saisi sur B'`)[0]
  verifier('le produit local qui squattait est renommé', squatteur?.reference !== 'A237-17', JSON.stringify(squatteur))
  verifier('et le renommage est SIGNALÉ, pas silencieux',
    retour4.errors.some((e) => e.includes('A237-17')), JSON.stringify(retour4.errors))

  console.log('\n══ « Vérifier la synchronisation » ══')
  // B vient de tout recevoir, et renvoie ce qu'il a en propre (le produit renomme
  // n'etait jamais monte) : apres quoi les deux cotes doivent se dire d'accord.
  await pushAllData()
  await pullAllData()
  const vB = await verifierSynchronisation()
  verifier('B se déclare identique au serveur', vB.success && vB.identique,
    JSON.stringify(vB.ecarts?.map((e) => [e.label, e.local, e.serveur, e.manquantesIci.length, e.manquantesLaBas.length, e.detailDifferent.length])))

  // Une saisie non encore envoyée doit être vue comme « pas encore sur le serveur ».
  produits.create({ reference: 'JAMAIS-ENVOYE', name: 'Produit local', pairsPerCarton: 12,
    alertThreshold: 0, sellingPricePerCarton: 1000 } as any)
  const vB2 = await verifierSynchronisation()
  const ecartProduits = vB2.ecarts.find((e) => e.entite === 'products')
  verifier('le contrôle voit la ligne pas encore envoyée', ecartProduits?.manquantesLaBas.length === 1,
    JSON.stringify(ecartProduits))

  // Et surtout : un DÉTAIL amputé doit se voir, alors qu'une comparaison des
  // seuls identifiants dirait « tout est là ». C'est le bug du 19/08.
  getSqlite().prepare(`DELETE FROM carton_size_compositions`).run()
  const vB3 = await verifierSynchronisation()
  const ecartCommandes = vB3.ecarts.find((e) => e.entite === 'purchase_orders')
  verifier('le contrôle voit une commande amputée de ses pointures',
    (ecartCommandes?.detailDifferent.length ?? 0) === 1, JSON.stringify(ecartCommandes))

  console.log(`\n${echecs === 0 ? 'TOUT EST VERT' : `${echecs} ECHEC(S)`}\n`)
  process.exit(echecs === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })

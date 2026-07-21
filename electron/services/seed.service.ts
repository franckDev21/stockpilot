import { eq }         from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb }      from '../db/index'
import {
  warehouses, products, suppliers, customers,
  purchaseOrders, purchaseOrderItems, cartonSizeCompositions, orderPayments,
  receptions, receptionItems, stockMovements,
  transfers, transferItems,
  sales, saleItems, salePayments,
} from '../db/schema'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export class SeedService {
  isSeeded(): boolean {
    return getDb().select().from(products).all().length > 0
  }

  clearAll(): void {
    const db = getDb()
    db.delete(salePayments).run()
    db.delete(saleItems).run()
    db.delete(sales).run()
    db.delete(transferItems).run()
    db.delete(transfers).run()
    db.delete(stockMovements).run()
    db.delete(receptionItems).run()
    db.delete(receptions).run()
    db.delete(orderPayments).run()
    db.delete(cartonSizeCompositions).run()
    db.delete(purchaseOrderItems).run()
    db.delete(purchaseOrders).run()
    db.delete(customers).run()
    db.delete(suppliers).run()
    db.delete(products).run()
    db.delete(warehouses).run()
  }

  seed(): { inserted: number } {
    this.clearAll()
    const db = getDb()
    let inserted = 0

    // ─── 1. Entrepôts ─────────────────────────────────────────────────────────
    const whCentral  = randomUUID()
    const whAkwa     = randomUUID()
    const whBonanjo  = randomUUID()
    const whBassaB   = randomUUID()

    db.insert(warehouses).values([
      { id: whCentral, name: 'Entrepôt Central Douala', type: 'warehouse', address: 'Zone industrielle Bassa, Douala', isDefault: true },
      { id: whAkwa,    name: 'Boutique Akwa',           type: 'boutique',  address: 'Rue Joss, Akwa, Douala' },
      { id: whBonanjo, name: 'Boutique Bonanjo',        type: 'boutique',  address: 'Rue Pau, Bonanjo, Douala' },
      { id: whBassaB,  name: 'Boutique Bassa',          type: 'boutique',  address: 'Carrefour Bassa, Douala' },
    ]).run()
    inserted += 4

    // ─── 2. Produits — 14 modèles ──────────────────────────────────────────────
    const prAF1    = randomUUID()
    const prAF1BLK = randomUUID()
    const prSS     = randomUUID()
    const prJ1     = randomUUID()
    const prJ4     = randomUUID()
    const prPuma   = randomUUID()
    const prNB574  = randomUUID()
    const prTimb   = randomUUID()
    const prVans   = randomUUID()
    const prConv   = randomUUID()
    const prDunk   = randomUUID()
    const prYeezy  = randomUUID()
    const prBirken = randomUUID()
    const prSalomon = randomUUID()

    db.insert(products).values([
      { id: prAF1,    reference: 'REF-AF1-BLC',  name: 'Nike Air Force 1 Blanc',      brand: 'Nike',        category: 'Sneakers',   alertThreshold: 20, pairsPerCarton: 24, sellingPricePerCarton: 1_008_000 },
      { id: prAF1BLK, reference: 'REF-AF1-NGR',  name: 'Nike Air Force 1 Noir',       brand: 'Nike',        category: 'Sneakers',   alertThreshold: 20, pairsPerCarton: 24, sellingPricePerCarton: 1_008_000 },
      { id: prSS,     reference: 'REF-SS-VRT',   name: 'Adidas Stan Smith Vert',      brand: 'Adidas',      category: 'Sneakers',   alertThreshold: 15, pairsPerCarton: 24, sellingPricePerCarton:   912_000 },
      { id: prJ1,     reference: 'REF-J1-NGR',   name: 'Jordan 1 Retro High OG',      brand: 'Jordan',      category: 'Sneakers',   alertThreshold: 10, pairsPerCarton: 12, sellingPricePerCarton:   780_000 },
      { id: prJ4,     reference: 'REF-J4-BLC',   name: 'Jordan 4 Retro White Cement', brand: 'Jordan',      category: 'Sneakers',   alertThreshold: 8,  pairsPerCarton: 12, sellingPricePerCarton:   864_000 },
      { id: prPuma,   reference: 'REF-PS-GRS',   name: 'Puma Suede Classic Gris',     brand: 'Puma',        category: 'Casual',     alertThreshold: 15, pairsPerCarton: 24, sellingPricePerCarton:   816_000 },
      { id: prNB574,  reference: 'REF-NB574-BG', name: 'New Balance 574 Beige',       brand: 'New Balance', category: 'Casual',     alertThreshold: 12, pairsPerCarton: 24, sellingPricePerCarton:   912_000 },
      { id: prTimb,   reference: 'REF-TB6-MGN',  name: 'Timberland Boot 6" Marron',   brand: 'Timberland',  category: 'Bottes',     alertThreshold: 8,  pairsPerCarton: 12, sellingPricePerCarton:   660_000 },
      { id: prVans,   reference: 'REF-VOS-BLC',  name: 'Vans Old Skool Blanc',        brand: 'Vans',        category: 'Skateboard', alertThreshold: 18, pairsPerCarton: 24, sellingPricePerCarton:   816_000 },
      { id: prConv,   reference: 'REF-CT70-ECR', name: 'Converse Chuck 70 Ecru',      brand: 'Converse',    category: 'Skateboard', alertThreshold: 15, pairsPerCarton: 24, sellingPricePerCarton:   864_000 },
      { id: prDunk,   reference: 'REF-SBD-BLR',  name: 'Nike SB Dunk Low Blanc/Rouge',brand: 'Nike',        category: 'Sneakers',   alertThreshold: 10, pairsPerCarton: 12, sellingPricePerCarton:   900_000 },
      { id: prYeezy,  reference: 'REF-YZ350-GRS',name: 'Adidas Yeezy 350 Gris',       brand: 'Adidas',      category: 'Sneakers',   alertThreshold: 6,  pairsPerCarton: 12, sellingPricePerCarton: 1_140_000 },
      { id: prBirken, reference: 'REF-BRK-CRK',  name: 'Birkenstock Arizona Cork',    brand: 'Birkenstock', category: 'Sandales',   alertThreshold: 10, pairsPerCarton: 20, sellingPricePerCarton:   560_000 },
      { id: prSalomon,reference: 'REF-SAL-XT6',  name: 'Salomon XT-6 Advanced',       brand: 'Salomon',     category: 'Trail',      alertThreshold: 8,  pairsPerCarton: 12, sellingPricePerCarton:   720_000 },
    ]).run()
    inserted += 14

    // ─── 3. Fournisseurs — 6 ──────────────────────────────────────────────────
    const supCN   = randomUUID()
    const supCN2  = randomUUID()
    const supDXB  = randomUUID()
    const supIT   = randomUUID()
    const supTR   = randomUUID()
    const supHK   = randomUUID()

    db.insert(suppliers).values([
      { id: supCN,  name: 'Guangzhou Shoes Factory',     country: 'Chine',          city: 'Guangzhou',  phone: '+86 20 8888 5566', email: 'shoes@gzfactory.cn',     whatsapp: '+86 138 0013 8000' },
      { id: supCN2, name: 'Jinjiang Premium Footwear',   country: 'Chine',          city: 'Jinjiang',   phone: '+86 595 8866 4400', email: 'sales@jjpremium.cn',     whatsapp: '+86 139 5900 1122' },
      { id: supDXB, name: 'Dubai Fashion House',         country: 'Émirats Arabes', city: 'Dubaï',      phone: '+971 4 345 6789',   email: 'trade@dbfashion.ae' },
      { id: supIT,  name: 'Calzature Milano Import',     country: 'Italie',         city: 'Milan',      phone: '+39 02 1234 5678',  email: 'import@calzmilano.it' },
      { id: supTR,  name: 'Istanbul Ayakkabi Ticaret',   country: 'Turquie',        city: 'Istanbul',   phone: '+90 212 520 4433',  email: 'export@iayakkabi.com.tr', whatsapp: '+90 532 111 2233' },
      { id: supHK,  name: 'Hong Kong Trade Footwear',    country: 'Hong Kong',      city: 'Hong Kong',  phone: '+852 2366 8899',    email: 'sales@hktrade-shoes.com' },
    ]).run()
    inserted += 6

    // ─── 4. Clients — 18 ─────────────────────────────────────────────────────
    const cAmNgong   = randomUUID()
    const cMarche    = randomUUID()
    const cYaound    = randomUUID()
    const cGaroua    = randomUUID()
    const cBafouss   = randomUUID()
    const cLibreville = randomUUID()
    const cAbidjan   = randomUUID()
    const cDakar     = randomUUID()
    const cPatrick   = randomUUID()
    const cMireille  = randomUUID()
    const cJean      = randomUUID()
    const cFatou     = randomUUID()
    const cBrice     = randomUUID()
    const cClarisse  = randomUUID()
    const cSamuel    = randomUUID()
    const cNadia     = randomUUID()
    const cKomlan    = randomUUID()
    const cEbenezer  = randomUUID()

    db.insert(customers).values([
      // Grossistes
      { id: cAmNgong,    name: 'Amin Ngong',                   phone: '+237 677 001 122', type: 'wholesale', address: 'Marché Sandaga, Douala',       whatsapp: '+237 677 001 122' },
      { id: cMarche,     name: 'Marché Central Distribution',  phone: '+237 654 200 300', type: 'wholesale', address: 'Marché Central, Douala' },
      { id: cYaound,     name: 'Boutique Fashion Yaoundé',     phone: '+237 699 450 112', type: 'wholesale', address: 'Avenue Kennedy, Yaoundé',      whatsapp: '+237 699 450 112' },
      { id: cGaroua,     name: 'Commerce Général Garoua',      phone: '+237 677 800 900', type: 'wholesale', address: 'Marché de Garoua' },
      { id: cBafouss,    name: 'Stock Mode Bafoussam',         phone: '+237 671 334 455', type: 'wholesale', address: 'Marché A, Bafoussam',          whatsapp: '+237 671 334 455' },
      { id: cLibreville, name: 'Trésor Import Libreville',     phone: '+241 77 556 677',  type: 'wholesale', address: 'Owendo, Libreville, Gabon' },
      { id: cAbidjan,    name: 'Rue Princesse Fashion Abidjan',phone: '+225 07 123 4567', type: 'wholesale', address: 'Rue Princesse, Abidjan, CI' },
      { id: cDakar,      name: 'Sandaga Market Dakar',         phone: '+221 77 890 1234', type: 'wholesale', address: 'Marché Sandaga, Dakar, Sénégal' },
      { id: cKomlan,     name: 'Komlan Assogba',               phone: '+228 90 123 456',  type: 'wholesale', address: 'Grand Marché, Lomé, Togo' },
      { id: cEbenezer,   name: 'Eben Boutique Douala',         phone: '+237 693 771 882', type: 'wholesale', address: 'Akwa Nord, Douala',            whatsapp: '+237 693 771 882' },
      // Détail
      { id: cPatrick,    name: 'Patrick Mba',                  phone: '+237 655 123 456', type: 'retail',    address: 'Résidence Cité SIC, Douala' },
      { id: cMireille,   name: 'Mireille Essong',              phone: '+237 691 234 567', type: 'retail' },
      { id: cJean,       name: 'Jean-Paul Nkemdirim',          phone: '+237 670 445 566', type: 'retail',    address: 'Quartier Makepe, Douala' },
      { id: cFatou,      name: 'Fatou Diallo',                 phone: '+237 677 889 900', type: 'retail' },
      { id: cBrice,      name: 'Brice Nguemdjom',              phone: '+237 658 321 111', type: 'retail',    address: 'Logbessou, Douala' },
      { id: cClarisse,   name: 'Clarisse Mvondo',              phone: '+237 699 556 889', type: 'retail' },
      { id: cSamuel,     name: 'Samuel Toukam',                phone: '+237 677 221 334', type: 'retail',    address: 'Bonanjo, Douala' },
      { id: cNadia,      name: 'Nadia Belinga',                phone: '+237 655 998 700', type: 'retail' },
    ]).run()
    inserted += 18

    // ─── Helpers ──────────────────────────────────────────────────────────────

    const sizesSneakers = [
      { size: '38', pairsCount: 4 },
      { size: '39', pairsCount: 6 },
      { size: '40', pairsCount: 6 },
      { size: '41', pairsCount: 5 },
      { size: '42', pairsCount: 3 },
    ]
    const sizesHigh = [
      { size: '40', pairsCount: 3 },
      { size: '41', pairsCount: 4 },
      { size: '42', pairsCount: 3 },
      { size: '43', pairsCount: 2 },
    ]
    const sizesMixed = [
      { size: '37', pairsCount: 3 },
      { size: '38', pairsCount: 5 },
      { size: '39', pairsCount: 6 },
      { size: '40', pairsCount: 6 },
      { size: '41', pairsCount: 4 },
    ]
    const sizesSandals = [
      { size: '36', pairsCount: 4 },
      { size: '37', pairsCount: 5 },
      { size: '38', pairsCount: 6 },
      { size: '39', pairsCount: 5 },
      { size: '40', pairsCount: 4 },
    ]

    type SizeEntry = { size: string; pairsCount: number }

    const makeSizes = (oi: string, arr: SizeEntry[]) => {
      for (const s of arr) db.insert(cartonSizeCompositions).values({ id: randomUUID(), orderItemId: oi, ...s }).run()
    }

    const addReception = (
      orderId: string, warehouseId: string, date: string,
      items: Array<{ orderItemId: string; cartons: number; productId: string; sizes: SizeEntry[]; unitCostPerCarton: number; pairsPerCarton: number }>,
    ) => {
      const recId = randomUUID()
      db.insert(receptions).values({ id: recId, orderId, warehouseId, receptionDate: date }).run()
      for (const item of items) {
        db.insert(receptionItems).values({ id: randomUUID(), receptionId: recId, orderItemId: item.orderItemId, cartonsReceived: item.cartons }).run()
        const unitCost = Math.round(item.unitCostPerCarton / item.pairsPerCarton)
        for (const sz of item.sizes) {
          db.insert(stockMovements).values({
            id: randomUUID(), productId: item.productId, warehouseId,
            size: sz.size, quantity: sz.pairsCount * item.cartons,
            movementType: 'reception', referenceId: recId, referenceType: 'reception',
            unitCostFcfa: unitCost, movementDate: date,
          }).run()
        }
      }
      return recId
    }

    const addTransfer = (
      fromId: string, toId: string, date: string,
      items: Array<{ productId: string; size: string; pairsCount: number }>,
    ) => {
      const tId = randomUUID()
      db.insert(transfers).values({ id: tId, fromWarehouseId: fromId, toWarehouseId: toId, transferDate: date }).run()
      for (const ti of items) {
        db.insert(transferItems).values({ id: randomUUID(), transferId: tId, ...ti }).run()
        db.insert(stockMovements).values({ id: randomUUID(), productId: ti.productId, warehouseId: fromId, size: ti.size, quantity: -ti.pairsCount, movementType: 'transfer_out', referenceId: tId, referenceType: 'transfer', movementDate: date }).run()
        db.insert(stockMovements).values({ id: randomUUID(), productId: ti.productId, warehouseId: toId,   size: ti.size, quantity:  ti.pairsCount, movementType: 'transfer_in',  referenceId: tId, referenceType: 'transfer', movementDate: date }).run()
      }
    }

    const addSale = (opts: {
      dAgo: number
      customerId: string
      warehouseId: string
      saleType: 'wholesale' | 'retail'
      paid: number
      items: Array<{ productId: string; size: string; quantity: number; unitPriceFcfa: number }>
    }) => {
      const saleId   = randomUUID()
      const saleDate = daysAgo(opts.dAgo)
      const total    = opts.items.reduce((s, i) => s + i.quantity * i.unitPriceFcfa, 0)
      const status   = opts.paid === 0 ? 'pending' as const : opts.paid >= total ? 'paid' as const : 'partial' as const
      const ref      = `VTE-${saleDate.replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      db.insert(sales).values({ id: saleId, reference: ref, customerId: opts.customerId, warehouseId: opts.warehouseId, saleDate, saleType: opts.saleType, totalAmountFcfa: total, paidAmountFcfa: opts.paid, status }).run()
      for (const item of opts.items) {
        db.insert(saleItems).values({ id: randomUUID(), saleId, ...item }).run()
        db.insert(stockMovements).values({ id: randomUUID(), productId: item.productId, warehouseId: opts.warehouseId, size: item.size, quantity: -item.quantity, movementType: 'sale', referenceId: saleId, referenceType: 'sale', movementDate: saleDate }).run()
      }
      if (opts.paid > 0) db.insert(salePayments).values({ id: randomUUID(), saleId, amountFcfa: opts.paid, paymentDate: saleDate }).run()
      inserted++
    }

    // ─── 5. Commandes fournisseur — 10 commandes ──────────────────────────────

    // ── CMD-001 : Chine 1 (6 mois) ── complète
    const ord1 = randomUUID()
    const oi1a = randomUUID(); const oi1b = randomUUID(); const oi1c = randomUUID(); const oi1d = randomUUID()
    db.insert(purchaseOrders).values({ id: ord1, reference: 'CMD-2024-001', supplierId: supCN, orderDate: daysAgo(180), expectedDeliveryDate: daysAgo(150), status: 'complete', productCostFcfa: 6_500_000, freightCostFcfa: 1_200_000, customsCostFcfa: 850_000, otherCostsFcfa: 300_000, totalCostFcfa: 8_850_000 }).run()
    db.insert(purchaseOrderItems).values([
      { id: oi1a, orderId: ord1, productId: prAF1,   cartonsOrdered: 20, pairsPerCarton: 24, unitCostPerCartonFcfa: 180_000 },
      { id: oi1b, orderId: ord1, productId: prAF1BLK,cartonsOrdered: 15, pairsPerCarton: 24, unitCostPerCartonFcfa: 180_000 },
      { id: oi1c, orderId: ord1, productId: prSS,    cartonsOrdered: 18, pairsPerCarton: 24, unitCostPerCartonFcfa: 160_000 },
      { id: oi1d, orderId: ord1, productId: prVans,  cartonsOrdered: 12, pairsPerCarton: 24, unitCostPerCartonFcfa: 145_000 },
    ]).run()
    makeSizes(oi1a, sizesSneakers); makeSizes(oi1b, sizesSneakers); makeSizes(oi1c, sizesSneakers); makeSizes(oi1d, sizesSneakers)
    db.insert(orderPayments).values([
      { id: randomUUID(), orderId: ord1, amountFcfa: 4_425_000, paymentDate: daysAgo(175), type: 'deposit' },
      { id: randomUUID(), orderId: ord1, amountFcfa: 4_425_000, paymentDate: daysAgo(151), type: 'balance' },
    ]).run()

    // ── CMD-002 : Hong Kong (5 mois) ── complète
    const ord2 = randomUUID()
    const oi2a = randomUUID(); const oi2b = randomUUID(); const oi2c = randomUUID()
    db.insert(purchaseOrders).values({ id: ord2, reference: 'CMD-2024-002', supplierId: supHK, orderDate: daysAgo(155), expectedDeliveryDate: daysAgo(125), status: 'complete', productCostFcfa: 5_200_000, freightCostFcfa: 900_000, customsCostFcfa: 650_000, otherCostsFcfa: 200_000, totalCostFcfa: 6_950_000 }).run()
    db.insert(purchaseOrderItems).values([
      { id: oi2a, orderId: ord2, productId: prConv,   cartonsOrdered: 14, pairsPerCarton: 24, unitCostPerCartonFcfa: 155_000 },
      { id: oi2b, orderId: ord2, productId: prPuma,   cartonsOrdered: 16, pairsPerCarton: 24, unitCostPerCartonFcfa: 138_000 },
      { id: oi2c, orderId: ord2, productId: prNB574,  cartonsOrdered: 10, pairsPerCarton: 24, unitCostPerCartonFcfa: 172_000 },
    ]).run()
    makeSizes(oi2a, sizesMixed); makeSizes(oi2b, sizesSneakers); makeSizes(oi2c, sizesSneakers)
    db.insert(orderPayments).values({ id: randomUUID(), orderId: ord2, amountFcfa: 6_950_000, paymentDate: daysAgo(154), type: 'full' }).run()

    // ── CMD-003 : Dubai (4 mois) ── complète
    const ord3 = randomUUID()
    const oi3a = randomUUID(); const oi3b = randomUUID()
    db.insert(purchaseOrders).values({ id: ord3, reference: 'CMD-2024-003', supplierId: supDXB, orderDate: daysAgo(120), expectedDeliveryDate: daysAgo(90), status: 'complete', productCostFcfa: 4_800_000, freightCostFcfa: 800_000, customsCostFcfa: 600_000, otherCostsFcfa: 150_000, totalCostFcfa: 6_350_000 }).run()
    db.insert(purchaseOrderItems).values([
      { id: oi3a, orderId: ord3, productId: prJ1,    cartonsOrdered: 12, pairsPerCarton: 12, unitCostPerCartonFcfa: 260_000 },
      { id: oi3b, orderId: ord3, productId: prJ4,    cartonsOrdered: 8,  pairsPerCarton: 12, unitCostPerCartonFcfa: 295_000 },
    ]).run()
    makeSizes(oi3a, sizesHigh); makeSizes(oi3b, sizesHigh)
    db.insert(orderPayments).values([
      { id: randomUUID(), orderId: ord3, amountFcfa: 3_000_000, paymentDate: daysAgo(118), type: 'deposit' },
      { id: randomUUID(), orderId: ord3, amountFcfa: 3_350_000, paymentDate: daysAgo(91),  type: 'balance' },
    ]).run()

    // ── CMD-004 : Turquie (3 mois) ── complète
    const ord4 = randomUUID()
    const oi4a = randomUUID(); const oi4b = randomUUID()
    db.insert(purchaseOrders).values({ id: ord4, reference: 'CMD-2024-004', supplierId: supTR, orderDate: daysAgo(100), expectedDeliveryDate: daysAgo(72), status: 'complete', productCostFcfa: 3_600_000, freightCostFcfa: 700_000, customsCostFcfa: 500_000, otherCostsFcfa: 120_000, totalCostFcfa: 4_920_000 }).run()
    db.insert(purchaseOrderItems).values([
      { id: oi4a, orderId: ord4, productId: prTimb,  cartonsOrdered: 10, pairsPerCarton: 12, unitCostPerCartonFcfa: 205_000 },
      { id: oi4b, orderId: ord4, productId: prBirken,cartonsOrdered: 14, pairsPerCarton: 20, unitCostPerCartonFcfa: 128_000 },
    ]).run()
    makeSizes(oi4a, sizesHigh); makeSizes(oi4b, sizesSandals)
    db.insert(orderPayments).values({ id: randomUUID(), orderId: ord4, amountFcfa: 4_920_000, paymentDate: daysAgo(99), type: 'full' }).run()

    // ── CMD-005 : Chine 2 (2 mois) ── complète
    const ord5 = randomUUID()
    const oi5a = randomUUID(); const oi5b = randomUUID(); const oi5c = randomUUID()
    db.insert(purchaseOrders).values({ id: ord5, reference: 'CMD-2024-005', supplierId: supCN2, orderDate: daysAgo(75), expectedDeliveryDate: daysAgo(45), status: 'complete', productCostFcfa: 7_200_000, freightCostFcfa: 1_100_000, customsCostFcfa: 780_000, otherCostsFcfa: 250_000, totalCostFcfa: 9_330_000 }).run()
    db.insert(purchaseOrderItems).values([
      { id: oi5a, orderId: ord5, productId: prDunk,   cartonsOrdered: 10, pairsPerCarton: 12, unitCostPerCartonFcfa: 280_000 },
      { id: oi5b, orderId: ord5, productId: prYeezy,  cartonsOrdered: 8,  pairsPerCarton: 12, unitCostPerCartonFcfa: 350_000 },
      { id: oi5c, orderId: ord5, productId: prSalomon,cartonsOrdered: 12, pairsPerCarton: 12, unitCostPerCartonFcfa: 240_000 },
    ]).run()
    makeSizes(oi5a, sizesHigh); makeSizes(oi5b, sizesHigh); makeSizes(oi5c, sizesHigh)
    db.insert(orderPayments).values([
      { id: randomUUID(), orderId: ord5, amountFcfa: 5_000_000, paymentDate: daysAgo(74), type: 'deposit' },
      { id: randomUUID(), orderId: ord5, amountFcfa: 4_330_000, paymentDate: daysAgo(46), type: 'balance' },
    ]).run()

    // ── CMD-006 : Italie (6 sem) ── complète
    const ord6 = randomUUID()
    const oi6a = randomUUID(); const oi6b = randomUUID()
    db.insert(purchaseOrders).values({ id: ord6, reference: 'CMD-2025-001', supplierId: supIT, orderDate: daysAgo(50), expectedDeliveryDate: daysAgo(25), status: 'complete', productCostFcfa: 4_100_000, freightCostFcfa: 950_000, customsCostFcfa: 680_000, otherCostsFcfa: 180_000, totalCostFcfa: 5_910_000 }).run()
    db.insert(purchaseOrderItems).values([
      { id: oi6a, orderId: ord6, productId: prAF1,    cartonsOrdered: 10, pairsPerCarton: 24, unitCostPerCartonFcfa: 210_000 },
      { id: oi6b, orderId: ord6, productId: prAF1BLK, cartonsOrdered: 8,  pairsPerCarton: 24, unitCostPerCartonFcfa: 210_000 },
    ]).run()
    makeSizes(oi6a, sizesSneakers); makeSizes(oi6b, sizesSneakers)
    db.insert(orderPayments).values([
      { id: randomUUID(), orderId: ord6, amountFcfa: 3_000_000, paymentDate: daysAgo(49), type: 'deposit' },
      { id: randomUUID(), orderId: ord6, amountFcfa: 2_910_000, paymentDate: daysAgo(26), type: 'balance' },
    ]).run()

    // ── CMD-007 : Hong Kong (1 mois) ── partielle
    const ord7 = randomUUID()
    const oi7a = randomUUID(); const oi7b = randomUUID()
    db.insert(purchaseOrders).values({ id: ord7, reference: 'CMD-2025-002', supplierId: supHK, orderDate: daysAgo(35), expectedDeliveryDate: daysAgo(10), status: 'partial', productCostFcfa: 3_400_000, freightCostFcfa: 620_000, customsCostFcfa: 480_000, otherCostsFcfa: 100_000, totalCostFcfa: 4_600_000 }).run()
    db.insert(purchaseOrderItems).values([
      { id: oi7a, orderId: ord7, productId: prSS,    cartonsOrdered: 12, pairsPerCarton: 24, unitCostPerCartonFcfa: 162_000 },
      { id: oi7b, orderId: ord7, productId: prConv,  cartonsOrdered: 10, pairsPerCarton: 24, unitCostPerCartonFcfa: 158_000 },
    ]).run()
    makeSizes(oi7a, sizesSneakers); makeSizes(oi7b, sizesMixed)
    db.insert(orderPayments).values({ id: randomUUID(), orderId: ord7, amountFcfa: 2_300_000, paymentDate: daysAgo(34), type: 'deposit' }).run()

    // ── CMD-008 : Chine (en transit) ── confirmée
    const ord8 = randomUUID()
    const oi8a = randomUUID(); const oi8b = randomUUID(); const oi8c = randomUUID()
    db.insert(purchaseOrders).values({ id: ord8, reference: 'CMD-2025-003', supplierId: supCN, orderDate: daysAgo(18), expectedDeliveryDate: daysAgo(-25), status: 'confirmed', productCostFcfa: 8_500_000, freightCostFcfa: 1_400_000, customsCostFcfa: 950_000, otherCostsFcfa: 350_000, totalCostFcfa: 11_200_000 }).run()
    db.insert(purchaseOrderItems).values([
      { id: oi8a, orderId: ord8, productId: prAF1,    cartonsOrdered: 20, pairsPerCarton: 24, unitCostPerCartonFcfa: 195_000 },
      { id: oi8b, orderId: ord8, productId: prDunk,   cartonsOrdered: 15, pairsPerCarton: 12, unitCostPerCartonFcfa: 290_000 },
      { id: oi8c, orderId: ord8, productId: prVans,   cartonsOrdered: 18, pairsPerCarton: 24, unitCostPerCartonFcfa: 148_000 },
    ]).run()
    makeSizes(oi8a, sizesSneakers); makeSizes(oi8b, sizesHigh); makeSizes(oi8c, sizesSneakers)
    db.insert(orderPayments).values({ id: randomUUID(), orderId: ord8, amountFcfa: 5_600_000, paymentDate: daysAgo(17), type: 'deposit' }).run()

    // ── CMD-009 : Dubaï (en transit) ── confirmée
    const ord9 = randomUUID()
    const oi9a = randomUUID()
    db.insert(purchaseOrders).values({ id: ord9, reference: 'CMD-2025-004', supplierId: supDXB, orderDate: daysAgo(12), expectedDeliveryDate: daysAgo(-30), status: 'confirmed', productCostFcfa: 4_200_000, freightCostFcfa: 750_000, customsCostFcfa: 540_000, otherCostsFcfa: 180_000, totalCostFcfa: 5_670_000 }).run()
    db.insert(purchaseOrderItems).values([
      { id: oi9a, orderId: ord9, productId: prYeezy,  cartonsOrdered: 10, pairsPerCarton: 12, unitCostPerCartonFcfa: 360_000 },
    ]).run()
    makeSizes(oi9a, sizesHigh)
    db.insert(orderPayments).values({ id: randomUUID(), orderId: ord9, amountFcfa: 2_835_000, paymentDate: daysAgo(11), type: 'deposit' }).run()

    // ── CMD-010 : Chine 2 (brouillon) ── draft
    const ord10 = randomUUID()
    const oi10a = randomUUID(); const oi10b = randomUUID()
    db.insert(purchaseOrders).values({ id: ord10, reference: 'CMD-2025-005', supplierId: supCN2, orderDate: daysAgo(3), status: 'draft', productCostFcfa: 5_000_000, freightCostFcfa: 900_000, customsCostFcfa: 620_000, otherCostsFcfa: 200_000, totalCostFcfa: 6_720_000 }).run()
    db.insert(purchaseOrderItems).values([
      { id: oi10a, orderId: ord10, productId: prJ1,     cartonsOrdered: 10, pairsPerCarton: 12, unitCostPerCartonFcfa: 270_000 },
      { id: oi10b, orderId: ord10, productId: prSalomon,cartonsOrdered: 12, pairsPerCarton: 12, unitCostPerCartonFcfa: 250_000 },
    ]).run()
    makeSizes(oi10a, sizesHigh); makeSizes(oi10b, sizesHigh)
    inserted += 10 // orders

    // ─── 6. Réceptions ───────────────────────────────────────────────────────

    addReception(ord1, whCentral, daysAgo(148), [
      { orderItemId: oi1a, cartons: 20, productId: prAF1,    sizes: sizesSneakers, unitCostPerCarton: 180_000, pairsPerCarton: 24 },
      { orderItemId: oi1b, cartons: 15, productId: prAF1BLK, sizes: sizesSneakers, unitCostPerCarton: 180_000, pairsPerCarton: 24 },
      { orderItemId: oi1c, cartons: 18, productId: prSS,     sizes: sizesSneakers, unitCostPerCarton: 160_000, pairsPerCarton: 24 },
      { orderItemId: oi1d, cartons: 12, productId: prVans,   sizes: sizesSneakers, unitCostPerCarton: 145_000, pairsPerCarton: 24 },
    ])
    db.update(purchaseOrders).set({ status: 'complete' }).where(eq(purchaseOrders.id, ord1)).run()
    inserted++

    addReception(ord2, whCentral, daysAgo(122), [
      { orderItemId: oi2a, cartons: 14, productId: prConv,  sizes: sizesMixed,    unitCostPerCarton: 155_000, pairsPerCarton: 24 },
      { orderItemId: oi2b, cartons: 16, productId: prPuma,  sizes: sizesSneakers, unitCostPerCarton: 138_000, pairsPerCarton: 24 },
      { orderItemId: oi2c, cartons: 10, productId: prNB574, sizes: sizesSneakers, unitCostPerCarton: 172_000, pairsPerCarton: 24 },
    ])
    db.update(purchaseOrders).set({ status: 'complete' }).where(eq(purchaseOrders.id, ord2)).run()
    inserted++

    addReception(ord3, whCentral, daysAgo(87), [
      { orderItemId: oi3a, cartons: 12, productId: prJ1,  sizes: sizesHigh, unitCostPerCarton: 260_000, pairsPerCarton: 12 },
      { orderItemId: oi3b, cartons: 8,  productId: prJ4,  sizes: sizesHigh, unitCostPerCarton: 295_000, pairsPerCarton: 12 },
    ])
    db.update(purchaseOrders).set({ status: 'complete' }).where(eq(purchaseOrders.id, ord3)).run()
    inserted++

    addReception(ord4, whCentral, daysAgo(70), [
      { orderItemId: oi4a, cartons: 10, productId: prTimb,  sizes: sizesHigh,    unitCostPerCarton: 205_000, pairsPerCarton: 12 },
      { orderItemId: oi4b, cartons: 14, productId: prBirken,sizes: sizesSandals, unitCostPerCarton: 128_000, pairsPerCarton: 20 },
    ])
    db.update(purchaseOrders).set({ status: 'complete' }).where(eq(purchaseOrders.id, ord4)).run()
    inserted++

    addReception(ord5, whCentral, daysAgo(43), [
      { orderItemId: oi5a, cartons: 10, productId: prDunk,    sizes: sizesHigh, unitCostPerCarton: 280_000, pairsPerCarton: 12 },
      { orderItemId: oi5b, cartons: 8,  productId: prYeezy,   sizes: sizesHigh, unitCostPerCarton: 350_000, pairsPerCarton: 12 },
      { orderItemId: oi5c, cartons: 12, productId: prSalomon, sizes: sizesHigh, unitCostPerCarton: 240_000, pairsPerCarton: 12 },
    ])
    db.update(purchaseOrders).set({ status: 'complete' }).where(eq(purchaseOrders.id, ord5)).run()
    inserted++

    addReception(ord6, whCentral, daysAgo(23), [
      { orderItemId: oi6a, cartons: 10, productId: prAF1,    sizes: sizesSneakers, unitCostPerCarton: 210_000, pairsPerCarton: 24 },
      { orderItemId: oi6b, cartons: 8,  productId: prAF1BLK, sizes: sizesSneakers, unitCostPerCarton: 210_000, pairsPerCarton: 24 },
    ])
    db.update(purchaseOrders).set({ status: 'complete' }).where(eq(purchaseOrders.id, ord6)).run()
    inserted++

    // CMD-007 partielle — 6 cartons SS reçus sur 12
    addReception(ord7, whCentral, daysAgo(8), [
      { orderItemId: oi7a, cartons: 6, productId: prSS,   sizes: sizesSneakers, unitCostPerCarton: 162_000, pairsPerCarton: 24 },
      { orderItemId: oi7b, cartons: 5, productId: prConv, sizes: sizesMixed,    unitCostPerCarton: 158_000, pairsPerCarton: 24 },
    ])
    inserted++

    // ─── 7. Transferts vers boutiques — 12 transferts ─────────────────────────

    // Wave 1 : après réception CMD-001 (J-148) → boutiques le lendemain
    addTransfer(whCentral, whAkwa, daysAgo(145), [
      { productId: prAF1,    size: '39', pairsCount: 36 }, { productId: prAF1,    size: '40', pairsCount: 36 }, { productId: prAF1,    size: '41', pairsCount: 30 },
      { productId: prAF1BLK, size: '39', pairsCount: 24 }, { productId: prAF1BLK, size: '40', pairsCount: 24 },
      { productId: prSS,     size: '39', pairsCount: 30 }, { productId: prSS,     size: '40', pairsCount: 30 },
    ])
    addTransfer(whCentral, whBonanjo, daysAgo(144), [
      { productId: prAF1,    size: '40', pairsCount: 24 }, { productId: prAF1,    size: '41', pairsCount: 24 },
      { productId: prAF1BLK, size: '40', pairsCount: 18 }, { productId: prAF1BLK, size: '41', pairsCount: 18 },
      { productId: prVans,   size: '39', pairsCount: 24 }, { productId: prVans,   size: '40', pairsCount: 24 },
    ])
    addTransfer(whCentral, whBassaB, daysAgo(143), [
      { productId: prSS,   size: '38', pairsCount: 20 }, { productId: prSS,   size: '39', pairsCount: 24 },
      { productId: prVans, size: '39', pairsCount: 20 }, { productId: prVans, size: '40', pairsCount: 20 },
    ])
    inserted += 3

    // Wave 2 : après CMD-002 (J-122)
    addTransfer(whCentral, whAkwa, daysAgo(119), [
      { productId: prPuma,  size: '39', pairsCount: 30 }, { productId: prPuma,  size: '40', pairsCount: 30 },
      { productId: prConv,  size: '38', pairsCount: 24 }, { productId: prConv,  size: '39', pairsCount: 30 },
      { productId: prNB574, size: '39', pairsCount: 24 }, { productId: prNB574, size: '40', pairsCount: 24 },
    ])
    addTransfer(whCentral, whBonanjo, daysAgo(118), [
      { productId: prPuma,  size: '40', pairsCount: 24 }, { productId: prPuma,  size: '41', pairsCount: 20 },
      { productId: prNB574, size: '40', pairsCount: 18 }, { productId: prNB574, size: '41', pairsCount: 15 },
    ])
    inserted += 2

    // Wave 3 : après CMD-003/004 (J-87/70)
    addTransfer(whCentral, whAkwa, daysAgo(84), [
      { productId: prJ1,    size: '40', pairsCount: 9  }, { productId: prJ1,    size: '41', pairsCount: 12 }, { productId: prJ1,    size: '42', pairsCount: 9  },
      { productId: prJ4,    size: '40', pairsCount: 6  }, { productId: prJ4,    size: '41', pairsCount: 8  }, { productId: prJ4,    size: '42', pairsCount: 6  },
      { productId: prTimb,  size: '41', pairsCount: 8  }, { productId: prTimb,  size: '42', pairsCount: 8  },
    ])
    addTransfer(whCentral, whBonanjo, daysAgo(68), [
      { productId: prJ1,    size: '40', pairsCount: 9  }, { productId: prJ1,    size: '41', pairsCount: 9  },
      { productId: prBirken,size: '37', pairsCount: 12 }, { productId: prBirken,size: '38', pairsCount: 16 }, { productId: prBirken,size: '39', pairsCount: 14 },
    ])
    addTransfer(whCentral, whBassaB, daysAgo(67), [
      { productId: prTimb,  size: '40', pairsCount: 6  }, { productId: prTimb,  size: '41', pairsCount: 6  },
      { productId: prBirken,size: '37', pairsCount: 8  }, { productId: prBirken,size: '38', pairsCount: 10 },
    ])
    inserted += 3

    // Wave 4 : après CMD-005 (J-43)
    addTransfer(whCentral, whAkwa, daysAgo(40), [
      { productId: prDunk,    size: '40', pairsCount: 9  }, { productId: prDunk,    size: '41', pairsCount: 12 }, { productId: prDunk,    size: '42', pairsCount: 9  },
      { productId: prYeezy,   size: '40', pairsCount: 6  }, { productId: prYeezy,   size: '41', pairsCount: 8  }, { productId: prYeezy,   size: '42', pairsCount: 6  },
      { productId: prSalomon, size: '40', pairsCount: 9  }, { productId: prSalomon, size: '41', pairsCount: 12 }, { productId: prSalomon, size: '42', pairsCount: 9  },
    ])
    addTransfer(whCentral, whBassaB, daysAgo(39), [
      { productId: prDunk,    size: '41', pairsCount: 8 }, { productId: prDunk,    size: '42', pairsCount: 6 },
      { productId: prSalomon, size: '41', pairsCount: 9 }, { productId: prSalomon, size: '42', pairsCount: 9 },
    ])
    inserted += 2

    // Wave 5 : après CMD-006 + CMD-007 partial (récent)
    addTransfer(whCentral, whAkwa, daysAgo(20), [
      { productId: prAF1,    size: '39', pairsCount: 24 }, { productId: prAF1,    size: '40', pairsCount: 24 },
      { productId: prAF1BLK, size: '39', pairsCount: 18 }, { productId: prAF1BLK, size: '40', pairsCount: 18 },
      { productId: prSS,     size: '39', pairsCount: 18 }, { productId: prSS,     size: '40', pairsCount: 18 },
    ])
    addTransfer(whCentral, whBonanjo, daysAgo(6), [
      { productId: prAF1,    size: '40', pairsCount: 12 }, { productId: prAF1,    size: '41', pairsCount: 12 },
      { productId: prConv,   size: '38', pairsCount: 12 }, { productId: prConv,   size: '39', pairsCount: 16 },
    ])
    inserted += 2

    // ─── 8. Ventes — 90 jours de données denses ───────────────────────────────

    // Grossistes — ventes importantes
    const W = 'wholesale' as const
    const R = 'retail'    as const

    const salesBatch = [
      // ── Mois -3 (J-90 à J-61) ──
      { dAgo: 88, customerId: cAmNgong,    warehouseId: whAkwa,    saleType: W, paid: 2_520_000, items: [{ productId: prAF1, size: '39', quantity: 20, unitPriceFcfa: 42_000 }, { productId: prAF1, size: '40', quantity: 20, unitPriceFcfa: 42_000 }, { productId: prAF1BLK, size: '39', quantity: 15, unitPriceFcfa: 42_000 }] },
      { dAgo: 85, customerId: cMarche,     warehouseId: whAkwa,    saleType: W, paid: 1_860_000, items: [{ productId: prSS, size: '39', quantity: 20, unitPriceFcfa: 38_000 }, { productId: prSS, size: '40', quantity: 18, unitPriceFcfa: 38_000 }, { productId: prVans, size: '39', quantity: 12, unitPriceFcfa: 34_000 }] },
      { dAgo: 83, customerId: cYaound,     warehouseId: whBonanjo, saleType: W, paid: 0,         items: [{ productId: prAF1, size: '40', quantity: 12, unitPriceFcfa: 42_000 }, { productId: prAF1BLK, size: '40', quantity: 10, unitPriceFcfa: 42_000 }] },
      { dAgo: 82, customerId: cPatrick,    warehouseId: whAkwa,    saleType: R, paid: 42_000,    items: [{ productId: prAF1, size: '42', quantity: 1, unitPriceFcfa: 42_000 }] },
      { dAgo: 80, customerId: cKomlan,     warehouseId: whAkwa,    saleType: W, paid: 2_040_000, items: [{ productId: prSS, size: '38', quantity: 16, unitPriceFcfa: 38_000 }, { productId: prSS, size: '39', quantity: 14, unitPriceFcfa: 38_000 }, { productId: prVans, size: '40', quantity: 18, unitPriceFcfa: 34_000 }] },
      { dAgo: 78, customerId: cMireille,   warehouseId: whBonanjo, saleType: R, paid: 38_000,    items: [{ productId: prSS, size: '38', quantity: 1, unitPriceFcfa: 38_000 }] },
      { dAgo: 76, customerId: cGaroua,     warehouseId: whAkwa,    saleType: W, paid: 1_700_000, items: [{ productId: prAF1BLK, size: '39', quantity: 20, unitPriceFcfa: 42_000 }, { productId: prVans, size: '39', quantity: 20, unitPriceFcfa: 34_000 }] },
      { dAgo: 74, customerId: cLibreville, warehouseId: whAkwa,    saleType: W, paid: 2_880_000, items: [{ productId: prAF1, size: '39', quantity: 24, unitPriceFcfa: 44_000 }, { productId: prAF1, size: '40', quantity: 24, unitPriceFcfa: 44_000 }] },
      { dAgo: 72, customerId: cJean,       warehouseId: whBassaB,  saleType: R, paid: 76_000,    items: [{ productId: prSS, size: '41', quantity: 2, unitPriceFcfa: 38_000 }] },
      { dAgo: 70, customerId: cBafouss,    warehouseId: whAkwa,    saleType: W, paid: 1_540_000, items: [{ productId: prPuma, size: '39', quantity: 20, unitPriceFcfa: 34_000 }, { productId: prNB574, size: '40', quantity: 18, unitPriceFcfa: 38_000 }] },
      { dAgo: 68, customerId: cAbidjan,    warehouseId: whAkwa,    saleType: W, paid: 3_300_000, items: [{ productId: prAF1, size: '39', quantity: 24, unitPriceFcfa: 44_000 }, { productId: prAF1BLK, size: '39', quantity: 18, unitPriceFcfa: 44_000 }, { productId: prSS, size: '39', quantity: 12, unitPriceFcfa: 40_000 }] },
      { dAgo: 66, customerId: cFatou,      warehouseId: whBonanjo, saleType: R, paid: 34_000,    items: [{ productId: prPuma, size: '38', quantity: 1, unitPriceFcfa: 34_000 }] },
      { dAgo: 63, customerId: cEbenezer,   warehouseId: whAkwa,    saleType: W, paid: 1_200_000, items: [{ productId: prConv, size: '38', quantity: 16, unitPriceFcfa: 36_000 }, { productId: prConv, size: '39', quantity: 17, unitPriceFcfa: 36_000 }] },

      // ── Mois -2 (J-60 à J-31) ──
      { dAgo: 60, customerId: cAmNgong,    warehouseId: whAkwa,    saleType: W, paid: 1_872_000, items: [{ productId: prJ1, size: '40', quantity: 9, unitPriceFcfa: 65_000 }, { productId: prJ1, size: '41', quantity: 9, unitPriceFcfa: 65_000 }, { productId: prJ4, size: '40', quantity: 6, unitPriceFcfa: 72_000 }] },
      { dAgo: 58, customerId: cDakar,      warehouseId: whAkwa,    saleType: W, paid: 2_700_000, items: [{ productId: prAF1, size: '40', quantity: 30, unitPriceFcfa: 45_000 }, { productId: prAF1BLK, size: '40', quantity: 30, unitPriceFcfa: 45_000 }] },
      { dAgo: 56, customerId: cBrice,      warehouseId: whBassaB,  saleType: R, paid: 65_000,    items: [{ productId: prJ1, size: '42', quantity: 1, unitPriceFcfa: 65_000 }] },
      { dAgo: 54, customerId: cYaound,     warehouseId: whBonanjo, saleType: W, paid: 1_820_000, items: [{ productId: prBirken, size: '37', quantity: 20, unitPriceFcfa: 28_000 }, { productId: prBirken, size: '38', quantity: 25, unitPriceFcfa: 28_000 }, { productId: prBirken, size: '39', quantity: 20, unitPriceFcfa: 28_000 }] },
      { dAgo: 52, customerId: cMarche,     warehouseId: whAkwa,    saleType: W, paid: 2_250_000, items: [{ productId: prTimb, size: '41', quantity: 15, unitPriceFcfa: 55_000 }, { productId: prTimb, size: '42', quantity: 15, unitPriceFcfa: 55_000 }] },
      { dAgo: 50, customerId: cClarisse,   warehouseId: whBonanjo, saleType: R, paid: 56_000,    items: [{ productId: prBirken, size: '37', quantity: 2, unitPriceFcfa: 28_000 }] },
      { dAgo: 48, customerId: cGaroua,     warehouseId: whAkwa,    saleType: W, paid: 1_512_000, items: [{ productId: prPuma, size: '39', quantity: 18, unitPriceFcfa: 34_000 }, { productId: prPuma, size: '40', quantity: 18, unitPriceFcfa: 34_000 }, { productId: prNB574, size: '40', quantity: 12, unitPriceFcfa: 38_000 }] },
      { dAgo: 46, customerId: cKomlan,     warehouseId: whAkwa,    saleType: W, paid: 2_460_000, items: [{ productId: prAF1, size: '39', quantity: 18, unitPriceFcfa: 44_000 }, { productId: prAF1, size: '40', quantity: 18, unitPriceFcfa: 44_000 }, { productId: prAF1BLK, size: '40', quantity: 12, unitPriceFcfa: 44_000 }] },
      { dAgo: 44, customerId: cSamuel,     warehouseId: whBassaB,  saleType: R, paid: 72_000,    items: [{ productId: prJ4, size: '41', quantity: 1, unitPriceFcfa: 72_000 }] },
      { dAgo: 42, customerId: cAmNgong,    warehouseId: whBonanjo, saleType: W, paid: 910_000,   items: [{ productId: prBirken, size: '38', quantity: 14, unitPriceFcfa: 30_000 }, { productId: prBirken, size: '39', quantity: 16, unitPriceFcfa: 30_000 }] },
      { dAgo: 40, customerId: cLibreville, warehouseId: whAkwa,    saleType: W, paid: 3_840_000, items: [{ productId: prAF1, size: '40', quantity: 30, unitPriceFcfa: 46_000 }, { productId: prAF1BLK, size: '40', quantity: 24, unitPriceFcfa: 46_000 }] },
      { dAgo: 38, customerId: cMireille,   warehouseId: whAkwa,    saleType: R, paid: 44_000,    items: [{ productId: prAF1, size: '38', quantity: 1, unitPriceFcfa: 44_000 }] },
      { dAgo: 36, customerId: cBafouss,    warehouseId: whAkwa,    saleType: W, paid: 1_960_000, items: [{ productId: prNB574, size: '39', quantity: 20, unitPriceFcfa: 40_000 }, { productId: prNB574, size: '40', quantity: 20, unitPriceFcfa: 40_000 }] },
      { dAgo: 34, customerId: cAbidjan,    warehouseId: whAkwa,    saleType: W, paid: 0,         items: [{ productId: prPuma, size: '39', quantity: 20, unitPriceFcfa: 36_000 }, { productId: prConv, size: '38', quantity: 18, unitPriceFcfa: 36_000 }, { productId: prConv, size: '39', quantity: 18, unitPriceFcfa: 36_000 }] },
      { dAgo: 32, customerId: cPatrick,    warehouseId: whAkwa,    saleType: R, paid: 46_000,    items: [{ productId: prAF1BLK, size: '40', quantity: 1, unitPriceFcfa: 46_000 }] },

      // ── Mois -1 (J-30 à J-1) ──
      { dAgo: 30, customerId: cEbenezer,   warehouseId: whAkwa,    saleType: W, paid: 2_160_000, items: [{ productId: prDunk, size: '40', quantity: 9, unitPriceFcfa: 75_000 }, { productId: prDunk, size: '41', quantity: 12, unitPriceFcfa: 75_000 }, { productId: prDunk, size: '42', quantity: 9, unitPriceFcfa: 75_000 }] },
      { dAgo: 28, customerId: cMarche,     warehouseId: whAkwa,    saleType: W, paid: 1_800_000, items: [{ productId: prAF1, size: '39', quantity: 18, unitPriceFcfa: 46_000 }, { productId: prAF1, size: '40', quantity: 18, unitPriceFcfa: 46_000 }] },
      { dAgo: 26, customerId: cDakar,      warehouseId: whAkwa,    saleType: W, paid: 2_400_000, items: [{ productId: prYeezy, size: '40', quantity: 8, unitPriceFcfa: 95_000 }, { productId: prYeezy, size: '41', quantity: 10, unitPriceFcfa: 95_000 }, { productId: prYeezy, size: '42', quantity: 7, unitPriceFcfa: 95_000 }] },
      { dAgo: 25, customerId: cNadia,      warehouseId: whBonanjo, saleType: R, paid: 95_000,    items: [{ productId: prYeezy, size: '38', quantity: 1, unitPriceFcfa: 95_000 }] },
      { dAgo: 24, customerId: cAmNgong,    warehouseId: whAkwa,    saleType: W, paid: 2_700_000, items: [{ productId: prAF1, size: '39', quantity: 18, unitPriceFcfa: 46_000 }, { productId: prAF1BLK, size: '39', quantity: 18, unitPriceFcfa: 46_000 }, { productId: prSS, size: '40', quantity: 10, unitPriceFcfa: 40_000 }] },
      { dAgo: 22, customerId: cYaound,     warehouseId: whBonanjo, saleType: W, paid: 1_512_000, items: [{ productId: prSalomon, size: '40', quantity: 9, unitPriceFcfa: 60_000 }, { productId: prSalomon, size: '41', quantity: 12, unitPriceFcfa: 60_000 }, { productId: prSalomon, size: '42', quantity: 9, unitPriceFcfa: 60_000 }] },
      { dAgo: 20, customerId: cBrice,      warehouseId: whBassaB,  saleType: R, paid: 60_000,    items: [{ productId: prSalomon, size: '42', quantity: 1, unitPriceFcfa: 60_000 }] },
      { dAgo: 19, customerId: cKomlan,     warehouseId: whAkwa,    saleType: W, paid: 2_880_000, items: [{ productId: prAF1, size: '40', quantity: 24, unitPriceFcfa: 46_000 }, { productId: prAF1BLK, size: '40', quantity: 24, unitPriceFcfa: 46_000 }] },
      { dAgo: 17, customerId: cGaroua,     warehouseId: whAkwa,    saleType: W, paid: 1_080_000, items: [{ productId: prDunk, size: '40', quantity: 6, unitPriceFcfa: 75_000 }, { productId: prDunk, size: '41', quantity: 6, unitPriceFcfa: 75_000 }, { productId: prYeezy, size: '40', quantity: 3, unitPriceFcfa: 96_000 }] },
      { dAgo: 15, customerId: cAbidjan,    warehouseId: whAkwa,    saleType: W, paid: 3_450_000, items: [{ productId: prAF1, size: '39', quantity: 30, unitPriceFcfa: 46_000 }, { productId: prAF1BLK, size: '39', quantity: 25, unitPriceFcfa: 46_000 }] },
      { dAgo: 14, customerId: cJean,       warehouseId: whBassaB,  saleType: R, paid: 75_000,    items: [{ productId: prDunk, size: '41', quantity: 1, unitPriceFcfa: 75_000 }] },
      { dAgo: 13, customerId: cMarche,     warehouseId: whAkwa,    saleType: W, paid: 1_920_000, items: [{ productId: prSS, size: '39', quantity: 24, unitPriceFcfa: 40_000 }, { productId: prSS, size: '40', quantity: 24, unitPriceFcfa: 40_000 }] },
      { dAgo: 11, customerId: cBafouss,    warehouseId: whAkwa,    saleType: W, paid: 1_968_000, items: [{ productId: prAF1, size: '40', quantity: 18, unitPriceFcfa: 46_000 }, { productId: prSalomon, size: '40', quantity: 9, unitPriceFcfa: 62_000 }, { productId: prSalomon, size: '41', quantity: 6, unitPriceFcfa: 62_000 }] },
      { dAgo: 10, customerId: cEbenezer,   warehouseId: whBonanjo, saleType: W, paid: 0,         items: [{ productId: prYeezy, size: '41', quantity: 6, unitPriceFcfa: 96_000 }, { productId: prYeezy, size: '42', quantity: 4, unitPriceFcfa: 96_000 }] },
      { dAgo: 9,  customerId: cSamuel,     warehouseId: whBonanjo, saleType: R, paid: 46_000,    items: [{ productId: prAF1BLK, size: '40', quantity: 1, unitPriceFcfa: 46_000 }] },
      { dAgo: 8,  customerId: cAmNgong,    warehouseId: whAkwa,    saleType: W, paid: 2_484_000, items: [{ productId: prAF1, size: '39', quantity: 18, unitPriceFcfa: 46_000 }, { productId: prDunk, size: '40', quantity: 6, unitPriceFcfa: 75_000 }, { productId: prSalomon, size: '41', quantity: 6, unitPriceFcfa: 62_000 }] },
      { dAgo: 7,  customerId: cLibreville, warehouseId: whAkwa,    saleType: W, paid: 4_140_000, items: [{ productId: prAF1, size: '40', quantity: 30, unitPriceFcfa: 46_000 }, { productId: prAF1BLK, size: '40', quantity: 30, unitPriceFcfa: 46_000 }] },
      { dAgo: 6,  customerId: cFatou,      warehouseId: whBassaB,  saleType: R, paid: 40_000,    items: [{ productId: prSS, size: '37', quantity: 1, unitPriceFcfa: 40_000 }] },
      { dAgo: 5,  customerId: cKomlan,     warehouseId: whAkwa,    saleType: W, paid: 2_220_000, items: [{ productId: prAF1BLK, size: '39', quantity: 18, unitPriceFcfa: 46_000 }, { productId: prSS, size: '40', quantity: 18, unitPriceFcfa: 40_000 }] },
      { dAgo: 4,  customerId: cYaound,     warehouseId: whBonanjo, saleType: W, paid: 1_572_000, items: [{ productId: prDunk, size: '40', quantity: rand(5,9), unitPriceFcfa: 78_000 }, { productId: prYeezy, size: '41', quantity: rand(3,5), unitPriceFcfa: 96_000 }] },
      { dAgo: 3,  customerId: cMarche,     warehouseId: whAkwa,    saleType: W, paid: 2_070_000, items: [{ productId: prAF1, size: '40', quantity: 18, unitPriceFcfa: 46_000 }, { productId: prAF1BLK, size: '40', quantity: 18, unitPriceFcfa: 46_000 }, { productId: prSS, size: '39', quantity: 8, unitPriceFcfa: 40_000 }] },
      { dAgo: 2,  customerId: cDakar,      warehouseId: whAkwa,    saleType: W, paid: 3_600_000, items: [{ productId: prAF1, size: '39', quantity: 24, unitPriceFcfa: 46_000 }, { productId: prAF1BLK, size: '39', quantity: 24, unitPriceFcfa: 46_000 }, { productId: prDunk, size: '40', quantity: 6, unitPriceFcfa: 78_000 }] },
      { dAgo: 1,  customerId: cGaroua,     warehouseId: whBassaB,  saleType: W, paid: 0,         items: [{ productId: prSalomon, size: '40', quantity: 6, unitPriceFcfa: 62_000 }, { productId: prTimb, size: '41', quantity: 4, unitPriceFcfa: 58_000 }] },
      { dAgo: 1,  customerId: cClarisse,   warehouseId: whBonanjo, saleType: R, paid: 62_000,    items: [{ productId: prSalomon, size: '38', quantity: 1, unitPriceFcfa: 62_000 }] },
      // Aujourd'hui
      { dAgo: 0,  customerId: cPatrick,    warehouseId: whAkwa,    saleType: R, paid: 46_000,    items: [{ productId: prAF1, size: '40', quantity: 1, unitPriceFcfa: 46_000 }] },
      { dAgo: 0,  customerId: cAmNgong,    warehouseId: whAkwa,    saleType: W, paid: 1_104_000, items: [{ productId: prAF1, size: '40', quantity: 12, unitPriceFcfa: 46_000 }, { productId: prAF1BLK, size: '39', quantity: 12, unitPriceFcfa: 46_000 }] },
      { dAgo: 0,  customerId: cNadia,      warehouseId: whBonanjo, saleType: R, paid: 40_000,    items: [{ productId: prSS, size: '38', quantity: 1, unitPriceFcfa: 40_000 }] },
    ]

    for (const s of salesBatch) addSale(s)

    return { inserted }
  }
}

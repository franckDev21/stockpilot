import { eq, and, isNull, inArray, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db/index'
import { purchaseOrders, purchaseOrderItems, cartonSizeCompositions, orderPayments, suppliers, products, receptionItems } from '../db/schema'
import type { PurchaseOrderInsert, OrderPaymentInsert } from '../types'

/** Ligne de commande telle que soumise par le formulaire (création ou édition). */
export interface OrderItemPayload {
  /** Absent = nouvelle ligne. Présent = ligne existante à mettre à jour. */
  id?:                    string
  productId:              string
  cartonsOrdered:         number
  pairsPerCarton:         number
  unitCostPerCartonFcfa:  number
  notes?:                 string | null
  sizes:                  Array<{ size: string; pairsCount: number }>
}

/** Part d'un versement imputée à une commande précise. */
export interface PaymentAllocation {
  orderId:             string
  reference:           string
  orderDate:           string
  totalCostFcfa:       number
  paidBeforeFcfa:      number
  remainingBeforeFcfa: number
  allocatedFcfa:       number
  type:                'deposit' | 'balance' | 'full'
  /** Vrai pour la commande depuis laquelle le versement a été saisi. */
  isTargetOrder:       boolean
  /** Cette commande se retrouve soldée par le versement. */
  settled:             boolean
}

/** Répartition complète d'un versement, avant écriture. */
export interface PaymentPlan {
  supplierId:       string
  supplierName:     string | null
  amountFcfa:       number
  /** Restant dû cumulé du fournisseur, avant le versement. */
  supplierDebtFcfa: number
  allocations:      PaymentAllocation[]
  /** Le versement touche au moins une commande autre que celle visée. */
  overflow:         boolean
  /** Montant qu'aucune commande ne peut absorber ( > 0 = versement refusé ). */
  excessFcfa:       number
}

/** Un versement du fournisseur, avec le détail des commandes qu'il a servies. */
export interface SupplierPaymentGroup {
  groupId:      string
  supplierId:   string
  supplierName: string | null
  paymentDate:  string
  createdAt:    string
  totalFcfa:    number
  notes:        string | null
  lines: Array<{
    paymentId:      string
    orderId:        string
    orderReference: string
    amountFcfa:     number
    type:           'deposit' | 'balance' | 'full'
  }>
}

export class PurchaseOrderService {
  getAll() {
    return getDb().select().from(purchaseOrders).where(isNull(purchaseOrders.deletedAt))
  }

  getAllEnriched() {
    const db = getDb()

    const orders = db
      .select({
        id:                   purchaseOrders.id,
        reference:            purchaseOrders.reference,
        supplierId:           purchaseOrders.supplierId,
        supplierName:         suppliers.name,
        supplierPhone:        suppliers.phone,
        supplierWhatsapp:     suppliers.whatsapp,
        supplierEmail:        suppliers.email,
        supplierCountry:      suppliers.country,
        supplierCity:         suppliers.city,
        supplierAddress:      suppliers.address,
        orderDate:            purchaseOrders.orderDate,
        expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
        status:               purchaseOrders.status,
        totalCostFcfa:        purchaseOrders.totalCostFcfa,
        notes:                purchaseOrders.notes,
        createdAt:            purchaseOrders.createdAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(isNull(purchaseOrders.deletedAt))
      .all()

    if (orders.length === 0) return []

    const orderIds = orders.map((o) => o.id)

    const items = db
      .select({
        id:                   purchaseOrderItems.id,
        orderId:              purchaseOrderItems.orderId,
        productId:            purchaseOrderItems.productId,
        productName:          products.name,
        productReference:     products.reference,
        productImageData:     products.imageData,
        cartonsOrdered:       purchaseOrderItems.cartonsOrdered,
        pairsPerCarton:       purchaseOrderItems.pairsPerCarton,
        unitCostPerCartonFcfa: purchaseOrderItems.unitCostPerCartonFcfa,
      })
      .from(purchaseOrderItems)
      .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
      .where(inArray(purchaseOrderItems.orderId, orderIds))
      .all()

    const payments = db
      .select()
      .from(orderPayments)
      .where(inArray(orderPayments.orderId, orderIds))
      .all()

    return orders.map((order) => ({
      ...order,
      items:    items.filter((i) => i.orderId === order.id),
      payments: payments.filter((p) => p.orderId === order.id),
    }))
  }

  getById(id: string) {
    const order = getDb().select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).get()
    if (!order) return null

    const items    = getDb().select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id)).all()
    const payments = getDb().select().from(orderPayments).where(eq(orderPayments.orderId, id)).all()

    return { ...order, items, payments }
  }

  create(data: PurchaseOrderInsert & { items: Array<{ productId: string; cartonsOrdered: number; pairsPerCarton: number; unitCostPerCartonFcfa: number; sizes: Array<{ size: string; pairsCount: number }> }> }) {
    const db = getDb()
    const orderId = randomUUID()
    const reference = `CMD-${Date.now()}`

    const totalCost =
      (data.productCostFcfa  ?? 0) +
      (data.freightCostFcfa  ?? 0) +
      (data.customsCostFcfa  ?? 0) +
      (data.otherCostsFcfa   ?? 0)

    db.insert(purchaseOrders).values({
      ...data,
      id:            orderId,
      reference,
      totalCostFcfa: totalCost,
    }).run()

    for (const item of data.items) {
      const itemId = randomUUID()
      db.insert(purchaseOrderItems).values({ ...item, id: itemId, orderId }).run()

      for (const size of item.sizes) {
        db.insert(cartonSizeCompositions).values({
          id:          randomUUID(),
          orderItemId: itemId,
          size:        size.size,
          pairsCount:  size.pairsCount,
        }).run()
      }
    }

    return this.getById(orderId)
  }

  /**
   * Nombre de cartons déjà réceptionnés par ligne de commande.
   * Une ligne réceptionnée est « verrouillée » : les réceptions et les
   * mouvements de stock qu'elles ont générés pointent dessus (reception_items
   * .order_item_id), donc la supprimer ou changer sa quantité casserait la
   * traçabilité du stock.
   */
  private receivedCartonsByItem(itemIds: string[]): Map<string, number> {
    if (itemIds.length === 0) return new Map()

    const rows = getDb()
      .select({
        orderItemId: receptionItems.orderItemId,
        cartons:     sql<number>`SUM(${receptionItems.cartonsReceived})`,
      })
      .from(receptionItems)
      .where(inArray(receptionItems.orderItemId, itemIds))
      .groupBy(receptionItems.orderItemId)
      .all()

    return new Map(rows.map((r) => [r.orderItemId, r.cartons ?? 0]))
  }

  /**
   * Commande complète pour le formulaire d'édition : entête, lignes avec leurs
   * pointures, et pour chaque ligne le nombre de cartons déjà reçus (0 = ligne
   * librement modifiable).
   */
  getForEdit(id: string) {
    const db = getDb()

    const order = db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).get()
    if (!order) return null

    const items = db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.orderId, id))
      .all()

    const itemIds = items.map((i) => i.id)
    const sizes = itemIds.length
      ? db.select().from(cartonSizeCompositions).where(inArray(cartonSizeCompositions.orderItemId, itemIds)).all()
      : []
    const received = this.receivedCartonsByItem(itemIds)

    return {
      ...order,
      items: items.map((item) => ({
        ...item,
        sizes:           sizes.filter((s) => s.orderItemId === item.id),
        receivedCartons: received.get(item.id) ?? 0,
      })),
    }
  }

  /**
   * Met à jour une commande. Si `items` est fourni, les lignes sont
   * réconciliées (mise à jour / ajout / suppression) ; sinon seul l'entête
   * change.
   *
   * Les lignes déjà réceptionnées sont protégées : suppression refusée, et
   * quantité commandée jamais réduite en dessous du déjà reçu.
   */
  update(id: string, data: Partial<PurchaseOrderInsert> & { items?: OrderItemPayload[] }) {
    const db = getDb()
    const { items, ...header } = data

    db.transaction((tx) => {
      const current = tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).get()
      if (!current) throw new Error("Cette commande n'existe plus.")

      // Le total doit rester cohérent avec les postes de coût : on le recalcule
      // à partir des valeurs finales plutôt que de faire confiance à l'appelant.
      const merged = { ...current, ...header }
      const totalCostFcfa =
        (merged.productCostFcfa ?? 0) +
        (merged.freightCostFcfa ?? 0) +
        (merged.customsCostFcfa ?? 0) +
        (merged.otherCostsFcfa  ?? 0)

      tx.update(purchaseOrders)
        .set({ ...header, totalCostFcfa })
        .where(eq(purchaseOrders.id, id))
        .run()

      if (!items) return

      const existing = tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id)).all()
      const received = this.receivedCartonsByItem(existing.map((i) => i.id))
      const keptIds  = new Set(items.map((i) => i.id).filter(Boolean) as string[])

      // ── Suppressions ────────────────────────────────────────────────────
      for (const row of existing) {
        if (keptIds.has(row.id)) continue

        const alreadyReceived = received.get(row.id) ?? 0
        if (alreadyReceived > 0) {
          throw new Error(
            `Impossible de supprimer une ligne déjà réceptionnée (${alreadyReceived} carton(s) reçu(s)). ` +
            `Annulez d'abord la réception correspondante.`,
          )
        }
        tx.delete(cartonSizeCompositions).where(eq(cartonSizeCompositions.orderItemId, row.id)).run()
        tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, row.id)).run()
      }

      // ── Mises à jour et ajouts ──────────────────────────────────────────
      for (const item of items) {
        const isNew  = !item.id || !existing.some((e) => e.id === item.id)
        const itemId = isNew ? randomUUID() : item.id!

        if (isNew) {
          tx.insert(purchaseOrderItems).values({
            id:                    itemId,
            orderId:               id,
            productId:             item.productId,
            cartonsOrdered:        item.cartonsOrdered,
            pairsPerCarton:        item.pairsPerCarton,
            unitCostPerCartonFcfa: item.unitCostPerCartonFcfa,
            notes:                 item.notes ?? null,
          }).run()
        } else {
          const alreadyReceived = received.get(itemId) ?? 0
          if (alreadyReceived > 0 && item.cartonsOrdered < alreadyReceived) {
            throw new Error(
              `Cette ligne a déjà reçu ${alreadyReceived} carton(s) : la quantité commandée ` +
              `ne peut pas être inférieure (${item.cartonsOrdered} demandé).`,
            )
          }
          tx.update(purchaseOrderItems).set({
            productId:             item.productId,
            cartonsOrdered:        item.cartonsOrdered,
            pairsPerCarton:        item.pairsPerCarton,
            unitCostPerCartonFcfa: item.unitCostPerCartonFcfa,
            notes:                 item.notes ?? null,
          }).where(eq(purchaseOrderItems.id, itemId)).run()
        }

        // Les pointures n'ont pas d'identité propre : on les remplace en bloc.
        tx.delete(cartonSizeCompositions).where(eq(cartonSizeCompositions.orderItemId, itemId)).run()
        for (const size of item.sizes) {
          tx.insert(cartonSizeCompositions).values({
            id:          randomUUID(),
            orderItemId: itemId,
            size:        size.size,
            pairsCount:  size.pairsCount,
          }).run()
        }
      }
    })

    return this.getById(id)
  }

  delete(id: string) {
    const now = new Date().toISOString()
    getDb().update(purchaseOrders).set({ deletedAt: now }).where(eq(purchaseOrders.id, id)).run()
  }

  addPayment(orderId: string, data: OrderPaymentInsert) {
    getDb().insert(orderPayments).values({ ...data, id: randomUUID(), orderId }).run()
    return this.getById(orderId)
  }

  deletePayment(paymentId: string) {
    getDb().delete(orderPayments).where(eq(orderPayments.id, paymentId)).run()
  }

  // ─── Versement fournisseur réparti sur plusieurs commandes ──────────────────

  /**
   * Calcule la répartition d'un versement sans rien écrire.
   *
   * La commande visée est servie en premier ; ce qui dépasse son restant dû
   * déborde sur les autres commandes non soldées du **même fournisseur**, de la
   * plus ancienne à la plus récente (FIFO). Les commandes annulées sont ignorées.
   *
   * Sert à alimenter la modale de confirmation, puis est recalculée à
   * l'enregistrement : le plan affiché n'est jamais réutilisé tel quel.
   */
  computePaymentPlan(orderId: string, amountFcfa: number): PaymentPlan {
    const db = getDb()

    const target = db
      .select({
        id: purchaseOrders.id, supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(eq(purchaseOrders.id, orderId))
      .get()

    if (!target) throw new Error("Commande introuvable.")

    const supplierOrders = db
      .select({
        id:            purchaseOrders.id,
        reference:     purchaseOrders.reference,
        orderDate:     purchaseOrders.orderDate,
        totalCostFcfa: purchaseOrders.totalCostFcfa,
        createdAt:     purchaseOrders.createdAt,
        status:        purchaseOrders.status,
      })
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.supplierId, target.supplierId),
        isNull(purchaseOrders.deletedAt),
      ))
      .all()

    const paidByOrder = new Map<string, number>()
    if (supplierOrders.length > 0) {
      const rows = db
        .select({ orderId: orderPayments.orderId, amountFcfa: orderPayments.amountFcfa })
        .from(orderPayments)
        .where(inArray(orderPayments.orderId, supplierOrders.map((o) => o.id)))
        .all()
      for (const r of rows) {
        paidByOrder.set(r.orderId, (paidByOrder.get(r.orderId) ?? 0) + r.amountFcfa)
      }
    }

    const remainingOf = (o: { id: string; totalCostFcfa: number }) =>
      Math.max(0, o.totalCostFcfa - (paidByOrder.get(o.id) ?? 0))

    // Ordre de service : la commande visée d'abord, puis les autres du plus
    // ancien au plus récent. `createdAt` départage deux commandes du même jour.
    //
    // Le débordement ignore les commandes annulées — on ne solde pas une
    // commande abandonnée avec le surplus d'une autre — mais la commande visée
    // est toujours servie, quel que soit son statut : c'est un choix explicite
    // de l'utilisateur, et le paiement direct l'autorisait déjà.
    const others = supplierOrders
      .filter((o) => o.id !== orderId && o.status !== 'cancelled' && remainingOf(o) > 0)
      .sort((a, b) =>
        a.orderDate === b.orderDate
          ? a.createdAt.localeCompare(b.createdAt)
          : a.orderDate.localeCompare(b.orderDate),
      )
    const targetRow = supplierOrders.find((o) => o.id === orderId)
    const queue = targetRow ? [targetRow, ...others] : others

    const allocations: PaymentAllocation[] = []
    let rest = amountFcfa

    for (const order of queue) {
      if (rest <= 0) break
      const remainingBefore = remainingOf(order)
      if (remainingBefore <= 0) continue

      const allocated = Math.min(rest, remainingBefore)
      rest -= allocated

      const paidBefore = paidByOrder.get(order.id) ?? 0
      const settled    = allocated >= remainingBefore

      allocations.push({
        orderId:             order.id,
        reference:           order.reference,
        orderDate:           order.orderDate,
        totalCostFcfa:       order.totalCostFcfa,
        paidBeforeFcfa:      paidBefore,
        remainingBeforeFcfa: remainingBefore,
        allocatedFcfa:       allocated,
        // Même déduction que le formulaire de saisie, appliquée par commande.
        type: settled && paidBefore === 0 && allocated >= order.totalCostFcfa
          ? 'full'
          : settled ? 'balance' : 'deposit',
        isTargetOrder: order.id === orderId,
        settled,
      })
    }

    // Somme exactement imputable : c'est le plafond du versement, donc le
    // montant cité dans le message de refus quand `excessFcfa > 0`.
    const supplierDebtFcfa = queue.reduce((s, o) => s + remainingOf(o), 0)

    return {
      supplierId:   target.supplierId,
      supplierName: target.supplierName,
      amountFcfa,
      supplierDebtFcfa,
      allocations,
      // Déborde dès qu'une commande autre que celle visée est servie.
      overflow:    allocations.some((a) => !a.isTargetOrder),
      excessFcfa:  rest,
    }
  }

  /**
   * Enregistre un versement réparti sur plusieurs commandes en une transaction :
   * soit toutes les lignes passent, soit aucune.
   */
  addSupplierPayment(orderId: string, data: { amountFcfa: number; paymentDate: string; notes?: string | null }) {
    const db = getDb()

    if (!Number.isInteger(data.amountFcfa) || data.amountFcfa <= 0) {
      throw new Error('Montant invalide.')
    }

    // Recalculé ici : entre l'aperçu et la validation, un autre poste a pu
    // synchroniser un paiement et changer les restants dus.
    const plan = this.computePaymentPlan(orderId, data.amountFcfa)

    if (plan.excessFcfa > 0) {
      const debt = plan.supplierDebtFcfa.toLocaleString('fr-FR')
      throw new Error(
        `Le montant dépasse de ${plan.excessFcfa.toLocaleString('fr-FR')} FCFA la dette totale ` +
        `de ce fournisseur (${debt} FCFA). Réduisez le montant du versement.`,
      )
    }
    if (plan.allocations.length === 0) {
      throw new Error("Cette commande est déjà soldée : il n'y a rien à imputer.")
    }

    const paymentGroupId = randomUUID()

    db.transaction((tx) => {
      for (const alloc of plan.allocations) {
        tx.insert(orderPayments).values({
          id:          randomUUID(),
          orderId:     alloc.orderId,
          amountFcfa:  alloc.allocatedFcfa,
          paymentDate: data.paymentDate,
          type:        alloc.type,
          notes:       data.notes ?? null,
          paymentGroupId,
        }).run()
      }
    })

    return { paymentGroupId, ...plan }
  }

  /**
   * Historique des versements d'un fournisseur, toutes commandes confondues.
   *
   * Les lignes sont regroupées par versement. Les paiements mono-commande —
   * ceux d'avant cette fonctionnalité comme ceux saisis normalement — n'ont pas
   * de `paymentGroupId` : leur propre id fait office de groupe, ce qui les rend
   * imprimables de la même façon.
   */
  getSupplierPaymentHistory(supplierId: string): SupplierPaymentGroup[] {
    const db = getDb()

    const supplier = db.select().from(suppliers).where(eq(suppliers.id, supplierId)).get()

    const supplierOrders = db
      .select({
        id:            purchaseOrders.id,
        reference:     purchaseOrders.reference,
        totalCostFcfa: purchaseOrders.totalCostFcfa,
      })
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.supplierId, supplierId),
        isNull(purchaseOrders.deletedAt),
      ))
      .all()

    if (supplierOrders.length === 0) return []

    const orderById = new Map(supplierOrders.map((o) => [o.id, o]))
    const rows = db
      .select()
      .from(orderPayments)
      .where(inArray(orderPayments.orderId, supplierOrders.map((o) => o.id)))
      .all()

    const groups = new Map<string, SupplierPaymentGroup>()

    for (const p of rows) {
      const key = p.paymentGroupId ?? p.id
      let group = groups.get(key)
      if (!group) {
        group = {
          groupId:      key,
          supplierId,
          supplierName: supplier?.name ?? null,
          paymentDate:  p.paymentDate,
          createdAt:    p.createdAt,
          totalFcfa:    0,
          notes:        p.notes,
          lines:        [],
        }
        groups.set(key, group)
      }
      group.totalFcfa += p.amountFcfa
      // Le versement porte la plus ancienne empreinte de ses lignes.
      if (p.createdAt < group.createdAt) group.createdAt = p.createdAt
      group.lines.push({
        paymentId:      p.id,
        orderId:        p.orderId,
        orderReference: orderById.get(p.orderId)?.reference ?? '—',
        amountFcfa:     p.amountFcfa,
        type:           p.type,
      })
    }

    return [...groups.values()].sort((a, b) =>
      a.paymentDate === b.paymentDate
        ? b.createdAt.localeCompare(a.createdAt)
        : b.paymentDate.localeCompare(a.paymentDate),
    )
  }

  simulateProfit(data: { totalCostFcfa: number; totalCartons: number; salePricePerCartonFcfa: number }) {
    const totalRevenue    = data.salePricePerCartonFcfa * data.totalCartons
    const grossProfit     = totalRevenue - data.totalCostFcfa
    const marginPct       = data.totalCostFcfa > 0 ? (grossProfit / data.totalCostFcfa) * 100 : 0
    const costPerCarton   = data.totalCartons > 0 ? Math.round(data.totalCostFcfa / data.totalCartons) : 0

    return { totalRevenue, grossProfit, marginPct, costPerCarton }
  }
}

import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db/index'
import { transfers, transferItems, stockMovements } from '../db/schema'
import type { TransferInsert } from '../types'

export class TransferService {
  getAll() {
    return getDb().select().from(transfers)
  }

  getById(id: string) {
    const transfer = getDb().select().from(transfers).where(eq(transfers.id, id)).get()
    if (!transfer) return null
    const items = getDb().select().from(transferItems).where(eq(transferItems.transferId, id)).all()
    return { ...transfer, items }
  }

  create(data: TransferInsert & {
    items: Array<{ productId: string; size: string; pairsCount: number }>
  }) {
    const db = getDb()
    const transferId = randomUUID()

    db.insert(transfers).values({
      id:               transferId,
      fromWarehouseId:  data.fromWarehouseId,
      toWarehouseId:    data.toWarehouseId,
      transferDate:     data.transferDate,
      notes:            data.notes,
    }).run()

    for (const item of data.items) {
      db.insert(transferItems).values({
        id: randomUUID(),
        transferId,
        productId:  item.productId,
        size:       item.size,
        pairsCount: item.pairsCount,
      }).run()

      // Sortie de l'entrepôt source
      db.insert(stockMovements).values({
        id:            randomUUID(),
        productId:     item.productId,
        warehouseId:   data.fromWarehouseId,
        size:          item.size,
        quantity:      -item.pairsCount,
        movementType:  'transfer_out',
        referenceId:   transferId,
        referenceType: 'transfer',
        movementDate:  data.transferDate,
      }).run()

      // Entrée dans la boutique destination
      db.insert(stockMovements).values({
        id:            randomUUID(),
        productId:     item.productId,
        warehouseId:   data.toWarehouseId,
        size:          item.size,
        quantity:      item.pairsCount,
        movementType:  'transfer_in',
        referenceId:   transferId,
        referenceType: 'transfer',
        movementDate:  data.transferDate,
      }).run()
    }

    return this.getById(transferId)
  }
}

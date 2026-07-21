import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/app.store'
import type { PurchaseOrder } from '@/types/domain'

export function usePurchaseOrders() {
  const [orders, setOrders]   = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const dataVersion           = useAppStore((s) => s.dataVersion)

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await window.api.purchaseOrders.getAll()
      setOrders(data as PurchaseOrder[])
    } catch {
      setError('Impossible de charger les commandes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll, dataVersion])

  const create = useCallback(async (data: unknown) => {
    await window.api.purchaseOrders.create(data)
    await fetchAll()
  }, [fetchAll])

  const update = useCallback(async (id: string, data: Partial<PurchaseOrder>) => {
    await window.api.purchaseOrders.update(id, data)
    await fetchAll()
  }, [fetchAll])

  const remove = useCallback(async (id: string) => {
    await window.api.purchaseOrders.delete(id)
    await fetchAll()
  }, [fetchAll])

  const addPayment = useCallback(async (orderId: string, data: unknown) => {
    await window.api.purchaseOrders.addPayment(orderId, data)
    await fetchAll()
  }, [fetchAll])

  return { orders, loading, error, create, update, remove, addPayment, refresh: fetchAll }
}

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/app.store'
import type { Warehouse } from '@/types/domain'

export function useWarehouses() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const dataVersion                 = useAppStore((s) => s.dataVersion)

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await window.api.warehouses.getAll()
      setWarehouses(data as Warehouse[])
    } catch {
      setError('Impossible de charger les boutiques')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll, dataVersion])

  const create = useCallback(async (data: Omit<Warehouse, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>) => {
    await window.api.warehouses.create(data)
    await fetchAll()
  }, [fetchAll])

  const update = useCallback(async (id: string, data: Partial<Warehouse>) => {
    await window.api.warehouses.update(id, data)
    await fetchAll()
  }, [fetchAll])

  const remove = useCallback(async (id: string) => {
    await window.api.warehouses.delete(id)
    await fetchAll()
  }, [fetchAll])

  return { warehouses, loading, error, create, update, remove, refresh: fetchAll }
}

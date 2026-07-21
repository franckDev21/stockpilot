import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/app.store'
import type { Supplier } from '@/types/domain'

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const dataVersion               = useAppStore((s) => s.dataVersion)

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await window.api.suppliers.getAll()
      setSuppliers(data as Supplier[])
    } catch {
      setError('Impossible de charger les fournisseurs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll, dataVersion])

  const create = useCallback(async (data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>) => {
    await window.api.suppliers.create(data)
    await fetchAll()
  }, [fetchAll])

  const update = useCallback(async (id: string, data: Partial<Supplier>) => {
    await window.api.suppliers.update(id, data)
    await fetchAll()
  }, [fetchAll])

  const remove = useCallback(async (id: string) => {
    await window.api.suppliers.delete(id)
    await fetchAll()
  }, [fetchAll])

  return { suppliers, loading, error, create, update, remove, refresh: fetchAll }
}

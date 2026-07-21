import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/app.store'
import type { Customer } from '@/types/domain'

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const dataVersion               = useAppStore((s) => s.dataVersion)

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await window.api.customers.getAll()
      setCustomers(data as Customer[])
    } catch {
      setError('Impossible de charger les clients')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll, dataVersion])

  const create = useCallback(async (data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>) => {
    await window.api.customers.create(data)
    await fetchAll()
  }, [fetchAll])

  const update = useCallback(async (id: string, data: Partial<Customer>) => {
    await window.api.customers.update(id, data)
    await fetchAll()
  }, [fetchAll])

  const remove = useCallback(async (id: string) => {
    await window.api.customers.delete(id)
    await fetchAll()
  }, [fetchAll])

  return { customers, loading, error, create, update, remove, refresh: fetchAll }
}

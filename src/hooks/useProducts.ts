import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/app.store'
import type { Product } from '@/types/domain'

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const dataVersion             = useAppStore((s) => s.dataVersion)

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await window.api.products.getAll()
      setProducts(data as Product[])
    } catch {
      setError('Impossible de charger les produits')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll, dataVersion])

  const create = useCallback(async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>) => {
    await window.api.products.create(data)
    await fetchAll()
  }, [fetchAll])

  const update = useCallback(async (id: string, data: Partial<Product>) => {
    await window.api.products.update(id, data)
    await fetchAll()
  }, [fetchAll])

  const remove = useCallback(async (id: string) => {
    await window.api.products.delete(id)
    await fetchAll()
  }, [fetchAll])

  return { products, loading, error, create, update, remove, refresh: fetchAll }
}

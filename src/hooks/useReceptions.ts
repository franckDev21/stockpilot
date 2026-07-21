import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/app.store'
import type { Reception } from '@/types/domain'

export function useReceptions() {
  const [receptions, setReceptions] = useState<Reception[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const dataVersion                 = useAppStore((s) => s.dataVersion)

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await window.api.receptions.getAll()
      setReceptions(data as Reception[])
    } catch {
      setError('Impossible de charger les réceptions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll, dataVersion])

  const create = useCallback(async (data: unknown) => {
    await window.api.receptions.create(data)
    await fetchAll()
  }, [fetchAll])

  return { receptions, loading, error, create, refresh: fetchAll }
}

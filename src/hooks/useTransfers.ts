import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/app.store'
import type { Transfer } from '@/types/domain'

export function useTransfers() {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const dataVersion               = useAppStore((s) => s.dataVersion)

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await window.api.transfers.getAll()
      setTransfers(data as Transfer[])
    } catch {
      setError('Impossible de charger les transferts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll, dataVersion])

  const create = useCallback(async (data: unknown) => {
    await window.api.transfers.create(data)
    await fetchAll()
  }, [fetchAll])

  return { transfers, loading, error, create, refresh: fetchAll }
}

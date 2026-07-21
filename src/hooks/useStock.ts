import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/app.store'
import type { StockEntry } from '@/types/domain'

export function useStock(warehouseId?: string) {
  const [entries, setEntries]   = useState<StockEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const dataVersion             = useAppStore((s) => s.dataVersion)

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await window.api.stock.getCurrent(warehouseId)
      setEntries(data as StockEntry[])
    } catch {
      setError('Impossible de charger le stock')
    } finally {
      setLoading(false)
    }
  }, [warehouseId])

  useEffect(() => { fetchAll() }, [fetchAll, dataVersion])

  return { entries, loading, error, refresh: fetchAll }
}

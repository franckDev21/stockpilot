import { useState, useMemo } from 'react'

export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage   = Math.min(page, totalPages)

  const slice = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  )

  const goTo  = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)))
  const reset = ()          => setPage(1)

  return { page: safePage, totalPages, slice, goTo, reset, total: items.length }
}

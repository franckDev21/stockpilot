import { useState, useCallback, createElement } from 'react'
import type { ReactElement } from 'react'

type Direction = 'asc' | 'desc'

export interface SortState<T extends string> {
  key: T
  dir: Direction
}

export function useSortable<T extends string>(defaultKey: T, defaultDir: Direction = 'asc') {
  const [sort, setSort] = useState<SortState<T>>({ key: defaultKey, dir: defaultDir })

  const toggle = useCallback((key: T) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    )
  }, [])

  const sortFn = useCallback(
    <Row>(rows: Row[], getValue: (row: Row, key: T) => string | number | null | undefined): Row[] => {
      return [...rows].sort((a, b) => {
        const av = getValue(a, sort.key) ?? ''
        const bv = getValue(b, sort.key) ?? ''
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'fr', { sensitivity: 'base' })
        return sort.dir === 'asc' ? cmp : -cmp
      })
    },
    [sort],
  )

  return { sort, toggle, sortFn }
}

export function SortIcon({ active, dir }: { active: boolean; dir: Direction }): ReactElement {
  if (!active) return createElement('span', { className: 'ml-1 text-slate-300 text-[10px]' }, '⇅')
  return createElement('span', { className: 'ml-1 text-primary-600 text-[10px]' }, dir === 'asc' ? '↑' : '↓')
}

import { useEffect } from 'react'
import { useAppStore } from '@/store/app.store'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrawerKey = string

interface Shortcut {
  key:     string
  meta:    boolean
  action:  DrawerKey
  section: string
}

const SHORTCUTS: Shortcut[] = [
  { key: 'p', meta: true, action: 'create-product',   section: 'stock'     },
  { key: 'v', meta: true, action: 'create-sale',       section: 'sales'     },
  { key: 'o', meta: true, action: 'create-order',      section: 'orders'    },
  { key: 'c', meta: true, action: 'create-customer',   section: 'customers' },
  { key: 'f', meta: true, action: 'create-supplier',   section: 'suppliers' },
  { key: 'r', meta: true, action: 'create-reception',  section: 'arrivals'  },
  { key: 't', meta: true, action: 'create-transfer',   section: 'arrivals'  },
]

export function useKeyboardShortcuts() {
  const { openDrawer } = useAppStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return

      const sc = SHORTCUTS.find((s) => s.key === e.key.toLowerCase())
      if (!sc) return

      // Don't intercept if user is typing in an input
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      e.preventDefault()

      // Scroll the target section into view
      const el = document.getElementById(sc.section)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })

      openDrawer(sc.action)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openDrawer])
}

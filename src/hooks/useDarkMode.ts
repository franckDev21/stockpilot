import { useState, useEffect, useCallback } from 'react'

const KEY = 'stockpilot-dark-mode'

function applyDark(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
}

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem(KEY)
    return saved !== null ? saved === 'true' : true
  })

  useEffect(() => {
    applyDark(dark)
    localStorage.setItem(KEY, String(dark))
  }, [dark])

  const toggle = useCallback(() => setDark((d) => !d), [])

  return { dark, toggle }
}

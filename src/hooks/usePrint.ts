import { useState, useCallback } from 'react'

export function usePrint() {
  const [printing, setPrinting] = useState(false)

  const print = useCallback(async (filename?: string) => {
    if (printing) return
    setPrinting(true)
    try {
      await window.api.print.toPDF({ filename })
    } catch (e) {
      console.error(e)
    } finally {
      setPrinting(false)
    }
  }, [printing])

  return { print, printing }
}

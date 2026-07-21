import { type ReactNode, useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface ModalProps {
  isOpen:      boolean
  onClose:     () => void
  title:       string
  children?:   ReactNode
  // Mode confirmation rapide
  message?:    string
  onConfirm?:  () => void
  confirmLabel?: string
  danger?:     boolean
}

export function Modal({ isOpen, onClose, title, children, message, onConfirm, confirmLabel = 'Confirmer', danger }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4',
          'transition-opacity duration-150',
          isOpen ? 'opacity-100 pointer-events-auto animate-fade-in' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      >
        {/* Panel */}
        <div
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {danger && (
                <div className="p-2 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
              )}
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          {message && <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}
          {children}

          {/* Confirmation actions */}
          {onConfirm && (
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
              <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={() => { onConfirm(); onClose() }}>
                {confirmLabel}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StatusStep {
  key:   string
  label: string
}

interface StatusBarProps {
  steps:   StatusStep[]
  current: string
  className?: string
}

export function StatusBar({ steps, current, className }: StatusBarProps) {
  const currentIndex = steps.findIndex((s) => s.key === current)

  return (
    <div className={cn('status-bar overflow-x-auto', className)}>
      {steps.map((step, i) => {
        const isDone   = i < currentIndex
        const isActive = i === currentIndex

        return (
          <div key={step.key} className="flex items-center">
            <div
              className={cn(
                'status-step',
                isActive && 'active',
                isDone   && 'done',
                !isActive && !isDone && 'future',
              )}
            >
              {isDone && (
                <Check className="w-3 h-3 shrink-0 text-emerald-500" />
              )}
              {step.label}
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="status-step-sep w-3.5 h-3.5 shrink-0 text-slate-200" />
            )}
          </div>
        )
      })}
    </div>
  )
}

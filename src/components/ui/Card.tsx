import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ className, children, id, ...props }: CardProps) {
  return (
    <div id={id} className={cn('card', className)} {...props}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title:     string
  subtitle?: string
  action?:   ReactNode
  className?: string
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700', className)}>
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  )
}

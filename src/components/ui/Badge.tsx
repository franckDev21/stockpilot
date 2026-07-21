import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Color = 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'purple' | 'indigo'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: Color
  dot?:   boolean
}

const colors: Record<Color, string> = {
  blue:   'bg-blue-50   dark:bg-blue-900/30   text-blue-700   dark:text-blue-400   ring-blue-200/60   dark:ring-blue-700/30',
  green:  'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-emerald-200/60 dark:ring-emerald-700/30',
  amber:  'bg-amber-50  dark:bg-amber-900/30  text-amber-700  dark:text-amber-400  ring-amber-200/60  dark:ring-amber-700/30',
  red:    'bg-red-50    dark:bg-red-900/30    text-red-700    dark:text-red-400    ring-red-200/60    dark:ring-red-700/30',
  slate:  'bg-slate-100 dark:bg-slate-700     text-slate-600  dark:text-slate-300  ring-slate-200/60  dark:ring-slate-600/30',
  purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 ring-purple-200/60 dark:ring-purple-700/30',
  indigo: 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 ring-primary-200/60 dark:ring-primary-700/30',
}

const dotColors: Record<Color, string> = {
  blue:   'bg-blue-500',
  green:  'bg-emerald-500',
  amber:  'bg-amber-500',
  red:    'bg-red-500',
  slate:  'bg-slate-400',
  purple: 'bg-purple-500',
  indigo: 'bg-primary-500',
}

export function Badge({ color = 'slate', dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ring-1',
        colors[color],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[color])} />}
      {children}
    </span>
  )
}

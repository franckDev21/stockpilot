import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useCountUp } from '@/lib/useCountUp'

interface StatCardProps {
  label:       string
  value:       string
  numericValue?: number
  icon:        ReactNode
  accentClass: string
  bgClass:     string
  change?:     number
  subtitle?:   string
  className?:  string
}

function AnimatedValue({ target, formatFn }: { target: number; formatFn: (n: number) => string }) {
  const animated = useCountUp(target)
  return <>{formatFn(animated)}</>
}

export function StatCard({
  label, value, numericValue, icon,
  accentClass, bgClass, change, subtitle, className,
}: StatCardProps) {
  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0

  return (
    <div className={cn(
      'card relative overflow-hidden p-5',
      'hover:-translate-y-0.5 hover:shadow-card-md transition-all duration-200',
      className,
    )}>
      {/* Gradient accent top line */}
      <div className={cn('absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r', accentClass)} />

      {/* Ghost icon watermark */}
      <div className={cn('absolute -right-3 -bottom-3 opacity-[0.06]', bgClass)}>
        <div className="w-20 h-20 [&>svg]:w-20 [&>svg]:h-20">{icon}</div>
      </div>

      <div className="flex items-start justify-between mb-4">
        {/* Icon */}
        <div className={cn('p-2.5 rounded-xl [&>svg]:w-5 [&>svg]:h-5', bgClass)}>
          {icon}
        </div>

        {/* Trend badge */}
        {change !== undefined && (
          <span className={cn(
            'inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg',
            isPositive && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
            isNegative && 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
            !isPositive && !isNegative && 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
          )}>
            {isPositive && <TrendingUp className="w-3 h-3" />}
            {isNegative && <TrendingDown className="w-3 h-3" />}
            {!isPositive && !isNegative && <Minus className="w-3 h-3" />}
            {change > 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>

      <div>
        <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums leading-none">
          {numericValue !== undefined
            ? <AnimatedValue target={numericValue} formatFn={() => value} />
            : value
          }
        </p>
        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-1.5 uppercase tracking-wider">{label}</p>
        {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

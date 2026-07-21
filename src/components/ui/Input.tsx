import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?:   string
  error?:   string
  prefix?:  ReactNode
  suffix?:  ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, prefix, suffix, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-slate-700">
          {label}
          {props.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-slate-400 text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full h-9 rounded-md border text-sm transition-colors duration-150',
            'bg-white text-slate-900 placeholder:text-slate-400',
            'border-slate-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
            prefix && 'pl-9',
            suffix && 'pr-9',
            !prefix && 'pl-3',
            !suffix && 'pr-3',
            error && 'border-red-400 focus:border-red-500 focus:ring-red-500/20',
            className,
          )}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-slate-400 text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  ),
)
Input.displayName = 'Input'

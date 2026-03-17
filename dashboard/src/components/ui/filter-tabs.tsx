'use client'

import { cn } from '@/lib/utils'

interface FilterOption {
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  count?: number
}

export function FilterTabs({
  options,
  value,
  onChange,
  className,
}: {
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {options.map((opt) => {
        const isActive = value === opt.key
        const Icon = opt.icon
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                : 'text-muted-foreground hover:bg-[oklch(0.225_0.008_260)] hover:text-foreground'
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {opt.label}
            {opt.count != null && (
              <span
                className={cn(
                  'ml-0.5 text-[11px]',
                  isActive ? 'text-primary-foreground/70' : 'text-muted-foreground/60'
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

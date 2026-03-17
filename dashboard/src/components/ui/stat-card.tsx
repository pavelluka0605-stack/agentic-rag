import { cn } from '@/lib/utils'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const trendConfig = {
  up: { icon: TrendingUp, color: 'text-green-500' },
  down: { icon: TrendingDown, color: 'text-red-500' },
  neutral: { icon: Minus, color: 'text-muted-foreground' },
} as const

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
}: {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}) {
  const TrendIcon = trend ? trendConfig[trend].icon : null
  const trendColor = trend ? trendConfig[trend].color : ''

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-6 shadow-sm hover:border-border-strong transition-colors duration-150',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-muted-foreground/70" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-bold tracking-tighter">{value}</p>
        {TrendIcon && (
          <TrendIcon className={cn('h-4 w-4', trendColor)} />
        )}
      </div>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

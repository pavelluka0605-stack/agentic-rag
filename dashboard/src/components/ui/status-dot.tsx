import { cn } from '@/lib/utils'

type Status = 'healthy' | 'degraded' | 'down' | 'unknown' | 'active' | 'fixed' | 'open'

const statusColors: Record<Status, string> = {
  healthy: 'bg-success',
  active: 'bg-success',
  fixed: 'bg-success',
  degraded: 'bg-warning',
  warning: 'bg-warning',
  open: 'bg-warning',
  down: 'bg-destructive',
  unknown: 'bg-muted-foreground',
} as Record<string, string> & Record<Status, string>

export function StatusDot({
  status,
  className,
}: {
  status: Status
  className?: string
}) {
  const color = statusColors[status] ?? 'bg-muted-foreground'
  const shouldPulse = status === 'active'
  const isGreen = ['healthy', 'active', 'fixed'].includes(status)

  return (
    <span className={cn('relative inline-flex h-2.5 w-2.5', className)}>
      {shouldPulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
            color
          )}
        />
      )}
      <span
        className={cn(
          'relative inline-flex h-2.5 w-2.5 rounded-full',
          color,
          isGreen && 'shadow-[0_0_6px_oklch(0.685_0.19_155/0.4)]'
        )}
      />
    </span>
  )
}

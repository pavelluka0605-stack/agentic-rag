import { cn } from '@/lib/utils'

type Status = 'healthy' | 'degraded' | 'down' | 'unknown' | 'active' | 'fixed' | 'open'

const statusColors: Record<Status, string> = {
  healthy: 'bg-green-500',
  active: 'bg-green-500',
  fixed: 'bg-green-500',
  degraded: 'bg-yellow-500',
  warning: 'bg-yellow-500',
  open: 'bg-yellow-500',
  down: 'bg-red-500',
  unknown: 'bg-gray-500',
} as Record<string, string> & Record<Status, string>

export function StatusDot({
  status,
  className,
}: {
  status: Status
  className?: string
}) {
  const color = statusColors[status] ?? 'bg-gray-500'
  const shouldPulse = status === 'active'

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
        className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', color)}
      />
    </span>
  )
}

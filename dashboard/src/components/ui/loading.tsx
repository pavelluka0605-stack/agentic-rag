import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const

const dotSizeMap = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-3 w-3',
} as const

const skeletonVariants = cva('shimmer rounded', {
  variants: {
    size: {
      sm: 'h-4',
      md: 'h-6',
      lg: 'h-8',
    },
  },
  defaultVariants: { size: 'md' },
})

export function Loading({
  variant = 'spinner',
  size = 'md',
  className,
}: {
  variant?: 'spinner' | 'skeleton' | 'dots'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  if (variant === 'skeleton') {
    return (
      <div className={cn('space-y-2', className)}>
        <div className={cn(skeletonVariants({ size }), 'w-3/4')} />
        <div className={cn(skeletonVariants({ size }), 'w-1/2')} />
        <div className={cn(skeletonVariants({ size }), 'w-5/6')} />
      </div>
    )
  }

  if (variant === 'dots') {
    const dotSize = dotSizeMap[size]
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              'animate-bounce rounded-full bg-primary/60',
              dotSize
            )}
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    )
  }

  return (
    <svg
      className={cn('animate-spin text-muted-foreground', sizeMap[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

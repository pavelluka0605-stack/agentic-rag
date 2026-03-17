'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ErrorBoundary]', error)
  }, [error])

  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

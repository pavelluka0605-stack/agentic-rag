'use client'

import { useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: 'sm' | 'md' | 'lg'
}

const widthClasses = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
}

export function DetailDrawer({ open, onClose, title, children, width = 'md' }: DetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (open) {
      // Save the currently focused element so we can restore it on close
      previousFocusRef.current = document.activeElement as HTMLElement | null
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
      // Move focus into the drawer panel
      requestAnimationFrame(() => {
        drawerRef.current?.focus()
      })
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      // Restore focus to the element that was focused before the drawer opened
      if (!open) return
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-label={title || 'Detail drawer'}
        className={cn(
          'absolute right-0 top-0 h-full w-full border-l border-border-subtle bg-bg-surface shadow-2xl shadow-black/30 animate-slide-in-right overflow-hidden flex flex-col focus:outline-none',
          widthClasses[width]
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-bg-overlay hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  )
}

// Quick-view drawer content for incidents
export function IncidentDrawerContent({ incident }: { incident: { id: number; fingerprint: string; error_message: string; status: string; probable_cause?: string | null; verified_fix?: string | null; service?: string | null; project?: string | null; occurrence_count: number; created_at: string; updated_at: string } }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <StatusPill status={incident.status} />
        <code className="text-xs text-muted-foreground font-mono">{incident.fingerprint.slice(0, 12)}</code>
      </div>

      <div>
        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Error</label>
        <pre className="mt-1 whitespace-pre-wrap rounded-md bg-bg-inset p-3 font-mono text-xs">{incident.error_message}</pre>
      </div>

      {incident.probable_cause && (
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Probable Cause</label>
          <p className="mt-1 text-sm text-muted-foreground">{incident.probable_cause}</p>
        </div>
      )}

      {incident.verified_fix && (
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wider text-success/80">Verified Fix</label>
          <pre className="mt-1 whitespace-pre-wrap rounded-md bg-success/5 border border-success/20 p-3 font-mono text-xs text-success">{incident.verified_fix}</pre>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        {incident.project && (
          <div>
            <span className="text-[11px] text-muted-foreground/60">Project</span>
            <p className="font-medium">{incident.project}</p>
          </div>
        )}
        {incident.service && (
          <div>
            <span className="text-[11px] text-muted-foreground/60">Service</span>
            <p className="font-medium">{incident.service}</p>
          </div>
        )}
        <div>
          <span className="text-[11px] text-muted-foreground/60">Occurrences</span>
          <p className="font-medium">{incident.occurrence_count}</p>
        </div>
      </div>
    </div>
  )
}

// Quick-view drawer content for solutions
export function SolutionDrawerContent({ solution }: { solution: { id: number; title: string; description: string; pattern_type: string; verified: number; code?: string | null; usefulness_score: number; use_count: number; project?: string | null } }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={cn(
          'inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
          solution.verified
            ? 'bg-success/10 text-success ring-success/20'
            : 'bg-secondary text-secondary-foreground ring-border'
        )}>
          {solution.verified ? 'Verified' : 'Unverified'}
        </span>
        <span className="inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset text-foreground ring-border">
          {solution.pattern_type}
        </span>
      </div>

      <div>
        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Description</label>
        <p className="mt-1 text-sm text-muted-foreground">{solution.description}</p>
      </div>

      {solution.code && (
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Code</label>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-bg-inset p-3 font-mono text-xs">{solution.code}</pre>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-[11px] text-muted-foreground/60">Score</span>
          <p className="font-medium">{solution.usefulness_score}</p>
        </div>
        <div>
          <span className="text-[11px] text-muted-foreground/60">Used</span>
          <p className="font-medium">{solution.use_count}x</p>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'bg-destructive/10 text-destructive ring-destructive/20',
    investigating: 'bg-warning/10 text-warning ring-warning/20',
    fixed: 'bg-success/10 text-success ring-success/20',
    wontfix: 'bg-secondary text-secondary-foreground ring-border',
    duplicate: 'bg-secondary text-secondary-foreground ring-border',
  }
  return (
    <span className={cn('inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', colors[status] || colors.wontfix)}>
      {status}
    </span>
  )
}

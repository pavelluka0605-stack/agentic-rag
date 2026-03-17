'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusDot } from '@/components/ui/status-dot'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { cn, timeAgo, truncate } from '@/lib/utils'
import type { Incident } from '@/types'

const STATUS_FILTERS = ['all', 'open', 'investigating', 'fixed', 'wontfix'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const statusLabels: Record<StatusFilter, string> = {
  all: 'All',
  open: 'Open',
  investigating: 'Investigating',
  fixed: 'Fixed',
  wontfix: "Won't Fix",
}

function statusToDot(status: Incident['status']): string {
  switch (status) {
    case 'fixed':
      return 'fixed'
    case 'open':
      return 'down'
    case 'investigating':
      return 'degraded'
    case 'wontfix':
    case 'duplicate':
      return 'unknown'
    default:
      return 'unknown'
  }
}

function statusBadgeVariant(status: Incident['status']) {
  switch (status) {
    case 'fixed':
      return 'success' as const
    case 'open':
      return 'destructive' as const
    case 'investigating':
      return 'warning' as const
    default:
      return 'secondary' as const
  }
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ limit: '50' })
    if (filter !== 'all') {
      params.set('status', filter)
    }

    fetch(`/api/incidents?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => setIncidents(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [filter])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Incidents</h1>
        {!loading && !error && (
          <Badge variant="secondary">{incidents.length}</Badge>
        )}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <Button
            key={s}
            variant={filter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {statusLabels[s]}
          </Button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loading size="lg" />
        </div>
      )}

      {error && (
        <Card className="p-6">
          <p className="text-sm text-destructive">
            Failed to load incidents: {error}
          </p>
        </Card>
      )}

      {!loading && !error && incidents.length === 0 && (
        <EmptyState
          icon={AlertTriangle}
          title="No incidents found"
          description={
            filter !== 'all'
              ? `No incidents with status "${statusLabels[filter]}".`
              : 'No incidents have been recorded yet.'
          }
        />
      )}

      {!loading && !error && incidents.length > 0 && (
        <Card>
          <div className="divide-y divide-border">
            {incidents.map((incident) => (
              <Link
                key={incident.id}
                href={`/incidents/${incident.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <StatusDot status={statusToDot(incident.status) as any} />

                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {incident.fingerprint.slice(0, 8)}
                </span>

                <span className="min-w-0 flex-1 truncate text-sm">
                  {truncate(incident.error_message, 80)}
                </span>

                <div className="flex shrink-0 items-center gap-2">
                  {incident.project && (
                    <Badge variant="outline">{incident.project}</Badge>
                  )}
                  {incident.service && (
                    <Badge variant="secondary">{incident.service}</Badge>
                  )}

                  {incident.occurrence_count > 1 && (
                    <span className="text-xs text-muted-foreground">
                      x{incident.occurrence_count}
                    </span>
                  )}

                  <span className="w-16 text-right text-xs text-muted-foreground">
                    {timeAgo(incident.created_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

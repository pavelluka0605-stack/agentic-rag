'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusDot } from '@/components/ui/status-dot'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { DetailDrawer, IncidentDrawerContent } from '@/components/ui/detail-drawer'
import { Button } from '@/components/ui/button'
import { timeAgo, truncate } from '@/lib/utils'
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
    case 'fixed': return 'fixed'
    case 'open': return 'down'
    case 'investigating': return 'degraded'
    default: return 'unknown'
  }
}

export default function IncidentsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loading size="lg" /></div>}>
      <IncidentsPageInner />
    </Suspense>
  )
}

function IncidentsPageInner() {
  const searchParams = useSearchParams()
  const projectParam = searchParams.get('project')
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerIncident, setDrawerIncident] = useState<Incident | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ limit: '50' })
    if (filter !== 'all') {
      params.set('status', filter)
    }
    if (projectParam) {
      params.set('project', projectParam)
    }

    fetch(`/api/incidents?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => setIncidents(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [filter, projectParam])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        badge={
          <div className="flex items-center gap-2">
            {projectParam && (
              <Badge variant="outline">
                {projectParam}
                <Link href="/incidents" className="ml-1 hover:text-foreground">&times;</Link>
              </Badge>
            )}
            {!loading && !error && <Badge variant="secondary">{incidents.length}</Badge>}
          </div>
        }
      />

      <FilterTabs
        options={STATUS_FILTERS.map(s => ({ key: s, label: statusLabels[s] }))}
        value={filter}
        onChange={(v) => setFilter(v as StatusFilter)}
      />

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
        <Card className="animate-fade-in">
          <div className="divide-y divide-border">
            {incidents.map((incident) => (
              <div
                key={incident.id}
                className="flex items-center gap-4 px-4 py-3 overflow-hidden transition-colors hover:bg-[oklch(0.195_0.008_260)] cursor-pointer group"
                onClick={(e) => {
                  // Only open drawer if not clicking a link
                  if (!(e.target as HTMLElement).closest('a')) {
                    setDrawerIncident(incident)
                  }
                }}
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

                  <Link
                    href={`/incidents/${incident.id}`}
                    className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-bg-overlay"
                    title="Open full detail"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!drawerIncident}
        onClose={() => setDrawerIncident(null)}
        title={drawerIncident ? `Incident #${drawerIncident.id}` : undefined}
        width="md"
      >
        {drawerIncident && (
          <div className="space-y-4">
            <IncidentDrawerContent incident={drawerIncident} />
            <div className="pt-2 border-t border-border-subtle">
              <Link href={`/incidents/${drawerIncident.id}`}>
                <Button variant="outline" size="sm" className="w-full">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Full Detail
                </Button>
              </Link>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  )
}

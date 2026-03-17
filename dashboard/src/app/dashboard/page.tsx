'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Lightbulb,
  History,
  GitBranch,
  Search,
  ShieldCheck,
  Inbox,
  Activity,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusDot } from '@/components/ui/status-dot'
import { timeAgo, truncate } from '@/lib/utils'
import type { MemoryStats, Episode, Incident, GithubEvent } from '@/types'

const eventVariant = (type: string) => {
  if (type.includes('pull_request')) return 'success' as const
  if (type.includes('push')) return 'default' as const
  if (type.includes('issues')) return 'warning' as const
  if (type.includes('workflow')) return 'secondary' as const
  return 'outline' as const
}

export default function DashboardPage() {
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [episodes, setEpisodes] = useState<Episode[] | null>(null)
  const [incidents, setIncidents] = useState<Incident[] | null>(null)
  const [events, setEvents] = useState<GithubEvent[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, episodesRes, incidentsRes, eventsRes] =
          await Promise.allSettled([
            fetch('/api/memory/stats'),
            fetch('/api/sessions?limit=5'),
            fetch('/api/incidents?status=open&limit=5'),
            fetch('/api/github/events?limit=10'),
          ])

        if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
          setStats(await statsRes.value.json())
        }
        if (episodesRes.status === 'fulfilled' && episodesRes.value.ok) {
          setEpisodes(await episodesRes.value.json())
        }
        if (incidentsRes.status === 'fulfilled' && incidentsRes.value.ok) {
          setIncidents(await incidentsRes.value.json())
        }
        if (eventsRes.status === 'fulfilled' && eventsRes.value.ok) {
          setEvents(await eventsRes.value.json())
        }
      } catch {
        // silently handle network errors
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loading size="lg" />
      </div>
    )
  }

  const openIncidents = stats?.open_incidents ?? 0
  const verifiedSolutions = stats?.verified_solutions ?? 0
  const totalEpisodes = stats?.episodes ?? 0
  const totalGithubEvents = stats?.github_events ?? 0

  return (
    <div className="space-y-8">
      {/* Page header */}
      <PageHeader
        title="Dashboard"
        description="Memory system overview and recent activity"
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
        <StatCard
          title="Open Incidents"
          value={openIncidents}
          icon={AlertTriangle}
          className={
            openIncidents > 0
              ? 'border-destructive/50 bg-destructive/5'
              : undefined
          }
          description={
            openIncidents > 0 ? 'Requires attention' : 'All clear'
          }
        />
        <StatCard
          title="Verified Solutions"
          value={verifiedSolutions}
          icon={Lightbulb}
          className="border-success/50 bg-success/5"
          description="Proven fixes"
        />
        <StatCard
          title="Recent Sessions"
          value={totalEpisodes}
          icon={History}
          description="Total episodes"
        />
        <StatCard
          title="GitHub Events"
          value={totalGithubEvents}
          icon={GitBranch}
          description="Tracked events"
        />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-border-subtle bg-card p-3">
        <Link href="/memory">
          <Button variant="outline" size="sm">
            <Search className="h-4 w-4" />
            Search Memory
          </Button>
        </Link>
        <Link href="/incidents">
          <Button variant="outline" size="sm">
            <AlertTriangle className="h-4 w-4" />
            View Incidents
          </Button>
        </Link>
        <Link href="/health">
          <Button variant="outline" size="sm">
            <ShieldCheck className="h-4 w-4" />
            System Health
          </Button>
        </Link>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Sessions */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-muted-foreground" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!episodes || episodes.length === 0 ? (
              <EmptyState
                icon={History}
                title="No sessions yet"
                description="Sessions will appear here as you work"
              />
            ) : (
              <div className="space-y-4">
                {episodes.map((ep) => (
                  <div
                    key={ep.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle p-3 transition-colors hover:bg-[oklch(0.195_0.008_260)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">
                        {truncate(ep.summary, 120)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(ep.created_at)}
                        </span>
                        {ep.project && (
                          <Badge variant="secondary">{ep.project}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open Incidents */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Open Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!incidents || incidents.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="No open incidents"
                description="All clear — no unresolved incidents"
              />
            ) : (
              <div className="space-y-4">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle p-3 transition-colors hover:bg-[oklch(0.195_0.008_260)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <StatusDot status={inc.status as 'open'} />
                        <p className="text-sm font-medium leading-snug">
                          {truncate(inc.error_message, 100)}
                        </p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(inc.created_at)}
                        </span>
                        <Badge
                          variant={
                            inc.status === 'open'
                              ? 'destructive'
                              : 'warning'
                          }
                        >
                          {inc.status}
                        </Badge>
                        {inc.occurrence_count > 1 && (
                          <span className="text-xs text-muted-foreground">
                            x{inc.occurrence_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full-width GitHub Activity */}
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Recent GitHub Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!events || events.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No GitHub events"
              description="Events will appear when the webhook receives activity"
            />
          ) : (
            <div className="space-y-3">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-4 rounded-lg border border-border-subtle px-4 py-3 transition-colors hover:bg-[oklch(0.195_0.008_260)]"
                >
                  <Badge variant={eventVariant(ev.event_type)}>
                    {ev.event_type}
                    {ev.action ? `:${ev.action}` : ''}
                  </Badge>
                  <span className="shrink-0 text-sm font-medium text-foreground">
                    {ev.repo}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {ev.payload_summary
                      ? truncate(ev.payload_summary, 80)
                      : '—'}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {timeAgo(ev.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

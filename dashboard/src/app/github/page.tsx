'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Activity, Inbox, GitBranch, Link as LinkIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { timeAgo } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { FilterTabs } from '@/components/ui/filter-tabs'
import type { GithubEvent } from '@/types'

const EVENT_TYPES = ['All', 'push', 'pull_request', 'issues', 'workflow_run'] as const

const eventVariant = (type: string) => {
  if (type.includes('push')) return 'default' as const
  if (type.includes('pull_request')) return 'success' as const
  if (type.includes('issues')) return 'warning' as const
  if (type.includes('workflow')) return 'secondary' as const
  return 'outline' as const
}

function linkedMemoryHref(type: string, id: number): string {
  if (type === 'incident') return `/incidents/${id}`
  if (type === 'solution') return `/solutions/${id}`
  return '#'
}

export default function GitHubPage() {
  const [events, setEvents] = useState<GithubEvent[] | null>(null)
  const [filter, setFilter] = useState<string>('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async (eventType: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (eventType !== 'All') {
        params.set('event_type', eventType)
      }
      const res = await fetch(`/api/github/events?${params}`)
      if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`)
      setEvents(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents(filter)
  }, [filter, fetchEvents])

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="GitHub Activity"
        description="Webhook events from GitHub repositories"
      />

      {/* Filter row */}
      <FilterTabs
        options={EVENT_TYPES.map(t => ({ key: t, label: t, icon: t === 'All' ? Activity : undefined }))}
        value={filter}
        onChange={setFilter}
      />

      {/* Content */}
      {loading ? (
        <div className="flex h-[40vh] items-center justify-center">
          <Loading size="lg" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : !events || events.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No events found"
          description={
            filter !== 'All'
              ? `No ${filter} events recorded yet`
              : 'Events will appear when the webhook receives activity'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border animate-fade-in">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-border bg-[oklch(0.175_0.008_260)]">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Repository</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ref</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Summary</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Linked</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">When</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-b border-border-subtle transition-colors hover:bg-[oklch(0.195_0.008_260)]"
                >
                  <td className="px-4 py-3">
                    <Badge variant={eventVariant(ev.event_type)}>
                      {ev.event_type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ev.action ?? '\u2014'}
                  </td>
                  <td className="px-4 py-3 font-medium">{ev.repo}</td>
                  <td className="px-4 py-3">
                    {ev.ref ? (
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {ev.ref}
                      </code>
                    ) : (
                      <span className="text-muted-foreground">{'\u2014'}</span>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <span className="line-clamp-2 text-muted-foreground">
                      {ev.payload_summary ?? '\u2014'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {ev.linked_memory_type && ev.linked_memory_id != null ? (
                      <Link
                        href={linkedMemoryHref(ev.linked_memory_type, ev.linked_memory_id)}
                        className="inline-flex items-center gap-1"
                      >
                        <Badge variant="outline">
                          <LinkIcon className="mr-1 h-3 w-3" />
                          {ev.linked_memory_type} #{ev.linked_memory_id}
                        </Badge>
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{'\u2014'}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-muted-foreground">
                    {timeAgo(ev.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

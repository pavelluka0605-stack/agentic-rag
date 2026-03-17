'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { History, GitBranch, FileText, CircleDot } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { timeAgo, truncate, parseJsonField } from '@/lib/utils'
import type { Episode } from '@/types'

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Episode[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch('/api/sessions?limit=30')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setSessions(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sessions')
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loading size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sessions"
        description="Development session history and open loops"
      />

      {error && (
        <Card className="p-6">
          <p className="text-sm text-destructive">
            Failed to load sessions: {error}
          </p>
        </Card>
      )}

      {!error && (!sessions || sessions.length === 0) && (
        <EmptyState
          icon={History}
          title="No sessions yet"
          description="Sessions will appear here as you work"
        />
      )}

      {sessions && sessions.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          {sessions.map((ep) => {
            const openLoops = parseJsonField<string[]>(ep.open_loops)
            const filesChanged = parseJsonField<string[]>(ep.files_changed)

            return (
              <Link key={ep.id} href={`/sessions/${ep.id}`}>
                <Card className="transition-colors hover:bg-[oklch(0.195_0.008_260)] cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug">
                          {ep.summary}
                        </p>

                        {ep.what_done && (
                          <p className="mt-1.5 text-sm text-muted-foreground">
                            {truncate(ep.what_done, 150)}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {ep.project && (
                            <Badge variant="secondary">{ep.project}</Badge>
                          )}
                          {ep.branch && (
                            <Badge variant="outline" className="font-mono text-xs">
                              <GitBranch className="mr-1 h-3 w-3" />
                              {ep.branch}
                            </Badge>
                          )}
                          {openLoops && openLoops.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-warning">
                              <CircleDot className="h-3 w-3 fill-warning text-warning" />
                              {openLoops.length} open loop{openLoops.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {filesChanged && filesChanged.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              {filesChanged.length} file{filesChanged.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="shrink-0 text-xs text-muted-foreground">
                        {timeAgo(ep.created_at)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, GitBranch, CircleDot, FileText, History } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate, parseJsonField } from '@/lib/utils'
import type { Episode } from '@/types'

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<Episode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/sessions/${id}`)
        if (res.ok) {
          setSession(await res.json())
        } else {
          setError(true)
        }
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchSession()
  }, [id])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loading size="lg" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="space-y-4">
        <Link href="/sessions">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Sessions
          </Button>
        </Link>
        <EmptyState
          icon={History}
          title="Session not found"
          description="This session may have been deleted or does not exist"
        />
      </div>
    )
  }

  const openLoops = parseJsonField<string[]>(session.open_loops)
  const filesChanged = parseJsonField<string[]>(session.files_changed)

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/sessions">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Sessions
        </Button>
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{session.summary}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {session.project && (
            <Badge variant="secondary">{session.project}</Badge>
          )}
          {session.branch && (
            <Badge variant="outline" className="font-mono text-xs">
              <GitBranch className="mr-1 h-3 w-3" />
              {session.branch}
            </Badge>
          )}
        </div>
      </div>

      {/* What was done */}
      {session.what_done && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What was done</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {session.what_done}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Where stopped */}
      {session.where_stopped && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where stopped</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {session.where_stopped}
            </p>
          </CardContent>
        </Card>
      )}

      {/* What remains */}
      {session.what_remains && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What remains</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {session.what_remains}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Open Loops */}
      {openLoops && openLoops.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleDot className="h-4 w-4 text-warning" />
              Open Loops
              <Badge variant="warning">{openLoops.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {openLoops.map((loop, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-warning" />
                  <span>{loop}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Files Changed */}
      {filesChanged && filesChanged.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Files Changed
              <Badge variant="secondary">{filesChanged.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {filesChanged.map((file, i) => (
                <li
                  key={i}
                  className="rounded px-2 py-1 font-mono text-xs text-foreground bg-muted/50"
                >
                  {file}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {session.project && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Project</dt>
                <dd className="mt-0.5 text-sm">{session.project}</dd>
              </div>
            )}
            {session.branch && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Branch</dt>
                <dd className="mt-0.5 font-mono text-sm">{session.branch}</dd>
              </div>
            )}
            {session.session_id && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Session ID</dt>
                <dd className="mt-0.5 font-mono text-sm">{session.session_id}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Created</dt>
              <dd className="mt-0.5 text-sm">{formatDate(session.created_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}

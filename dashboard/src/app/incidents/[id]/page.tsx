'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusDot } from '@/components/ui/status-dot'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { cn, formatDate, timeAgo, parseJsonField, truncate } from '@/lib/utils'
import type { Incident } from '@/types'

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

function Section({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 p-6 pb-3 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
      </button>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  )
}

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!params.id) return

    setLoading(true)
    setError(null)

    fetch(`/api/incidents/${params.id}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error('Incident not found')
          throw new Error(`HTTP ${res.status}`)
        }
        return res.json()
      })
      .then((data) => setIncident(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loading size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/incidents">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Incidents
          </Button>
        </Link>
        <EmptyState
          icon={AlertTriangle}
          title="Error loading incident"
          description={error}
        />
      </div>
    )
  }

  if (!incident) return null

  const failedAttempts = parseJsonField<string[]>(incident.failed_attempts)

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/incidents">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Incidents
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <StatusDot status={statusToDot(incident.status) as any} />
        <Badge variant={statusBadgeVariant(incident.status)}>
          {incident.status}
        </Badge>
        <span className="font-mono text-sm text-muted-foreground">
          {incident.fingerprint}
        </span>
      </div>

      {/* Error message */}
      <Section title="Error">
        <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 font-mono text-sm">
          {incident.error_message}
        </pre>
      </Section>

      {/* Stack trace */}
      {incident.stack_trace && (
        <CollapsibleSection title="Stack Trace">
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 font-mono text-xs">
            {incident.stack_trace}
          </pre>
        </CollapsibleSection>
      )}

      {/* Context */}
      {incident.context && (
        <Section title="Context">
          <p className="text-sm">{incident.context}</p>
        </Section>
      )}

      {/* Failed command */}
      {incident.failed_command && (
        <Section title="Failed Command">
          <code className="block rounded-md bg-muted p-3 font-mono text-sm">
            {incident.failed_command}
          </code>
        </Section>
      )}

      {/* Probable cause */}
      {incident.probable_cause && (
        <Section title="Probable Cause">
          <p className="text-sm">{incident.probable_cause}</p>
        </Section>
      )}

      {/* Verified fix */}
      {incident.verified_fix && (
        <Section
          title="Verified Fix"
          className="border-success/30 bg-success/5"
        >
          <pre className="whitespace-pre-wrap rounded-md bg-success/10 p-4 font-mono text-sm text-success">
            {incident.verified_fix}
          </pre>
        </Section>
      )}

      {/* Failed attempts */}
      {failedAttempts && failedAttempts.length > 0 && (
        <CollapsibleSection title="Failed Attempts">
          <ul className="space-y-2">
            {failedAttempts.map((attempt, i) => (
              <li
                key={i}
                className="rounded-md bg-muted p-3 font-mono text-xs"
              >
                {typeof attempt === 'string' ? attempt : JSON.stringify(attempt)}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* Metadata */}
      <Section title="Metadata">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          {incident.project && (
            <>
              <dt className="text-muted-foreground">Project</dt>
              <dd className="col-span-1 sm:col-span-2">
                <Badge variant="outline">{incident.project}</Badge>
              </dd>
            </>
          )}
          {incident.service && (
            <>
              <dt className="text-muted-foreground">Service</dt>
              <dd className="col-span-1 sm:col-span-2">
                <Badge variant="secondary">{incident.service}</Badge>
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">Occurrences</dt>
          <dd className="col-span-1 sm:col-span-2">
            {incident.occurrence_count}
          </dd>
          <dt className="text-muted-foreground">Created</dt>
          <dd className="col-span-1 sm:col-span-2">
            {formatDate(incident.created_at)}
          </dd>
          <dt className="text-muted-foreground">Updated</dt>
          <dd className="col-span-1 sm:col-span-2">
            {formatDate(incident.updated_at)}
          </dd>
          {incident.fix_verified_at && (
            <>
              <dt className="text-muted-foreground">Fix verified</dt>
              <dd className="col-span-1 sm:col-span-2">
                {formatDate(incident.fix_verified_at)}
              </dd>
            </>
          )}
        </dl>
      </Section>

      {/* Links */}
      {(incident.github_issue || incident.github_pr) && (
        <Section title="Links">
          <div className="flex flex-wrap gap-3">
            {incident.github_issue && (
              <a
                href={incident.github_issue}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                GitHub Issue
              </a>
            )}
            {incident.github_pr && (
              <a
                href={incident.github_pr}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                GitHub PR
              </a>
            )}
          </div>
        </Section>
      )}
    </div>
  )
}

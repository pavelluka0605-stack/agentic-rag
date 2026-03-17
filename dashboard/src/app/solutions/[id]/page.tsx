'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lightbulb, ExternalLink } from 'lucide-react'
import type { Solution } from '@/types'
import { formatDate, parseJsonField } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'

export default function SolutionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [solution, setSolution] = useState<Solution | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`/api/solutions/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      })
      .then((data) => setSolution(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loading size="lg" />
      </div>
    )
  }

  if (error || !solution) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="Solution not found"
        description="The solution you are looking for does not exist."
        action={
          <Link href="/solutions">
            <Button variant="outline" size="sm">Back to Solutions</Button>
          </Link>
        }
      />
    )
  }

  const tags = parseJsonField<string[]>(solution.tags) ?? []
  const commands = parseJsonField<string[]>(solution.commands)

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/solutions"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Solutions
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{solution.title}</h1>
        {solution.verified ? (
          <Badge variant="success">Verified</Badge>
        ) : (
          <Badge variant="secondary">Unverified</Badge>
        )}
        <Badge variant="outline">{solution.pattern_type}</Badge>
      </div>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {solution.description}
          </p>
        </CardContent>
      </Card>

      {/* Code */}
      {solution.code && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Code</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
              <code>{solution.code}</code>
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Commands */}
      {commands && commands.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commands</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {commands.map((cmd, i) => (
              <div
                key={i}
                className="rounded-md bg-muted px-3 py-2 font-mono text-sm"
              >
                {cmd}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            {solution.project && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Project</dt>
                <dd className="text-sm">{solution.project}</dd>
              </div>
            )}
            {solution.service && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Service</dt>
                <dd className="text-sm">{solution.service}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Usefulness Score</dt>
              <dd className="text-sm">{solution.usefulness_score}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Use Count</dt>
              <dd className="text-sm">{solution.use_count}</dd>
            </div>
            {solution.verified_at && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Verified At</dt>
                <dd className="text-sm">{formatDate(solution.verified_at)}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Created</dt>
              <dd className="text-sm">{formatDate(solution.created_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Tags */}
      {tags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links */}
      {(solution.github_pr || solution.solves_incident) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {solution.github_pr && (
              <a
                href={solution.github_pr}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                GitHub PR
              </a>
            )}
            {solution.solves_incident && (
              <div>
                <Link
                  href={`/incidents/${solution.solves_incident}`}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Solves Incident #{solution.solves_incident}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

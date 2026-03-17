'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Lightbulb } from 'lucide-react'
import type { Solution } from '@/types'
import { timeAgo, truncate, parseJsonField } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'

const PATTERN_TYPES = ['All', 'workflow', 'command', 'pattern', 'playbook', 'snippet', 'config'] as const

function patternBadgeVariant(type: string): 'default' | 'secondary' | 'warning' | 'outline' {
  switch (type) {
    case 'workflow': return 'default'
    case 'command': return 'secondary'
    case 'playbook': return 'warning'
    default: return 'outline'
  }
}

export default function SolutionsPage() {
  const [solutions, setSolutions] = useState<Solution[]>([])
  const [loading, setLoading] = useState(true)
  const [patternType, setPatternType] = useState<string>('All')
  const [verifiedOnly, setVerifiedOnly] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '50' })
    if (verifiedOnly) params.set('verified', 'true')
    if (patternType !== 'All') params.set('pattern_type', patternType)

    fetch(`/api/solutions?${params}`)
      .then((r) => r.json())
      .then((data) => setSolutions(Array.isArray(data) ? data : []))
      .catch(() => setSolutions([]))
      .finally(() => setLoading(false))
  }, [patternType, verifiedOnly])

  const verifiedCount = solutions.filter((s) => s.verified).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Solutions</h1>
        <Badge variant="success">{verifiedCount} verified</Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {PATTERN_TYPES.map((type) => (
          <Button
            key={type}
            variant={patternType === type ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPatternType(type)}
          >
            {type === 'All' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
          </Button>
        ))}
        <div className="ml-auto">
          <Button
            variant={verifiedOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setVerifiedOnly((v) => !v)}
          >
            Verified only
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loading size="lg" />
        </div>
      ) : solutions.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No solutions found"
          description="Try adjusting your filters or add new solutions."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {solutions.map((solution) => {
            const tags = parseJsonField<string[]>(solution.tags) ?? []
            return (
              <Link key={solution.id} href={`/solutions/${solution.id}`}>
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{solution.title}</CardTitle>
                      {solution.verified ? (
                        <Badge variant="success" className="shrink-0">Verified</Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">Unverified</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {truncate(solution.description, 120)}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={patternBadgeVariant(solution.pattern_type)}>
                        {solution.pattern_type}
                      </Badge>

                      {solution.project && (
                        <Badge variant="outline">{solution.project}</Badge>
                      )}

                      {solution.usefulness_score > 0 && (
                        <Badge variant="warning">
                          score: {solution.usefulness_score}
                        </Badge>
                      )}

                      {solution.use_count > 0 && (
                        <Badge variant="secondary">
                          used {solution.use_count}x
                        </Badge>
                      )}
                    </div>

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {timeAgo(solution.created_at)}
                    </p>
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

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Lightbulb, ExternalLink } from 'lucide-react'
import type { Solution } from '@/types'
import { timeAgo, truncate, parseJsonField } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { DetailDrawer, SolutionDrawerContent } from '@/components/ui/detail-drawer'

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
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loading size="lg" /></div>}>
      <SolutionsPageInner />
    </Suspense>
  )
}

function SolutionsPageInner() {
  const searchParams = useSearchParams()
  const projectParam = searchParams.get('project')
  const [solutions, setSolutions] = useState<Solution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [patternType, setPatternType] = useState<string>('All')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [drawerSolution, setDrawerSolution] = useState<Solution | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ limit: '50' })
    if (verifiedOnly) params.set('verified', 'true')
    if (patternType !== 'All') params.set('pattern_type', patternType)
    if (projectParam) params.set('project', projectParam)

    fetch(`/api/solutions?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => setSolutions(Array.isArray(data) ? data : []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load solutions'))
      .finally(() => setLoading(false))
  }, [patternType, verifiedOnly, projectParam])

  const verifiedCount = solutions.filter((s) => s.verified).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solutions"
        badge={
          <div className="flex items-center gap-2">
            {projectParam && (
              <Badge variant="outline">
                {projectParam}
                <Link href="/solutions" className="ml-1 hover:text-foreground">&times;</Link>
              </Badge>
            )}
            <Badge variant="success">{verifiedCount} verified</Badge>
          </div>
        }
      />

      <div className="flex items-center gap-3">
        <FilterTabs
          options={PATTERN_TYPES.map(t => ({ key: t, label: t === 'All' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1) }))}
          value={patternType}
          onChange={setPatternType}
        />
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

      {error && (
        <Card className="p-6">
          <p className="text-sm text-destructive">
            Failed to load solutions: {error}
          </p>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loading size="lg" />
        </div>
      ) : !error && solutions.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No solutions found"
          description="Try adjusting your filters or add new solutions."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 animate-fade-in">
          {solutions.map((solution) => {
            const tags = parseJsonField<string[]>(solution.tags) ?? []
            return (
              <Card
                key={solution.id}
                className="h-full transition-colors hover:border-primary/30 hover:shadow-sm hover:shadow-primary/5 cursor-pointer"
                onClick={() => setDrawerSolution(solution)}
              >
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
            )
          })}
        </div>
      )}

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!drawerSolution}
        onClose={() => setDrawerSolution(null)}
        title={drawerSolution?.title}
        width="md"
      >
        {drawerSolution && (
          <div className="space-y-4">
            <SolutionDrawerContent solution={drawerSolution} />
            <div className="pt-2 border-t border-border-subtle">
              <Link href={`/solutions/${drawerSolution.id}`}>
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

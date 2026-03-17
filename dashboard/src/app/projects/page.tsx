'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  FolderKanban,
  AlertTriangle,
  Lightbulb,
  History,
  BookOpen,
  Shield,
  Database,
  ArrowRight,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

interface ProjectInfo {
  project: string
  counts: Record<string, number>
}

const layerConfig: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; color: string; href: string }[] = [
  { key: 'episodes', label: 'Sessions', icon: History, color: 'text-primary', href: '/sessions' },
  { key: 'incidents', label: 'Incidents', icon: AlertTriangle, color: 'text-destructive', href: '/incidents' },
  { key: 'solutions', label: 'Solutions', icon: Lightbulb, color: 'text-success', href: '/solutions' },
  { key: 'decisions', label: 'Decisions', icon: BookOpen, color: 'text-warning', href: '/memory' },
  { key: 'policies', label: 'Policies', icon: Shield, color: 'text-muted-foreground', href: '/memory' },
  { key: 'contexts', label: 'Contexts', icon: Database, color: 'text-info', href: '/memory' },
]

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectInfo[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loading size="lg" />
      </div>
    )
  }

  const totalItems = projects?.reduce((sum, p) => {
    return sum + Object.values(p.counts).reduce((s, c) => s + c, 0)
  }, 0) ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="All projects with memory layer breakdown"
        badge={projects && projects.length > 0 ? <Badge variant="secondary">{projects.length} projects</Badge> : undefined}
      />

      {!projects || projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description="Projects will appear when memory entries reference a project"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 animate-fade-in">
          {projects.map((project) => {
            const total = Object.values(project.counts).reduce((s, c) => s + c, 0)
            return (
              <Card key={project.project} className="transition-colors hover:border-primary/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FolderKanban className="h-4 w-4 text-primary" />
                      {project.project}
                    </CardTitle>
                    <Badge variant="outline">{total} items</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {layerConfig.map(({ key, label, icon: Icon, color }) => {
                      const count = project.counts[key] || 0
                      if (count === 0) return null
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-2 rounded-md bg-bg-inset px-2.5 py-2"
                        >
                          <Icon className={cn('h-3.5 w-3.5', color)} />
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <span className="ml-auto font-mono text-xs font-medium">{count}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Quick links */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(project.counts.incidents || 0) > 0 && (
                      <Link href={`/incidents?project=${project.project}`}>
                        <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          View incidents <ArrowRight className="h-3 w-3" />
                        </span>
                      </Link>
                    )}
                    {(project.counts.solutions || 0) > 0 && (
                      <Link href={`/solutions?project=${project.project}`}>
                        <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          View solutions <ArrowRight className="h-3 w-3" />
                        </span>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

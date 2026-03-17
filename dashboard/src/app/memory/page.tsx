'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Brain, Search, AlertTriangle, Lightbulb, History, BookOpen, Shield, Database } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { cn, timeAgo, truncate } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { FilterTabs } from '@/components/ui/filter-tabs'

const MEMORY_TYPES = [
  { key: 'all', label: 'All', icon: Database },
  { key: 'episodes', label: 'Sessions', icon: History },
  { key: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { key: 'solutions', label: 'Solutions', icon: Lightbulb },
  { key: 'decisions', label: 'Decisions', icon: BookOpen },
  { key: 'policies', label: 'Policies', icon: Shield },
] as const

const TYPE_VARIANTS: Record<string, 'default' | 'destructive' | 'success' | 'warning' | 'secondary'> = {
  episodes: 'default',
  incidents: 'destructive',
  solutions: 'success',
  decisions: 'warning',
  policies: 'secondary',
  contexts: 'secondary',
}

interface MemoryItem {
  _type: string
  id: number
  rank?: number
  title?: string
  summary?: string
  error_message?: string
  description?: string
  content?: string
  project?: string
  created_at?: string
}

function getItemTitle(item: MemoryItem): string {
  return item.title || item.summary || item.error_message || item.description || item.content || '(no title)'
}

function getItemLink(item: MemoryItem): string {
  const typeMap: Record<string, string> = {
    episodes: '/sessions',
    incidents: '/incidents',
    solutions: '/solutions',
  }
  const base = typeMap[item._type]
  return base ? `${base}/${item.id}` : '#'
}

export default function MemoryPage() {
  return (
    <Suspense fallback={<Loading variant="skeleton" />}>
      <MemoryPageInner />
    </Suspense>
  )
}

function MemoryPageInner() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const [query, setQuery] = useState(initialQuery)
  const [activeFilter, setActiveFilter] = useState('all')
  const [results, setResults] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDefault = useCallback(async () => {
    setLoading(true)
    try {
      const [sessions, incidents, solutions, decisions] = await Promise.allSettled([
        fetch('/api/sessions?limit=5').then(r => r.json()),
        fetch('/api/incidents?limit=5').then(r => r.json()),
        fetch('/api/solutions?limit=5').then(r => r.json()),
        fetch('/api/decisions?limit=5').then(r => r.json()),
      ])
      const items: MemoryItem[] = []
      if (sessions.status === 'fulfilled' && Array.isArray(sessions.value)) {
        for (const s of sessions.value) items.push({ ...s, _type: 'episodes' })
      }
      if (incidents.status === 'fulfilled' && Array.isArray(incidents.value)) {
        for (const i of incidents.value) items.push({ ...i, _type: 'incidents' })
      }
      if (solutions.status === 'fulfilled' && Array.isArray(solutions.value)) {
        for (const s of solutions.value) items.push({ ...s, _type: 'solutions' })
      }
      if (decisions.status === 'fulfilled' && Array.isArray(decisions.value)) {
        for (const d of decisions.value) items.push({ ...d, _type: 'decisions' })
      }
      items.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0
        const db = b.created_at ? new Date(b.created_at).getTime() : 0
        return db - da
      })
      setResults(items)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const fetchSearch = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/memory/search?q=${encodeURIComponent(q)}&limit=30`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch {
      setResults([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      fetchDefault()
      return
    }
    const timer = setTimeout(() => fetchSearch(query), 300)
    return () => clearTimeout(timer)
  }, [query, fetchDefault, fetchSearch])

  const filtered = activeFilter === 'all'
    ? results
    : results.filter(r => r._type === activeFilter)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Memory Explorer"
        description="Search and explore all memory layers"
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search across all memory layers..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-xl border border-border-subtle bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        )}
      </div>

      <FilterTabs
        options={MEMORY_TYPES.map(t => ({
          key: t.key,
          label: t.label,
          icon: t.icon,
          count: t.key === 'all' ? results.length : results.filter(r => r._type === t.key).length,
        }))}
        value={activeFilter}
        onChange={setActiveFilter}
      />

      {loading ? (
        <Loading variant="skeleton" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Brain}
          title={query ? 'No results found' : 'No memory entries yet'}
          description={query ? 'Try a different search query' : 'Memory will populate as you work'}
        />
      ) : (
        <div className="space-y-2 animate-fade-in">
          {filtered.map(item => (
            <Link key={`${item._type}-${item.id}`} href={getItemLink(item)}>
              <Card className="hover:border-primary/30 hover:shadow-sm transition-colors cursor-pointer">
                <CardContent className="flex items-start gap-3 py-3 px-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={TYPE_VARIANTS[item._type] || 'secondary'}>
                        {item._type}
                      </Badge>
                      {item.project && (
                        <Badge variant="outline">{item.project}</Badge>
                      )}
                      {item.rank != null && (
                        <span className="text-xs text-muted-foreground">
                          rank: {item.rank.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">
                      {truncate(getItemTitle(item), 120)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(item.created_at || null)}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

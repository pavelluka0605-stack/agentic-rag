'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  LayoutDashboard,
  History,
  Brain,
  AlertTriangle,
  Lightbulb,
  FolderKanban,
  Github,
  Activity,
  ArrowRight,
  Command,
  Play,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  action: () => void
  group: string
  keywords?: string[]
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    { id: 'nav-dashboard', label: 'Dashboard', description: 'Overview and stats', icon: LayoutDashboard, action: () => router.push('/dashboard'), group: 'Navigation', keywords: ['home', 'overview', 'main'] },
    { id: 'nav-sessions', label: 'Sessions', description: 'Development session history', icon: History, action: () => router.push('/sessions'), group: 'Navigation', keywords: ['episodes', 'work', 'history'] },
    { id: 'nav-memory', label: 'Memory Explorer', description: 'Search all memory layers', icon: Brain, action: () => router.push('/memory'), group: 'Navigation', keywords: ['search', 'explore', 'find'] },
    { id: 'nav-incidents', label: 'Incidents', description: 'Error tracking and fixes', icon: AlertTriangle, action: () => router.push('/incidents'), group: 'Navigation', keywords: ['errors', 'bugs', 'issues'] },
    { id: 'nav-solutions', label: 'Solutions', description: 'Verified fixes and patterns', icon: Lightbulb, action: () => router.push('/solutions'), group: 'Navigation', keywords: ['fixes', 'patterns', 'playbooks'] },
    { id: 'nav-projects', label: 'Projects', description: 'All projects overview', icon: FolderKanban, action: () => router.push('/projects'), group: 'Navigation', keywords: ['repos', 'repositories'] },
    { id: 'nav-github', label: 'GitHub Activity', description: 'Webhook events and PRs', icon: Github, action: () => router.push('/github'), group: 'Navigation', keywords: ['webhooks', 'pr', 'pull request', 'workflow'] },
    { id: 'nav-health', label: 'System Health', description: 'Services status and runtime', icon: Activity, action: () => router.push('/health'), group: 'Navigation', keywords: ['status', 'services', 'runtime', 'control'] },
    // Quick Actions
    { id: 'act-search', label: 'Search Memory', description: 'Full-text search across all layers', icon: Search, action: () => router.push(query.trim() ? `/memory?q=${encodeURIComponent(query.trim())}` : '/memory'), group: 'Quick Actions', keywords: ['find', 'query', 'fts'] },
    { id: 'act-open-incidents', label: 'View Open Incidents', description: 'Show unresolved errors', icon: AlertTriangle, action: () => router.push('/incidents?status=open'), group: 'Quick Actions', keywords: ['open', 'unresolved', 'active'] },
    { id: 'act-verified', label: 'Verified Solutions', description: 'Proven fixes only', icon: Lightbulb, action: () => router.push('/solutions?verified=true'), group: 'Quick Actions', keywords: ['proven', 'working'] },
    { id: 'act-latest-session', label: 'Latest Session', description: 'Jump to most recent session', icon: Play, action: () => router.push('/sessions'), group: 'Quick Actions', keywords: ['resume', 'continue', 'last', 'recent'] },
    { id: 'act-remote', label: 'Remote Control', description: 'Runtime management and logs', icon: Zap, action: () => router.push('/health'), group: 'Quick Actions', keywords: ['control', 'start', 'stop', 'restart', 'runtime'] },
  ], [router])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter(cmd => {
      const searchable = [cmd.label, cmd.description, ...(cmd.keywords || [])].join(' ').toLowerCase()
      return searchable.includes(q)
    })
  }, [query, commands])

  const groups = useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    for (const item of filtered) {
      const group = map.get(item.group) ?? []
      group.push(item)
      map.set(item.group, group)
    }
    return Array.from(map.entries())
  }, [filtered])

  const flatItems = useMemo(() => filtered, [filtered])

  const executeItem = useCallback((item: CommandItem) => {
    onOpenChange(false)
    setQuery('')
    setSelectedIndex(0)
    item.action()
  }, [onOpenChange])

  // Reset selection on filter change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Global shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  // Keyboard navigation inside palette
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, flatItems.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (flatItems[selectedIndex]) {
          executeItem(flatItems[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        onOpenChange(false)
        break
    }
  }, [flatItems, selectedIndex, executeItem, onOpenChange])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-selected="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // Build a lookup from item id to its flat index for selection tracking.
  // This replaces the mutable `let itemIndex = 0` counter that was
  // incremented during render — a pattern that breaks under React strict
  // mode (double-render) and violates React's no-side-effects-during-render rule.
  const itemIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    let idx = 0
    for (const [, items] of groups) {
      for (const item of items) {
        map.set(item.id, idx++)
      }
    }
    return map
  }, [groups])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh] sm:pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg animate-fade-in rounded-xl border border-border bg-bg-elevated shadow-2xl shadow-black/40">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border-subtle px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="h-12 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-border-subtle bg-bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No commands found
            </div>
          ) : (
            groups.map(([groupName, items]) => (
              <div key={groupName}>
                <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  {groupName}
                </div>
                {items.map((item) => {
                  const idx = itemIndexMap.get(item.id) ?? 0
                  const isSelected = idx === selectedIndex
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      data-selected={isSelected}
                      onClick={() => executeItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                        isSelected
                          ? 'bg-primary/10 text-foreground'
                          : 'text-muted-foreground hover:bg-bg-overlay hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-foreground">{item.label}</span>
                        {item.description && (
                          <span className="ml-2 text-xs text-muted-foreground">{item.description}</span>
                        )}
                      </div>
                      {isSelected && (
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-border-subtle px-4 py-2 text-[11px] text-muted-foreground/50">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border-subtle px-1 font-mono text-[10px]">&uarr;&darr;</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border-subtle px-1 font-mono text-[10px]">&crarr;</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border-subtle px-1 font-mono text-[10px]">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  )
}

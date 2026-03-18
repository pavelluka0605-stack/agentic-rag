'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Search, RefreshCw, Command, Menu } from 'lucide-react'

const pathTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/chat': 'Чат',
  '/sessions': 'Sessions',
  '/memory': 'Memory',
  '/incidents': 'Incidents',
  '/solutions': 'Solutions',
  '/projects': 'Projects',
  '/github': 'GitHub',
  '/health': 'System Health',
}

function getPageTitle(pathname: string): string {
  if (pathTitles[pathname]) return pathTitles[pathname]
  for (const [path, title] of Object.entries(pathTitles)) {
    if (pathname.startsWith(path + '/')) return title
  }
  return 'Dashboard'
}

interface TopbarProps {
  onSearchClick?: () => void
  onMenuClick?: () => void
}

export function Topbar({ onSearchClick, onMenuClick }: TopbarProps) {
  const pathname = usePathname()
  const [time, setTime] = useState('')
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    function tick() {
      const now = new Date()
      setTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      )
      setDateStr(
        now.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      )
    }
    tick()
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-[oklch(0.145_0.005_260)]/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground md:hidden"
          title="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex flex-col justify-center">
          <h1 className="text-base font-semibold text-foreground">
            {getPageTitle(pathname)}
          </h1>
        {dateStr && (
          <span className="text-[11px] text-muted-foreground/60">{dateStr}</span>
        )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Command palette trigger */}
        <button
          onClick={onSearchClick}
          className="flex h-8 items-center gap-2 rounded-lg border border-border-subtle bg-bg-inset px-3 text-sm text-muted-foreground/60 transition-colors hover:bg-bg-overlay hover:text-muted-foreground"
          title="Search (Cmd+K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="ml-1 hidden rounded border border-border-subtle px-1 py-0.5 font-mono text-[10px] sm:inline-block">
            <Command className="inline h-2.5 w-2.5" />K
          </kbd>
        </button>

        <button
          onClick={() => window.location.reload()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        {time && (
          <span className="ml-2 font-mono text-sm text-muted-foreground/80">
            {time}
          </span>
        )}
      </div>
    </header>
  )
}

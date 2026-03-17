'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Search, RefreshCw } from 'lucide-react'

const pathTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
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

export function Topbar() {
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
      <div className="flex flex-col justify-center">
        <h1 className="text-base font-semibold text-foreground">
          {getPageTitle(pathname)}
        </h1>
        {dateStr && (
          <span className="text-[11px] text-muted-foreground/60">{dateStr}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          title="Search"
        >
          <Search className="h-4 w-4" />
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

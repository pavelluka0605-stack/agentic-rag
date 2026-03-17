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

  useEffect(() => {
    function tick() {
      setTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      )
    }
    tick()
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
      <h1 className="text-sm font-medium text-foreground">
        {getPageTitle(pathname)}
      </h1>

      <div className="flex items-center gap-1">
        <button
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          title="Search"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        {time && (
          <span className="ml-2 font-mono text-xs text-muted-foreground">
            {time}
          </span>
        )}
      </div>
    </header>
  )
}

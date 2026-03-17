'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  History,
  Brain,
  AlertTriangle,
  Lightbulb,
  FolderKanban,
  Github,
  Activity,
  PanelLeftClose,
  PanelLeft,
  Terminal,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Work',
    items: [
      { label: 'Sessions', href: '/sessions', icon: History },
      { label: 'Memory', href: '/memory', icon: Brain },
    ],
  },
  {
    title: 'Issues',
    items: [
      { label: 'Incidents', href: '/incidents', icon: AlertTriangle },
      { label: 'Solutions', href: '/solutions', icon: Lightbulb },
    ],
  },
  {
    title: 'External',
    items: [
      { label: 'Projects', href: '/projects', icon: FolderKanban },
      { label: 'GitHub', href: '/github', icon: Github },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'System Health', href: '/health', icon: Activity },
    ],
  },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border-subtle bg-bg-deep transition-all duration-200 ease-out',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border-subtle px-4 shadow-[0_1px_8px_-2px_oklch(0.685_0.155_250_/_0.15)]">
        <Terminal className="h-6 w-6 shrink-0 text-primary" />
        {!collapsed && (
          <span className="text-gradient text-sm font-semibold tracking-tight opacity-90">
            Claude Code
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navGroups.map((group, gi) => (
          <div key={group.title}>
            {gi > 0 && (
              <div className="mx-2 my-2.5 border-t border-border/40" />
            )}
            {!collapsed && (
              <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-primary/12 font-medium text-primary'
                          : 'text-muted-foreground hover:bg-[oklch(0.175_0.008_260)] hover:text-foreground'
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
                      )}
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border-subtle p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground/70 transition-colors hover:bg-[oklch(0.175_0.008_260)] hover:text-muted-foreground"
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
        {!collapsed && (
          <div className="flex items-center gap-1.5 px-2.5 pt-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <p className="text-[11px] text-muted-foreground/40">
              v1.0.0
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}

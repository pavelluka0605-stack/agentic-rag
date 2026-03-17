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
        'flex h-screen flex-col border-r border-border bg-[oklch(0.12_0_0)] transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex h-12 items-center gap-2.5 border-b border-border px-4">
        <Terminal className="h-5 w-5 shrink-0 text-primary" />
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Claude Code
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navGroups.map((group, gi) => (
          <div key={group.title}>
            {gi > 0 && (
              <div className="mx-2 my-2 border-t border-border/50" />
            )}
            {!collapsed && (
              <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
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
                        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      )}
                      title={collapsed ? item.label : undefined}
                    >
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
      <div className="border-t border-border p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
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
          <p className="px-2.5 pt-1 text-[10px] text-muted-foreground/50">
            v1.0.0
          </p>
        )}
      </div>
    </aside>
  )
}

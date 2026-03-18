'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { CommandPalette } from '@/components/ui/command-palette'

// Routes that need full-bleed layout (no padding, no max-width, no overflow-y-auto)
const fullBleedRoutes = ['/chat']

export function AppShell({ children }: { children: React.ReactNode }) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const isFullBleed = fullBleedRoutes.some(r => pathname === r || pathname.startsWith(r + '/'))

  return (
    <div className="flex h-screen overflow-hidden bg-bg-deep">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          onSearchClick={() => setCommandPaletteOpen(true)}
          onMenuClick={() => setMobileMenuOpen(true)}
        />
        {isFullBleed ? (
          <main className="flex-1 overflow-hidden bg-bg-surface">
            {children}
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto bg-bg-surface p-4 sm:p-6">
            <div className="mx-auto max-w-[1400px] animate-fade-in">
              {children}
            </div>
          </main>
        )}
      </div>
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </div>
  )
}

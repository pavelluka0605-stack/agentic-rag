'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { CommandPalette } from '@/components/ui/command-palette'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-bg-deep">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          onSearchClick={() => setCommandPaletteOpen(true)}
          onMenuClick={() => setMobileMenuOpen(true)}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-bg-surface p-3 sm:p-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-[1400px] w-full animate-fade-in">
            {children}
          </div>
        </main>
      </div>
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </div>
  )
}

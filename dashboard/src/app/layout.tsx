import type { Metadata } from 'next'
import './globals.css'
import { AppShell } from '@/components/layout/app-shell'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: 'Claude Code Dashboard',
  description: 'Development intelligence dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}

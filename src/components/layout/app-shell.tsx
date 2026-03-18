"use client"

import { ReactNode } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { OfflineBanner } from './offline-banner'
import { useSettings } from '@/contexts/settings-context'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { settings } = useSettings()

  return (
    <div className={`flex h-screen bg-[var(--background)] overflow-hidden ${settings.sidebarPosition === 'right' ? 'flex-row-reverse' : ''}`}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <OfflineBanner />
        <main className={`flex-1 overflow-y-auto ${settings.compactMode ? 'p-3' : 'p-6'}`}>
          {children}
        </main>
      </div>
    </div>
  )
}

"use client"

import { ReactNode, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { OfflineBanner } from './offline-banner'
import { useSettings } from '@/contexts/settings-context'

interface AppShellProps {
  children: ReactNode
}

type ElectronAPI = {
  getSessionToken?: () => Promise<string>
}

export function AppShell({ children }: AppShellProps) {
  const { settings } = useSettings()
  const router = useRouter()
  const checkingRef = useRef(false)

  useEffect(() => {
    const electronAPI = (window as Window & { electronAPI?: ElectronAPI }).electronAPI
    if (!electronAPI?.getSessionToken) return

    let cancelled = false

    async function refreshLicense() {
      if (checkingRef.current || cancelled) return
      checkingRef.current = true

      try {
        const response = await fetch('/api/license?refresh=1', { cache: 'no-store' })
        const result = await response.json().catch(() => ({ licensed: false }))
        if (!response.ok || !result.licensed) {
          router.replace('/activate')
        }
      } catch {
        // Keep the current session alive if the refresh check itself fails.
      } finally {
        checkingRef.current = false
      }
    }

    const intervalId = window.setInterval(refreshLicense, 15 * 60 * 1000)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshLicense()
      }
    }
    const handleWindowFocus = () => {
      void refreshLicense()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)

    void refreshLicense()

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [router])

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

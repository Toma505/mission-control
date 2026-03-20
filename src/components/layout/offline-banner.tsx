'use client'

import { useState, useEffect } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'

/**
 * Persistent banner that appears when the browser goes offline.
 * Uses navigator.onLine + online/offline events for detection.
 * Also catches fetch failures to the local API as a secondary signal.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  const [apiUnreachable, setApiUnreachable] = useState(false)

  useEffect(() => {
    // Browser online/offline events
    const goOffline = () => setOffline(true)
    const goOnline = () => {
      setOffline(false)
      setApiUnreachable(false)
    }

    // Set initial state
    if (!navigator.onLine) setOffline(true)

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)

    // Periodic API health check — catches cases where browser thinks it's online
    // but the local Next.js server is unreachable (e.g., Electron app restart)
    const checkApi = async () => {
      if (!navigator.onLine) return // Already showing offline banner
      try {
        const res = await fetch('/api/connection', {
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          setApiUnreachable(false)
        } else {
          setApiUnreachable(true)
        }
      } catch {
        setApiUnreachable(true)
      }
    }

    // Check every 30 seconds
    const interval = setInterval(checkApi, 30000)

    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
      clearInterval(interval)
    }
  }, [])

  const isVisible = offline || apiUnreachable

  if (!isVisible) return null

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/20 px-4 py-2 flex items-center gap-3 text-sm shrink-0">
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      <p className="text-amber-300 flex-1">
        {offline
          ? 'You are offline. Dashboard data may be stale.'
          : 'The app server is unreachable. Data may not update until the connection is restored.'}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.06] text-xs font-medium text-amber-300 hover:bg-white/[0.1] transition-colors whitespace-nowrap"
      >
        <RefreshCw className="w-3 h-3" />
        Reload
      </button>
    </div>
  )
}

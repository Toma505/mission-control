'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { useSettings } from '@/contexts/settings-context'

/**
 * Client-side refresh control for SSR dashboard pages.
 * Adds:
 * - A visible "Refresh" button so users aren't stuck with stale data
 * - Auto-refresh on the user's configured interval (from settings)
 * - "Last updated" timestamp so users know data freshness
 */
export function RefreshControl() {
  const router = useRouter()
  const { settings } = useSettings()
  const [isPending, startTransition] = useTransition()
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh()
      setLastRefresh(new Date())
    })
  }, [router])

  // Auto-refresh based on user's configured interval
  useEffect(() => {
    const intervalMs = (settings.refreshInterval || 30) * 1000
    const timer = setInterval(refresh, intervalMs)
    return () => clearInterval(timer)
  }, [settings.refreshInterval, refresh])

  // Format relative time
  const getTimeAgo = () => {
    const seconds = Math.floor((Date.now() - lastRefresh.getTime()) / 1000)
    if (seconds < 5) return 'Just now'
    if (seconds < 60) return `${seconds}s ago`
    return `${Math.floor(seconds / 60)}m ago`
  }

  const [, forceUpdate] = useState(0)
  useEffect(() => {
    // Update the "time ago" display every 5 seconds
    const timer = setInterval(() => forceUpdate(n => n + 1), 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-text-muted">
        Updated {getTimeAgo()}
      </span>
      <button
        onClick={refresh}
        disabled={isPending}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] text-xs text-text-secondary hover:bg-white/[0.08] hover:text-text-primary transition-colors disabled:opacity-50"
        title="Refresh dashboard data"
      >
        <RefreshCw className={`w-3 h-3 ${isPending ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  )
}

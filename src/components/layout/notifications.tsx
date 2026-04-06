'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, ExternalLink, RefreshCw, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { apiFetch } from '@/lib/api-client'
import type { NotificationType } from '@/lib/notifications-store'
import {
  EmptyNotificationsState,
  formatNotificationTime,
  getNotificationAppearance,
} from '@/components/notifications/notification-appearance'

type NotificationItem = {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: string
  read: boolean
  dismissed: boolean
  href?: string
  source?: string
  outputSummary?: string
}

type NotificationsResponse = {
  notifications: NotificationItem[]
  unreadCount: number
}

type ElectronAPI = {
  showNotification?: (options: { title: string; body: string; urgency?: 'low' | 'normal' | 'critical' }) => Promise<void>
  setNotificationBadge?: (count: number) => Promise<void>
}

function getElectronAPI() {
  return typeof window !== 'undefined'
    ? (window as Window & { electronAPI?: ElectronAPI }).electronAPI
    : undefined
}

export function Notifications() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const notifiedIdsRef = useRef<Set<string>>(new Set())
  const router = useRouter()

  const syncBadge = useCallback(async (count: number) => {
    try {
      await getElectronAPI()?.setNotificationBadge?.(count)
    } catch {
      // Best-effort only.
    }
  }, [])

  const maybeShowDesktopNotifications = useCallback(async (items: NotificationItem[]) => {
    if (document.visibilityState === 'visible' && document.hasFocus()) return

    const electronAPI = getElectronAPI()
    if (!electronAPI?.showNotification) return

    for (const item of items) {
      if (item.read || item.dismissed || notifiedIdsRef.current.has(item.id)) continue

      try {
        await electronAPI.showNotification({
          title: item.title,
          body: item.message,
          urgency: item.type === 'agent_error' || item.type === 'budget_alert' ? 'critical' : 'normal',
        })
        notifiedIdsRef.current.add(item.id)
      } catch {
        break
      }
    }
  }, [])

  const loadNotifications = useCallback(async () => {
    setRefreshing(true)
    setError('')
    try {
      const response = await fetch('/api/notifications?limit=8', { cache: 'no-store' })
      const data = await response.json() as NotificationsResponse
      const nextNotifications = data.notifications || []
      setNotifications(nextNotifications)
      setUnreadCount(data.unreadCount || 0)
      void syncBadge(data.unreadCount || 0)
      void maybeShowDesktopNotifications(nextNotifications)
    } catch {
      setError('Could not load notifications.')
    } finally {
      setRefreshing(false)
    }
  }, [maybeShowDesktopNotifications, syncBadge])

  useEffect(() => {
    void loadNotifications()
    const interval = window.setInterval(() => {
      void loadNotifications()
    }, 30_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [loadNotifications])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => !notification.dismissed),
    [notifications],
  )

  async function mutate(action: 'markRead' | 'markAllRead' | 'dismiss', ids?: string[]) {
    setBusyAction(action)
    try {
      await apiFetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'markAllRead' ? { action } : { action, ids }),
      })
      await loadNotifications()
    } finally {
      setBusyAction('')
    }
  }

  function openHistory() {
    setOpen(false)
    router.push('/notifications')
  }

  async function openNotification(notification: NotificationItem) {
    if (!notification.read) {
      await mutate('markRead', [notification.id])
    }

    setOpen(false)
    const href = notification.href && /^\/[^/\\]/.test(notification.href) ? notification.href : '/notifications'
    router.push(href)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-7 w-7 items-center justify-center rounded-[8px] transition-all duration-200 hover:bg-[var(--glass-bg)]"
        title="Notifications"
      >
        <Bell className="h-[15px] w-[15px] text-text-muted" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">
            {Math.min(unreadCount, 9)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[380px] overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--background-card)]/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--glass-border)] px-4 py-3">
            <div>
              <h3 className="text-sm font-medium text-text-primary">Notification Center</h3>
              <p className="text-[11px] text-text-muted">Recent activity from agents, budgets, and scheduled tasks.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void loadNotifications()}
                className="rounded-lg px-2 py-1 text-[11px] text-text-muted transition-colors hover:bg-[var(--glass-bg)] hover:text-text-primary"
                title="Refresh notifications"
              >
                <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              {unreadCount > 0 ? (
                <button
                  onClick={() => void mutate('markAllRead')}
                  className="text-[11px] text-accent-highlight hover:text-accent-highlight/80"
                >
                  Mark all read
                </button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto p-3">
            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-100">
                {error}
              </div>
            ) : visibleNotifications.length === 0 ? (
              <EmptyNotificationsState message="You’re all caught up." />
            ) : (
              <div className="space-y-2">
                {visibleNotifications.map((notification) => {
                  const appearance = getNotificationAppearance(notification.type)
                  return (
                    <div
                      key={notification.id}
                      className={`rounded-2xl border px-4 py-4 transition-colors ${
                        notification.read
                          ? 'border-white/[0.06] bg-white/[0.03]'
                          : 'border-accent-primary/20 bg-accent-primary/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-white/[0.04] p-2">{appearance.icon}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-text-primary">{notification.title}</p>
                            <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${appearance.badgeClassName}`}>
                              {appearance.badgeLabel}
                            </span>
                            <span className="text-[11px] text-text-muted">{formatNotificationTime(notification.timestamp)}</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-text-secondary">{notification.message}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => void openNotification(notification)}
                              className="rounded-xl bg-accent-primary px-3 py-2 text-xs font-medium text-white hover:bg-accent-primary/90"
                            >
                              <ExternalLink className="mr-1 inline h-3.5 w-3.5" />
                              {notification.href ? 'Open' : 'Details'}
                            </button>
                            {!notification.read ? (
                              <button
                                onClick={() => void mutate('markRead', [notification.id])}
                                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.07]"
                              >
                                Mark read
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <button
                          onClick={() => void mutate('dismiss', [notification.id])}
                          disabled={busyAction === 'dismiss'}
                          className="text-text-muted/40 transition-colors hover:text-text-muted"
                          aria-label={`Dismiss ${notification.title}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--glass-border)] px-4 py-3">
            <button
              onClick={openHistory}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.07]"
            >
              View full history
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}


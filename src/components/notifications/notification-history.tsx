'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, RotateCcw, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { apiFetch } from '@/lib/api-client'
import type { NotificationType } from '@/lib/notifications-store'
import {
  EmptyNotificationsState,
  formatNotificationTime,
  getNotificationAppearance,
} from './notification-appearance'

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
  totalCount: number
}

type FilterMode = 'all' | 'unread' | 'dismissed'

export function NotificationHistory() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState('')
  const router = useRouter()

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/notifications?includeDismissed=1&limit=200', { cache: 'no-store' })
      const data = await response.json() as NotificationsResponse
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  const filteredNotifications = useMemo(() => {
    switch (filter) {
      case 'unread':
        return notifications.filter((notification) => !notification.read && !notification.dismissed)
      case 'dismissed':
        return notifications.filter((notification) => notification.dismissed)
      default:
        return notifications
    }
  }, [filter, notifications])

  async function runPatch(action: 'markRead' | 'markAllRead' | 'dismiss' | 'restore', ids?: string[]) {
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

  function openNotification(notification: NotificationItem) {
    if (!notification.href) return
    void runPatch('markRead', [notification.id])
    router.push(notification.href)
  }

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Notification Center</h2>
            <p className="mt-1 text-sm text-text-muted">
              Review agent events, budget warnings, and scheduled task activity in one timeline.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'unread', 'dismissed'] as FilterMode[]).map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                  filter === option
                    ? 'bg-accent-primary/20 text-accent-primary'
                    : 'border border-white/[0.08] bg-white/[0.04] text-text-secondary hover:bg-white/[0.07]'
                }`}
              >
                {option === 'all' ? 'All' : option === 'unread' ? 'Unread' : 'Dismissed'}
              </button>
            ))}
            <button
              onClick={() => void runPatch('markAllRead')}
              disabled={unreadCount === 0 || busyAction === 'markAllRead'}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === 'markAllRead' ? 'Updating...' : 'Mark all read'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-2xl px-5 py-12 text-center text-sm text-text-muted">
          Loading notifications...
        </div>
      ) : filteredNotifications.length === 0 ? (
        <EmptyNotificationsState message="No notifications in this view yet." />
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => {
            const appearance = getNotificationAppearance(notification.type)

            return (
              <div
                key={notification.id}
                className={`glass rounded-2xl p-5 transition-colors ${
                  notification.read ? 'opacity-85' : 'border border-accent-primary/15'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-white/[0.04] p-2.5">{appearance.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium text-text-primary">{notification.title}</h3>
                      <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${appearance.badgeClassName}`}>
                        {appearance.badgeLabel}
                      </span>
                      <span className="text-[11px] text-text-muted">{formatNotificationTime(notification.timestamp)}</span>
                      {notification.dismissed ? (
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-text-muted">
                          Dismissed
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">{notification.message}</p>
                    {notification.outputSummary ? (
                      <div className="mt-3 rounded-2xl bg-black/20 px-4 py-3 text-xs text-text-muted">
                        {notification.outputSummary}
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {notification.href ? (
                        <button
                          onClick={() => openNotification(notification)}
                          className="rounded-xl bg-accent-primary px-3 py-2 text-xs font-medium text-white hover:bg-accent-primary/90"
                        >
                          <ExternalLink className="mr-1 inline h-3.5 w-3.5" />
                          Open
                        </button>
                      ) : null}
                      {!notification.read ? (
                        <button
                          onClick={() => void runPatch('markRead', [notification.id])}
                          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.07]"
                        >
                          Mark read
                        </button>
                      ) : null}
                      {notification.dismissed ? (
                        <button
                          onClick={() => void runPatch('restore', [notification.id])}
                          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.07]"
                        >
                          <RotateCcw className="mr-1 inline h-3.5 w-3.5" />
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => void runPatch('dismiss', [notification.id])}
                          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.07]"
                        >
                          <X className="mr-1 inline h-3.5 w-3.5" />
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  DollarSign,
  Zap,
  Users,
  Shield,
  Download,
  RefreshCw,
  Rocket,
} from 'lucide-react'
import { OPEN_DIAGNOSTICS_EVENT } from './desktop-events'

interface Notification {
  id: string
  type: 'success' | 'warning' | 'info' | 'error'
  title: string
  message: string
  timestamp: Date
  read: boolean
  icon?: ReactNode
  actionLabel?: string
  onAction?: () => void | Promise<void>
}

type UpdateStatus = {
  status: string
  info?: { version?: string } | null
  error?: string | null
}

type ElectronAPI = {
  updaterStatus?: () => Promise<UpdateStatus>
  updaterDownload?: () => Promise<UpdateStatus>
  updaterInstall?: () => Promise<void>
  onUpdateStatus?: (callback: (status: UpdateStatus) => void) => (() => void) | void
}

function getElectronAPI() {
  return typeof window !== 'undefined'
    ? (window as Window & { electronAPI?: ElectronAPI }).electronAPI
    : undefined
}

function formatUpdateMessage(status?: UpdateStatus | null) {
  switch (status?.status) {
    case 'available':
      return status.info?.version ? `Version ${status.info.version} is ready to download.` : 'A desktop update is ready to download.'
    case 'downloaded':
      return 'The update is downloaded and ready to install.'
    case 'error':
      return status.error || 'Desktop update checks are failing.'
    default:
      return null
  }
}

export function Notifications() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [readIds, setReadIds] = useState<string[]>([])
  const [dismissedIds, setDismissedIds] = useState<string[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [busyActionId, setBusyActionId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const markRead = useCallback((id: string) => {
    setReadIds(prev => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const navigateTo = useCallback((href: string) => {
    setOpen(false)
    router.push(href)
  }, [router])

  const openDiagnostics = useCallback(() => {
    setOpen(false)
    window.dispatchEvent(new CustomEvent(OPEN_DIAGNOSTICS_EVENT))
  }, [])

  const fetchNotifications = useCallback(async () => {
    const nextNotifications: Notification[] = []
    const electronAPI = getElectronAPI()

    setRefreshing(true)

    try {
      const costsRes = await fetch('/api/costs', { cache: 'no-store' })
      if (costsRes.ok) {
        const costs = await costsRes.json()

        if (costs.openrouter) {
          const pctUsed = costs.openrouter.totalCredits > 0
            ? (costs.openrouter.totalUsage / costs.openrouter.totalCredits) * 100
            : 0

          if (pctUsed > 80) {
            nextNotifications.push({
              id: 'or-credits-low',
              type: 'warning',
              title: 'OpenRouter credits low',
              message: `${(100 - pctUsed).toFixed(0)}% remaining ($${costs.openrouter.remaining.toFixed(2)} left)`,
              timestamp: new Date(),
              read: false,
              icon: <DollarSign className="w-4 h-4 text-amber-400" />,
              actionLabel: 'Open Costs',
              onAction: () => navigateTo('/costs'),
            })
          }

          if (costs.openrouter.usageDaily > 5) {
            nextNotifications.push({
              id: 'or-high-spend',
              type: 'info',
              title: 'High daily spend',
              message: `$${costs.openrouter.usageDaily.toFixed(2)} spent today on OpenRouter`,
              timestamp: new Date(),
              read: false,
              icon: <Zap className="w-4 h-4 text-violet-400" />,
              actionLabel: 'Review Costs',
              onAction: () => navigateTo('/costs'),
            })
          }
        }

        if (costs.railway && !costs.railway.error && costs.railway.estimated.total > costs.railway.credits) {
          nextNotifications.push({
            id: 'railway-overage',
            type: 'warning',
            title: 'Railway over budget',
            message: `Estimated $${costs.railway.estimated.total.toFixed(2)}/mo exceeds $${costs.railway.credits}/mo credits`,
            timestamp: new Date(),
            read: false,
            icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
            actionLabel: 'Review Costs',
            onAction: () => navigateTo('/costs'),
          })
        }
      }

      const modeRes = await fetch('/api/mode', { cache: 'no-store' })
      if (modeRes.ok) {
        const mode = await modeRes.json()
        if (mode.connected) {
          nextNotifications.push({
            id: 'openclaw-connected',
            type: 'success',
            title: 'OpenClaw online',
            message: `Running ${mode.currentModel?.split('/').pop() || 'unknown'} in ${mode.mode} mode`,
            timestamp: new Date(),
            read: true,
            icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
          })
        } else {
          nextNotifications.push({
            id: 'openclaw-disconnected',
            type: 'error',
            title: 'OpenClaw disconnected',
            message: 'Mission Control cannot reach your OpenClaw instance right now.',
            timestamp: new Date(),
            read: false,
            icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
            actionLabel: 'Check Connection',
            onAction: () => navigateTo('/setup?reconfigure=true'),
          })
        }
      }

      try {
        const budgetRes = await fetch('/api/budget', { cache: 'no-store' })
        if (budgetRes.ok) {
          const budget = await budgetRes.json()
          if (budget.alertLevel === 'exceeded') {
            nextNotifications.push({
              id: 'budget-exceeded',
              type: 'error',
              title: budget.throttled ? 'Budget exceeded and throttled' : 'Budget exceeded',
              message: budget.throttled
                ? `Switched to budget mode. Daily: $${budget.spend.daily.toFixed(2)}/$${budget.budget.dailyLimit}`
                : `Daily spend $${budget.spend.daily.toFixed(2)} exceeds $${budget.budget.dailyLimit}`,
              timestamp: new Date(),
              read: false,
              icon: <Shield className="w-4 h-4 text-red-400" />,
              actionLabel: 'Review Budget',
              onAction: () => navigateTo('/costs'),
            })
          } else if (budget.alertLevel === 'critical') {
            nextNotifications.push({
              id: 'budget-critical',
              type: 'warning',
              title: 'Near spending limit',
              message: `Daily: $${budget.spend.daily.toFixed(2)}/$${budget.budget.dailyLimit} (${budget.dailyPct.toFixed(0)}%)`,
              timestamp: new Date(),
              read: false,
              icon: <Shield className="w-4 h-4 text-orange-400" />,
              actionLabel: 'Review Budget',
              onAction: () => navigateTo('/costs'),
            })
          } else if (budget.alertLevel === 'warning') {
            nextNotifications.push({
              id: 'budget-warning',
              type: 'info',
              title: 'Approaching spending limit',
              message: `Daily: $${budget.spend.daily.toFixed(2)}/$${budget.budget.dailyLimit} (${budget.dailyPct.toFixed(0)}%)`,
              timestamp: new Date(),
              read: false,
              icon: <Shield className="w-4 h-4 text-amber-400" />,
              actionLabel: 'Review Budget',
              onAction: () => navigateTo('/costs'),
            })
          }
        }
      } catch {}

      const activitiesRes = await fetch('/api/activities', { cache: 'no-store' })
      if (activitiesRes.ok) {
        const activities = await activitiesRes.json()
        const recentSessions = (activities.sessions || []).slice(0, 3)
        for (const session of recentSessions) {
          if (session.status === 'FAILED') {
            nextNotifications.push({
              id: `session-fail-${session.key}`,
              type: 'error',
              title: 'Agent session failed',
              message: session.key.replace('agent:main:', ''),
              timestamp: new Date(),
              read: false,
              icon: <Users className="w-4 h-4 text-red-400" />,
              actionLabel: 'Open Workshop',
              onAction: () => navigateTo('/workshop'),
            })
          }
        }
      }

      try {
        const updateStatus = await electronAPI?.updaterStatus?.()
        const updateMessage = formatUpdateMessage(updateStatus)
        if (updateStatus?.status === 'available' && updateMessage) {
          nextNotifications.push({
            id: 'desktop-update-available',
            type: 'info',
            title: 'Desktop update available',
            message: updateMessage,
            timestamp: new Date(),
            read: false,
            icon: <Rocket className="w-4 h-4 text-sky-400" />,
            actionLabel: 'Download Update',
            onAction: async () => {
              await electronAPI?.updaterDownload?.()
            },
          })
        } else if (updateStatus?.status === 'downloaded' && updateMessage) {
          nextNotifications.push({
            id: 'desktop-update-downloaded',
            type: 'success',
            title: 'Update ready to install',
            message: updateMessage,
            timestamp: new Date(),
            read: false,
            icon: <Download className="w-4 h-4 text-emerald-400" />,
            actionLabel: 'Restart to Install',
            onAction: async () => {
              await electronAPI?.updaterInstall?.()
            },
          })
        } else if (updateStatus?.status === 'error' && updateMessage) {
          nextNotifications.push({
            id: 'desktop-update-error',
            type: 'warning',
            title: 'Update check failed',
            message: updateMessage,
            timestamp: new Date(),
            read: false,
            icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
            actionLabel: 'Open Diagnostics',
            onAction: openDiagnostics,
          })
        }
      } catch {}
    } catch {
      nextNotifications.length = 0
    } finally {
      setNotifications(nextNotifications)
      setRefreshing(false)
    }
  }, [navigateTo, openDiagnostics])

  useEffect(() => {
    void fetchNotifications()
    const interval = setInterval(() => {
      void fetchNotifications()
    }, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  useEffect(() => {
    const electronAPI = getElectronAPI()
    const updateListener = electronAPI?.onUpdateStatus?.(() => {
      void fetchNotifications()
    })

    return () => {
      if (typeof updateListener === 'function') updateListener()
    }
  }, [fetchNotifications])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const visibleNotifications = useMemo(() => (
    notifications
      .filter(notification => !dismissedIds.includes(notification.id))
      .map(notification => ({
        ...notification,
        read: notification.read || readIds.includes(notification.id),
      }))
  ), [dismissedIds, notifications, readIds])

  const unreadCount = visibleNotifications.filter(notification => !notification.read).length

  function markAllRead() {
    setReadIds(prev => {
      const next = new Set(prev)
      for (const notification of visibleNotifications) next.add(notification.id)
      return Array.from(next)
    })
  }

  function dismiss(id: string) {
    setDismissedIds(prev => (prev.includes(id) ? prev : [...prev, id]))
  }

  async function runAction(notification: Notification) {
    if (!notification.onAction) return

    markRead(notification.id)
    setBusyActionId(notification.id)

    try {
      await notification.onAction()
    } finally {
      setBusyActionId(null)
    }
  }

  const iconForType = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-400" />
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-400" />
      default: return <Info className="w-4 h-4 text-sky-400" />
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-7 h-7 rounded-[8px] flex items-center justify-center hover:bg-white/[0.06] transition-all duration-200 relative"
        title="Notifications"
      >
        <Bell className="w-[15px] h-[15px] text-text-muted" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
            {Math.min(unreadCount, 9)}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] rounded-xl border border-white/[0.08] bg-[#1a1a1e]/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-text-primary">Notifications</h3>
              <p className="text-[11px] text-text-muted">Alerts that help you recover quickly, not just observe.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void fetchNotifications()}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-text-muted hover:bg-white/[0.04] hover:text-text-primary"
                title="Refresh notifications"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-accent-highlight hover:text-accent-highlight/80">
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {visibleNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-6 h-6 text-text-muted/30 mx-auto mb-2" />
                <p className="text-xs text-text-muted">No notifications</p>
              </div>
            ) : (
              visibleNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 border-b border-white/[0.04] transition-colors ${
                    notification.read ? 'hover:bg-white/[0.03]' : 'bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {notification.icon || iconForType(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${notification.read ? 'text-text-secondary' : 'text-text-primary'}`}>
                        {notification.title}
                      </p>
                      <p className="text-[11px] text-text-muted mt-0.5">{notification.message}</p>

                      {notification.actionLabel ? (
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={() => void runAction(notification)}
                            disabled={busyActionId !== null}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] text-text-primary hover:bg-white/[0.08] disabled:opacity-60"
                          >
                            {busyActionId === notification.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                            {notification.actionLabel}
                          </button>
                          {!notification.read ? (
                            <button
                              onClick={() => markRead(notification.id)}
                              className="text-[11px] text-text-muted hover:text-text-primary"
                            >
                              Mark read
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <button
                      onClick={() => dismiss(notification.id)}
                      className="shrink-0 mt-0.5 text-text-muted/30 hover:text-text-muted"
                      aria-label={`Dismiss ${notification.title}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

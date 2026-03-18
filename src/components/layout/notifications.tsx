'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, AlertTriangle, CheckCircle, Info, X, DollarSign, Zap, Users, Shield } from 'lucide-react'

interface Notification {
  id: string
  type: 'success' | 'warning' | 'info' | 'error'
  title: string
  message: string
  timestamp: Date
  read: boolean
  icon?: React.ReactNode
}

export function Notifications() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const ref = useRef<HTMLDivElement>(null)

  // Fetch notifications from various sources
  useEffect(() => {
    async function fetchNotifications() {
      const notifs: Notification[] = []

      try {
        // Check OpenRouter credits
        const costsRes = await fetch('/api/costs')
        if (costsRes.ok) {
          const costs = await costsRes.json()

          if (costs.openrouter) {
            const pctUsed = costs.openrouter.totalCredits > 0
              ? (costs.openrouter.totalUsage / costs.openrouter.totalCredits) * 100
              : 0

            if (pctUsed > 80) {
              notifs.push({
                id: 'or-credits-low',
                type: 'warning',
                title: 'OpenRouter credits low',
                message: `${(100 - pctUsed).toFixed(0)}% remaining ($${costs.openrouter.remaining.toFixed(2)} left)`,
                timestamp: new Date(),
                read: false,
                icon: <DollarSign className="w-4 h-4 text-amber-400" />,
              })
            }

            if (costs.openrouter.usageDaily > 5) {
              notifs.push({
                id: 'or-high-spend',
                type: 'info',
                title: 'High daily spend',
                message: `$${costs.openrouter.usageDaily.toFixed(2)} spent today on OpenRouter`,
                timestamp: new Date(),
                read: false,
                icon: <Zap className="w-4 h-4 text-violet-400" />,
              })
            }
          }

          // Railway overage warning
          if (costs.railway && !costs.railway.error) {
            if (costs.railway.estimated.total > costs.railway.credits) {
              notifs.push({
                id: 'railway-overage',
                type: 'warning',
                title: 'Railway over budget',
                message: `Estimated $${costs.railway.estimated.total.toFixed(2)}/mo exceeds $${costs.railway.credits}/mo credits`,
                timestamp: new Date(),
                read: false,
                icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
              })
            }
          }
        }

        // Check OpenClaw status
        const modeRes = await fetch('/api/mode')
        if (modeRes.ok) {
          const mode = await modeRes.json()
          if (mode.connected) {
            notifs.push({
              id: 'openclaw-connected',
              type: 'success',
              title: 'OpenClaw online',
              message: `Running ${mode.currentModel?.split('/').pop() || 'unknown'} in ${mode.mode} mode`,
              timestamp: new Date(),
              read: true,
              icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
            })
          } else {
            notifs.push({
              id: 'openclaw-disconnected',
              type: 'error',
              title: 'OpenClaw disconnected',
              message: 'Cannot reach the gateway',
              timestamp: new Date(),
              read: false,
              icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
            })
          }
        }

        // Check budget limits
        try {
          const budgetRes = await fetch('/api/budget')
          if (budgetRes.ok) {
            const budget = await budgetRes.json()
            if (budget.alertLevel === 'exceeded') {
              notifs.push({
                id: 'budget-exceeded',
                type: 'error',
                title: budget.throttled ? 'Budget exceeded — throttled' : 'Budget exceeded',
                message: budget.throttled
                  ? `Switched to budget mode. Daily: $${budget.spend.daily.toFixed(2)}/$${budget.budget.dailyLimit}`
                  : `Daily spend $${budget.spend.daily.toFixed(2)} exceeds $${budget.budget.dailyLimit} limit`,
                timestamp: new Date(),
                read: false,
                icon: <Shield className="w-4 h-4 text-red-400" />,
              })
            } else if (budget.alertLevel === 'critical') {
              notifs.push({
                id: 'budget-critical',
                type: 'warning',
                title: 'Near spending limit',
                message: `Daily: $${budget.spend.daily.toFixed(2)}/$${budget.budget.dailyLimit} (${budget.dailyPct.toFixed(0)}%)`,
                timestamp: new Date(),
                read: false,
                icon: <Shield className="w-4 h-4 text-orange-400" />,
              })
            } else if (budget.alertLevel === 'warning') {
              notifs.push({
                id: 'budget-warning',
                type: 'info',
                title: 'Approaching spending limit',
                message: `Daily: $${budget.spend.daily.toFixed(2)}/$${budget.budget.dailyLimit} (${budget.dailyPct.toFixed(0)}%)`,
                timestamp: new Date(),
                read: false,
                icon: <Shield className="w-4 h-4 text-amber-400" />,
              })
            }
          }
        } catch {}

        // Check activities for recent completions/failures
        const actRes = await fetch('/api/activities')
        if (actRes.ok) {
          const actData = await actRes.json()
          const recentSessions = (actData.sessions || []).slice(0, 3)
          for (const s of recentSessions) {
            if (s.status === 'FAILED') {
              notifs.push({
                id: `session-fail-${s.key}`,
                type: 'error',
                title: 'Agent session failed',
                message: s.key.replace('agent:main:', ''),
                timestamp: new Date(),
                read: false,
                icon: <Users className="w-4 h-4 text-red-400" />,
              })
            }
          }
        }
      } catch {
        // Silently fail — notifications are not critical
      }

      setNotifications(notifs)
    }

    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const unreadCount = notifications.filter(n => !n.read).length

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  function dismiss(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id))
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
      >
        <Bell className="w-[15px] h-[15px] text-text-muted" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-white/[0.08] bg-[#1a1a1e]/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[11px] text-accent-highlight hover:text-accent-highlight/80">
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-6 h-6 text-text-muted/30 mx-auto mb-2" />
                <p className="text-xs text-text-muted">No notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-white/[0.04] flex items-start gap-3 hover:bg-white/[0.03] transition-colors ${
                    !n.read ? 'bg-white/[0.02]' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {n.icon || iconForType(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${!n.read ? 'text-text-primary' : 'text-text-secondary'}`}>
                      {n.title}
                    </p>
                    <p className="text-[11px] text-text-muted mt-0.5 truncate">{n.message}</p>
                  </div>
                  <button onClick={() => dismiss(n.id)} className="shrink-0 mt-0.5 text-text-muted/30 hover:text-text-muted">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

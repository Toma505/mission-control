'use client'

import type { ReactNode } from 'react'
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  DollarSign,
  MessageSquareWarning,
} from 'lucide-react'

import type { NotificationType } from '@/lib/notifications-store'

export function getNotificationAppearance(type: NotificationType): {
  icon: ReactNode
  badgeLabel: string
  badgeClassName: string
} {
  switch (type) {
    case 'agent_complete':
      return {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
        badgeLabel: 'Agent Complete',
        badgeClassName: 'bg-emerald-400/10 text-emerald-200 border border-emerald-400/20',
      }
    case 'agent_error':
      return {
        icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
        badgeLabel: 'Agent Error',
        badgeClassName: 'bg-red-400/10 text-red-100 border border-red-400/20',
      }
    case 'agent_needs_input':
      return {
        icon: <MessageSquareWarning className="h-4 w-4 text-amber-400" />,
        badgeLabel: 'Needs Input',
        badgeClassName: 'bg-amber-400/10 text-amber-100 border border-amber-400/20',
      }
    case 'budget_alert':
      return {
        icon: <DollarSign className="h-4 w-4 text-orange-300" />,
        badgeLabel: 'Budget Alert',
        badgeClassName: 'bg-orange-300/10 text-orange-100 border border-orange-300/20',
      }
    case 'schedule_fired':
    default:
      return {
        icon: <Clock3 className="h-4 w-4 text-sky-400" />,
        badgeLabel: 'Schedule Fired',
        badgeClassName: 'bg-sky-400/10 text-sky-100 border border-sky-400/20',
      }
  }
}

export function formatNotificationTime(timestamp: string) {
  const value = new Date(timestamp)
  const deltaMs = Date.now() - value.getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (deltaMs < minute) return 'Just now'
  if (deltaMs < hour) return `${Math.max(1, Math.floor(deltaMs / minute))}m ago`
  if (deltaMs < day) return `${Math.max(1, Math.floor(deltaMs / hour))}h ago`

  return value.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function EmptyNotificationsState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-5 py-10 text-center">
      <BellRing className="mx-auto h-7 w-7 text-text-muted/35" />
      <p className="mt-3 text-sm text-text-secondary">{message}</p>
    </div>
  )
}


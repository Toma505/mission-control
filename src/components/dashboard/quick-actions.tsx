'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Archive,
  BellOff,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Loader2,
  Play,
  TriangleAlert,
} from 'lucide-react'

import { apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ActionKey =
  | 'run-last-task'
  | 'health-check-all'
  | 'generate-weekly-report'
  | 'backup-now'
  | 'check-costs-today'
  | 'clear-notifications'

type ActionResult = {
  kind: 'success' | 'error'
  message: string
}

type ScheduledRun = {
  startedAt?: string
}

type ScheduledTask = {
  id: string
  name: string
  createdAt?: string
  updatedAt?: string
  lastRunAt?: string | null
  runs?: ScheduledRun[]
}

type SchedulesResponse = {
  tasks?: ScheduledTask[]
}

type InstancesResponse = {
  instances?: Array<{
    status?: 'online' | 'offline' | 'error'
  }>
}

type CostsResponse = {
  sessionCosts?: {
    budgetStatus?: {
      daily?: {
        spent?: number
        limit?: number
      }
    }
  }
}

type NotificationsResponse = {
  unreadCount?: number
}

type ReportResponse = {
  metadata?: {
    fileName?: string
  }
}

type BackupResult = {
  ok: boolean
  fileCount?: number
  error?: string
}

type ElectronAPI = {
  createBackup?: () => Promise<BackupResult>
}

type ActionConfig = {
  key: ActionKey
  label: string
  description: string
  icon: typeof Play
  accent: string
}

const ACTIONS: ActionConfig[] = [
  {
    key: 'run-last-task',
    label: 'Run Last Task',
    description: 'Re-trigger the most recent schedule',
    icon: Play,
    accent: 'text-blue-400',
  },
  {
    key: 'health-check-all',
    label: 'Health Check All',
    description: 'Ping every instance and summarize status',
    icon: Activity,
    accent: 'text-emerald-400',
  },
  {
    key: 'generate-weekly-report',
    label: 'Generate Weekly Report',
    description: 'Create this week’s cost report',
    icon: FileText,
    accent: 'text-violet-400',
  },
  {
    key: 'backup-now',
    label: 'Backup Now',
    description: 'Create a fresh desktop backup',
    icon: Archive,
    accent: 'text-amber-400',
  },
  {
    key: 'check-costs-today',
    label: 'Check Costs Today',
    description: 'See today’s spend against budget',
    icon: CircleDollarSign,
    accent: 'text-cyan-400',
  },
  {
    key: 'clear-notifications',
    label: 'Clear Notifications',
    description: 'Mark all current alerts as read',
    icon: BellOff,
    accent: 'text-rose-400',
  },
]

function getElectronAPI(): ElectronAPI | undefined {
  return typeof window !== 'undefined'
    ? (window as Window & { electronAPI?: ElectronAPI }).electronAPI
    : undefined
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function getCurrentWeekRange() {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - now.getDay())
  start.setHours(0, 0, 0, 0)

  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

function getTaskRecency(task: ScheduledTask) {
  const candidates = [
    task.lastRunAt,
    task.runs?.[0]?.startedAt,
    task.updatedAt,
    task.createdAt,
  ].filter(Boolean)

  if (candidates.length === 0) return 0

  return Math.max(
    ...candidates.map((value) => new Date(value as string).getTime()).filter((value) => Number.isFinite(value)),
  )
}

export function QuickActions() {
  const [busy, setBusy] = useState<Partial<Record<ActionKey, boolean>>>({})
  const [results, setResults] = useState<Partial<Record<ActionKey, ActionResult>>>({})
  const clearTimersRef = useRef<Partial<Record<ActionKey, number>>>({})

  useEffect(() => {
    return () => {
      Object.values(clearTimersRef.current).forEach((timer) => {
        if (timer) window.clearTimeout(timer)
      })
    }
  }, [])

  function setActionBusy(key: ActionKey, value: boolean) {
    setBusy((current) => ({ ...current, [key]: value }))
  }

  function setActionResult(key: ActionKey, result: ActionResult) {
    const existingTimer = clearTimersRef.current[key]
    if (existingTimer) window.clearTimeout(existingTimer)

    setResults((current) => ({ ...current, [key]: result }))

    clearTimersRef.current[key] = window.setTimeout(() => {
      setResults((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
      delete clearTimersRef.current[key]
    }, 6000)
  }

  async function runAction(key: ActionKey) {
    setActionBusy(key, true)

    try {
      if (key === 'run-last-task') {
        const schedulesResponse = await fetch('/api/schedules', { cache: 'no-store' })
        const schedulesData = (await schedulesResponse.json().catch(() => ({}))) as SchedulesResponse & { error?: string }

        if (!schedulesResponse.ok) {
          throw new Error(schedulesData.error || 'Could not load scheduled tasks.')
        }

        const tasks = Array.isArray(schedulesData.tasks) ? schedulesData.tasks : []
        if (tasks.length === 0) {
          throw new Error('No scheduled tasks are available yet.')
        }

        const [latestTask] = [...tasks].sort((left, right) => getTaskRecency(right) - getTaskRecency(left))
        const runResponse = await apiFetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'runNow', id: latestTask.id }),
        })
        const runData = await runResponse.json().catch(() => ({}))

        if (!runResponse.ok || runData?.ok !== true) {
          throw new Error(runData?.error || 'Scheduled task could not be started.')
        }

        const seconds = Math.max(1, Math.round(Number(runData.run?.durationMs || 0) / 1000))
        setActionResult(key, {
          kind: 'success',
          message: `${latestTask.name} finished in ${seconds}s.`,
        })
        return
      }

      if (key === 'health-check-all') {
        const response = await fetch('/api/instances?refresh=true', { cache: 'no-store' })
        const data = (await response.json().catch(() => ({}))) as InstancesResponse & { error?: string }

        if (!response.ok) {
          throw new Error(data.error || 'Could not run health checks.')
        }

        const instances = Array.isArray(data.instances) ? data.instances : []
        if (instances.length === 0) {
          throw new Error('No instances are configured yet.')
        }

        const online = instances.filter((instance) => instance.status === 'online').length
        const attention = instances.filter((instance) => instance.status === 'offline' || instance.status === 'error').length
        setActionResult(key, {
          kind: attention > 0 ? 'error' : 'success',
          message: attention > 0
            ? `${online} online, ${attention} need attention.`
            : `All ${online} instances checked in healthy.`,
        })
        return
      }

      if (key === 'generate-weekly-report') {
        const { start, end } = getCurrentWeekRange()
        const response = await apiFetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate',
            name: `Weekly Cost Report - ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            kind: 'cost_report',
            format: 'pdf',
            granularity: 'weekly',
            dateRange: {
              start: start.toISOString(),
              end: end.toISOString(),
            },
            instanceIds: [],
            agentIds: [],
          }),
        })
        const data = (await response.json().catch(() => ({}))) as ReportResponse & { error?: string }

        if (!response.ok) {
          throw new Error(data.error || 'Weekly report generation failed.')
        }

        setActionResult(key, {
          kind: 'success',
          message: `Saved ${data.metadata?.fileName || 'weekly report'}.`,
        })
        return
      }

      if (key === 'backup-now') {
        const electronAPI = getElectronAPI()
        if (!electronAPI?.createBackup) {
          throw new Error('Backup is only available in the desktop app.')
        }

        const result = await electronAPI.createBackup()
        if (!result.ok) {
          throw new Error(result.error || 'Backup failed.')
        }

        setActionResult(key, {
          kind: 'success',
          message: `Backup complete${result.fileCount ? ` (${result.fileCount} files)` : ''}.`,
        })
        return
      }

      if (key === 'check-costs-today') {
        const response = await fetch('/api/costs', { cache: 'no-store' })
        const data = (await response.json().catch(() => ({}))) as CostsResponse & { error?: string }

        if (!response.ok) {
          throw new Error(data.error || 'Could not load today’s costs.')
        }

        const spent = Number(data.sessionCosts?.budgetStatus?.daily?.spent || 0)
        const limit = Number(data.sessionCosts?.budgetStatus?.daily?.limit || 0)
        setActionResult(key, {
          kind: 'success',
          message: limit > 0
            ? `${formatCurrency(spent)} spent today of ${formatCurrency(limit)}.`
            : `${formatCurrency(spent)} spent today.`,
        })
        return
      }

      const notificationsResponse = await fetch('/api/notifications?limit=1', { cache: 'no-store' })
      const notificationsData = (await notificationsResponse.json().catch(() => ({}))) as NotificationsResponse & {
        error?: string
      }

      if (!notificationsResponse.ok) {
        throw new Error(notificationsData.error || 'Could not load notifications.')
      }

      const unreadCount = Number(notificationsData.unreadCount || 0)
      const patchResponse = await apiFetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAllRead' }),
      })
      const patchData = await patchResponse.json().catch(() => ({}))

      if (!patchResponse.ok || patchData?.ok !== true) {
        throw new Error(patchData?.error || 'Could not clear notifications.')
      }

      setActionResult(key, {
        kind: 'success',
        message: unreadCount > 0
          ? `Marked ${unreadCount} notifications as read.`
          : 'Notifications were already clear.',
      })
    } catch (error) {
      setActionResult(key, {
        kind: 'error',
        message: error instanceof Error ? error.message : 'Action failed.',
      })
    } finally {
      setActionBusy(key, false)
    }
  }

  const renderedActions = useMemo(() => ACTIONS, [])

  return (
    <Card className="p-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-[14px]">Quick Actions</CardTitle>
        <p className="text-[11px] text-text-muted">
          Kick off the dashboard actions you use most without leaving this page.
        </p>
      </CardHeader>
      <CardContent className="pt-1 space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {renderedActions.map((action) => {
            const Icon = action.icon
            const isBusy = busy[action.key] === true
            const result = results[action.key]

            return (
              <div
                key={action.key}
                className="rounded-[14px] border border-white/[0.06] bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.045]"
              >
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => void runAction(action.key)}
                  disabled={isBusy}
                  className="h-auto w-full justify-start px-0 py-0 text-left hover:bg-transparent"
                >
                  <div className="flex w-full items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.05]">
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin text-text-primary" />
                      ) : (
                        <Icon className={`h-4 w-4 ${action.accent}`} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-text-primary">{action.label}</div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
                        {action.description}
                      </p>
                    </div>
                  </div>
                </Button>

                {result ? (
                  <div
                    className={`mt-3 flex items-start gap-2 rounded-[10px] border px-2.5 py-2 text-[11px] ${
                      result.kind === 'success'
                        ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                        : 'border-red-400/20 bg-red-400/10 text-red-300'
                    }`}
                  >
                    {result.kind === 'success' ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{result.message}</span>
                  </div>
                ) : (
                  <div className="mt-3 text-[11px] text-text-muted/60">
                    {isBusy ? 'Working...' : 'Ready'}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

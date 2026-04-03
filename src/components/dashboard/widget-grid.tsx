'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import {
  Activity,
  BarChart3,
  Bot,
  DollarSign,
  GripVertical,
  type LucideIcon,
  LayoutGrid,
  Loader2,
  Plus,
  RotateCcw,
  Server,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'

import { apiFetch } from '@/lib/api-client'
import type { DashboardLayout, DashboardWidgetId, Settings } from '@/lib/app-settings'
import { cn } from '@/lib/utils'

type DashboardMode = {
  mode: string
  currentModel: string
  connected: boolean
}

type DashboardStatus = {
  value?: string
  subtitle?: string
  online?: boolean
  heartbeat?: string
  memory?: string
  version?: string
}

type DashboardSession = {
  key: string
  model: string
  tokens: string
  age: string
}

type DashboardChannel = {
  name: string
  state: string
}

type DashboardActivity = {
  id: string
  type: string
  title: string
  description?: string
  status: string
  timestamp: string
}

type DashboardGridProps = {
  connected: boolean
  status: DashboardStatus | null
  sessions: DashboardSession[]
  channels: DashboardChannel[]
  activities: DashboardActivity[]
  mode: DashboardMode
  initialSettings: Settings
}

type WidgetDefinition = {
  id: DashboardWidgetId
  title: string
  description: string
  icon: LucideIcon
}

type DropTarget = {
  id: DashboardWidgetId
  position: 'before' | 'after'
}

type CostSummary = {
  openrouterRemaining: number
  openrouterTotal: number
  dailySpend: number
  pctUsed: number
  dailyLimit: number
  alertLevel: string
}

const DEFAULT_WIDGET_ORDER: DashboardWidgetId[] = [
  'status-overview',
  'active-sessions',
  'cost-summary',
  'quick-actions',
  'recent-activity',
  'instance-health',
]

const DEFAULT_LAYOUT: Required<DashboardLayout> = {
  order: DEFAULT_WIDGET_ORDER,
  hidden: [],
}

const WIDGETS: WidgetDefinition[] = [
  {
    id: 'status-overview',
    title: 'Status Overview',
    description: 'Top-level system status, mode, channels, and session count.',
    icon: Activity,
  },
  {
    id: 'active-sessions',
    title: 'Active Sessions',
    description: 'Current agent and channel work in flight.',
    icon: Bot,
  },
  {
    id: 'cost-summary',
    title: 'Cost Summary',
    description: 'Credits, spend, and budget pressure at a glance.',
    icon: DollarSign,
  },
  {
    id: 'quick-actions',
    title: 'Quick Actions',
    description: 'Jump into the main operational views with one click.',
    icon: Sparkles,
  },
  {
    id: 'recent-activity',
    title: 'Recent Activity',
    description: 'Latest system events and agent outcomes.',
    icon: Zap,
  },
  {
    id: 'instance-health',
    title: 'Instance Health',
    description: 'Heartbeat, memory, channels, and live connection details.',
    icon: Server,
  },
]

function normalizeLayout(layout: DashboardLayout | undefined): Required<DashboardLayout> {
  const order = Array.isArray(layout?.order)
    ? [...new Set(layout.order.filter((id): id is DashboardWidgetId => DEFAULT_WIDGET_ORDER.includes(id)))]
    : []
  const hidden = Array.isArray(layout?.hidden)
    ? [...new Set(layout.hidden.filter((id): id is DashboardWidgetId => DEFAULT_WIDGET_ORDER.includes(id)))]
    : []

  return {
    order: [...order, ...DEFAULT_WIDGET_ORDER.filter((id) => !order.includes(id))],
    hidden,
  }
}

function layoutsEqual(left: Required<DashboardLayout>, right: Required<DashboardLayout>) {
  return (
    left.order.length === right.order.length &&
    left.hidden.length === right.hidden.length &&
    left.order.every((value, index) => value === right.order[index]) &&
    left.hidden.every((value, index) => value === right.hidden[index])
  )
}

function formatTimeAgo(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.max(Math.floor(diffMs / 60_000), 0)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function createDragGhost(source: HTMLElement) {
  const ghost = source.cloneNode(true) as HTMLElement
  ghost.style.position = 'fixed'
  ghost.style.top = '-1000px'
  ghost.style.left = '-1000px'
  ghost.style.width = `${source.offsetWidth}px`
  ghost.style.opacity = '0.94'
  ghost.style.pointerEvents = 'none'
  ghost.style.transform = 'rotate(1deg)'
  ghost.style.boxShadow = '0 18px 50px rgba(0, 0, 0, 0.35)'
  document.body.appendChild(ghost)
  return ghost
}

function getWidget(id: DashboardWidgetId) {
  return WIDGETS.find((widget) => widget.id === id)!
}

function WidgetFrame({
  title,
  description,
  icon: Icon,
  dragging,
  dropBefore,
  dropAfter,
  onHide,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  children,
}: {
  title: string
  description: string
  icon: LucideIcon
  dragging: boolean
  dropBefore: boolean
  dropAfter: boolean
  onHide: () => void
  onDragStart: (event: DragEvent<HTMLDivElement>) => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
  children: ReactNode
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'group/widget relative rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)] transition-all duration-200',
        dragging && 'scale-[0.985] opacity-55',
      )}
    >
      {dropBefore ? <div className="absolute left-4 right-4 top-0 h-[2px] rounded-full bg-accent-primary" /> : null}

      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/[0.05] text-accent-primary">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <GripVertical className="h-3.5 w-3.5 text-text-muted/70 opacity-0 transition-opacity group-hover/widget:opacity-100" />
              <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
            </div>
            <p className="mt-1 text-xs text-text-muted">{description}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onHide}
          className="rounded-xl p-2 text-text-muted transition hover:bg-white/[0.06] hover:text-text-primary"
          aria-label={`Hide ${title}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {children}

      {dropAfter ? <div className="absolute left-4 right-4 bottom-0 h-[2px] rounded-full bg-accent-primary" /> : null}
    </div>
  )
}

function StatusOverviewContent({
  connected,
  status,
  mode,
  channels,
  sessions,
}: Pick<DashboardGridProps, 'connected' | 'status' | 'mode' | 'channels' | 'sessions'>) {
  const modeLabel = mode.mode ? `${mode.mode[0].toUpperCase()}${mode.mode.slice(1)}` : 'Unknown'
  const cards = [
    { label: 'Status', value: status?.value || 'Unknown', subtitle: status?.subtitle || (connected ? 'Connected' : 'Disconnected'), dot: status?.online ? 'bg-emerald-400' : 'bg-red-400' },
    { label: 'AI Mode', value: modeLabel, subtitle: mode.currentModel?.split('/').pop() || 'Not configured', dot: connected ? 'bg-sky-400' : 'bg-text-muted' },
    { label: 'Channels', value: String(channels.length), subtitle: channels.length ? channels.map((channel) => channel.name).join(', ') : 'No channels configured', dot: channels.some((channel) => channel.state === 'OK') ? 'bg-emerald-400' : 'bg-text-muted' },
    { label: 'Sessions', value: String(sessions.length), subtitle: sessions.length ? 'Active agent sessions' : 'No active sessions', dot: sessions.length ? 'bg-accent-primary' : 'bg-text-muted' },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', card.dot)} />
            <span className="text-[10px] uppercase tracking-[0.12em] text-text-muted">{card.label}</span>
          </div>
          <div className="text-lg font-semibold text-text-primary">{card.value}</div>
          <p className="mt-1 text-xs text-text-secondary">{card.subtitle}</p>
        </div>
      ))}
    </div>
  )
}

function ActiveSessionsContent({ sessions }: Pick<DashboardGridProps, 'sessions'>) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-white/[0.02] px-4 py-8 text-center text-sm text-text-muted">
        No active sessions right now.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sessions.map((session, index) => (
        <div key={`${session.key}-${index}`} className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">
              {session.key.includes('channel:')
                ? 'Discord Channel'
                : session.key === 'agent:main:main'
                  ? 'Main Agent'
                  : session.key.includes('subagent:')
                    ? `Sub-agent: ${session.key.split(':').pop()}`
                    : 'Discord DM'}
            </p>
            <p className="mt-1 text-xs text-text-muted">{[session.model, session.tokens].filter(Boolean).join(' - ')}</p>
          </div>
          <span className="whitespace-nowrap text-xs text-text-muted">{session.age}</span>
        </div>
      ))}
    </div>
  )
}

function CostSummaryContent() {
  const [summary, setSummary] = useState<CostSummary | null>(null)

  useEffect(() => {
    let active = true

    async function loadCosts() {
      try {
        const [costResponse, budgetResponse] = await Promise.all([
          fetch('/api/costs', { cache: 'no-store' }),
          fetch('/api/budget', { cache: 'no-store' }),
        ])

        const costs = costResponse.ok ? await costResponse.json() : {}
        const budget = budgetResponse.ok ? await budgetResponse.json() : {}
        if (!active || !costs.openrouter) return

        const pctUsed =
          costs.openrouter.totalCredits > 0
            ? (costs.openrouter.totalUsage / costs.openrouter.totalCredits) * 100
            : 0

        setSummary({
          openrouterRemaining: costs.openrouter.remaining,
          openrouterTotal: costs.openrouter.totalCredits,
          dailySpend: costs.openrouter.usageDaily,
          pctUsed,
          dailyLimit: budget.budget?.dailyLimit ?? 5,
          alertLevel: budget.alertLevel ?? 'ok',
        })
      } catch {
        if (active) setSummary(null)
      }
    }

    void loadCosts()
    const interval = setInterval(() => void loadCosts(), 30_000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  if (!summary) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading cost data...
      </div>
    )
  }

  const alertTone =
    summary.alertLevel === 'exceeded'
      ? 'text-red-400'
      : summary.alertLevel === 'critical'
        ? 'text-orange-400'
        : summary.alertLevel === 'warning'
          ? 'text-amber-400'
          : 'text-emerald-400'

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4">
          <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">OpenRouter Remaining</div>
          <div className="mt-2 text-2xl font-semibold text-text-primary">${summary.openrouterRemaining.toFixed(2)}</div>
          <p className="mt-1 text-xs text-text-muted">${summary.openrouterTotal.toFixed(2)} total credits</p>
        </div>
        <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4">
          <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">Today's Spend</div>
          <div className={cn('mt-2 text-2xl font-semibold', alertTone)}>${summary.dailySpend.toFixed(2)}</div>
          <p className="mt-1 text-xs text-text-muted">Daily limit ${summary.dailyLimit.toFixed(2)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-text-secondary">
          <span>Credits used</span>
          <span>{summary.pctUsed.toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.06]">
          <div
            className="h-2 rounded-full bg-accent-primary transition-all"
            style={{ width: `${Math.min(summary.pctUsed, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function QuickActionsContent() {
  const actions = [
    { name: 'Operations', description: 'Pipeline jobs', href: '/operations', icon: Sparkles },
    { name: 'Costs', description: 'Spend tracking', href: '/costs', icon: DollarSign },
    { name: 'API Usage', description: 'Token breakdown', href: '/api-usage', icon: BarChart3 },
    { name: 'Agents', description: 'Model config', href: '/agents', icon: Bot },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {actions.map((action) => (
        <Link
          key={action.name}
          href={action.href}
          className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
        >
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/[0.05] text-accent-primary">
            <action.icon className="h-4.5 w-4.5" />
          </div>
          <p className="text-sm font-medium text-text-primary">{action.name}</p>
          <p className="mt-1 text-xs text-text-muted">{action.description}</p>
        </Link>
      ))}
    </div>
  )
}

function RecentActivityContent({ activities }: Pick<DashboardGridProps, 'activities'>) {
  if (activities.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-white/[0.02] px-4 py-8 text-center text-sm text-text-muted">
        No recent activity yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activities.slice(0, 6).map((activity) => (
        <div key={activity.id} className="flex items-start gap-3 rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3">
          <div
            className={cn(
              'mt-[7px] h-[8px] w-[8px] shrink-0 rounded-full',
              activity.status === 'COMPLETED'
                ? 'bg-emerald-400'
                : activity.status === 'IN_PROGRESS'
                  ? 'animate-pulse bg-amber-400'
                  : activity.status === 'FAILED'
                    ? 'bg-red-400'
                    : 'bg-accent-primary',
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-primary">{activity.title}</p>
            {activity.description ? (
              <p className="mt-1 text-xs leading-relaxed text-text-muted">{activity.description}</p>
            ) : null}
          </div>
          <span className="whitespace-nowrap text-xs text-text-muted">{formatTimeAgo(activity.timestamp)}</span>
        </div>
      ))}
    </div>
  )
}

function InstanceHealthContent({
  connected,
  status,
  channels,
  mode,
}: Pick<DashboardGridProps, 'connected' | 'status' | 'channels' | 'mode'>) {
  const memory = status?.memory || ''
  const checks = [
    { label: 'Connection', value: connected ? 'Connected' : 'Offline' },
    { label: 'Heartbeat', value: status?.heartbeat || 'N/A' },
    { label: 'Memory', value: memory.split('-')[0]?.trim() || memory || 'N/A' },
    { label: 'Channels OK', value: String(channels.filter((channel) => channel.state === 'OK').length) },
    { label: 'Mode', value: mode.mode || 'unknown' },
    { label: 'Version', value: status?.version || 'Unknown' },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {checks.map((check) => (
        <div key={check.label} className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">{check.label}</div>
          <div className="mt-2 text-sm font-medium text-text-primary">{check.value}</div>
        </div>
      ))}
    </div>
  )
}

export function WidgetGrid({
  connected,
  status,
  sessions,
  channels,
  activities,
  mode,
  initialSettings,
}: DashboardGridProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [layout, setLayout] = useState<Required<DashboardLayout>>(normalizeLayout(initialSettings.dashboardLayout))
  const [showPicker, setShowPicker] = useState(false)
  const [draggingId, setDraggingId] = useState<DashboardWidgetId | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const dragGhostRef = useRef<HTMLElement | null>(null)

  const visibleWidgets = useMemo(
    () => layout.order.filter((id) => !layout.hidden.includes(id)),
    [layout],
  )
  const hiddenWidgets = useMemo(
    () => DEFAULT_WIDGET_ORDER.filter((id) => layout.hidden.includes(id)),
    [layout.hidden],
  )
  const isCustomLayout = useMemo(() => !layoutsEqual(layout, DEFAULT_LAYOUT), [layout])

  useEffect(() => {
    if (!message) return
    const timeout = setTimeout(() => setMessage(null), 2600)
    return () => clearTimeout(timeout)
  }, [message])

  async function persistLayout(nextLayout: Required<DashboardLayout>, previousLayout: Required<DashboardLayout>) {
    setSaving(true)

    try {
      const response = await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          dashboardLayout: nextLayout,
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || 'Could not save dashboard layout.')
      }

      const nextSettings = payload?.settings as Settings
      setSettings(nextSettings)
      setLayout(normalizeLayout(nextSettings.dashboardLayout))
      setMessage({ tone: 'success', text: 'Dashboard layout saved.' })
    } catch (error) {
      setLayout(previousLayout)
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not save dashboard layout.',
      })
    } finally {
      setSaving(false)
    }
  }

  function updateLayout(nextLayout: Required<DashboardLayout>) {
    const previousLayout = layout
    setLayout(nextLayout)
    void persistLayout(nextLayout, previousLayout)
  }

  function hideWidget(id: DashboardWidgetId) {
    if (layout.hidden.includes(id)) return
    updateLayout({ ...layout, hidden: [...layout.hidden, id] })
  }

  function addWidget(id: DashboardWidgetId) {
    if (!layout.hidden.includes(id)) return
    setShowPicker(false)
    updateLayout({ ...layout, hidden: layout.hidden.filter((entry) => entry !== id) })
  }

  function resetLayout() {
    setShowPicker(false)
    updateLayout({ order: [...DEFAULT_WIDGET_ORDER], hidden: [] })
  }

  function handleDragStart(id: DashboardWidgetId, event: DragEvent<HTMLDivElement>) {
    setDraggingId(id)
    setDropTarget(null)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
    const ghost = createDragGhost(event.currentTarget)
    dragGhostRef.current = ghost
    event.dataTransfer.setDragImage(ghost, 24, 24)
  }

  function handleDragOver(id: DashboardWidgetId, event: DragEvent<HTMLDivElement>) {
    if (!draggingId || draggingId === id) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const bounds = event.currentTarget.getBoundingClientRect()
    const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
    setDropTarget({ id, position })
  }

  function handleDrop(id: DashboardWidgetId, event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!draggingId) return

    const withoutDragged = visibleWidgets.filter((widgetId) => widgetId !== draggingId)
    const targetIndex = withoutDragged.indexOf(id)
    if (targetIndex === -1) {
      handleDragEnd()
      return
    }

    const insertIndex = dropTarget?.id === id && dropTarget.position === 'after' ? targetIndex + 1 : targetIndex
    const reorderedVisible = [...withoutDragged]
    reorderedVisible.splice(insertIndex, 0, draggingId)

    updateLayout({
      ...layout,
      order: [...reorderedVisible, ...layout.order.filter((widgetId) => layout.hidden.includes(widgetId))],
    })
    handleDragEnd()
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDropTarget(null)
    if (dragGhostRef.current) {
      dragGhostRef.current.remove()
      dragGhostRef.current = null
    }
  }

  function renderWidget(id: DashboardWidgetId) {
    switch (id) {
      case 'status-overview':
        return <StatusOverviewContent connected={connected} status={status} mode={mode} channels={channels} sessions={sessions} />
      case 'active-sessions':
        return <ActiveSessionsContent sessions={sessions} />
      case 'cost-summary':
        return <CostSummaryContent />
      case 'quick-actions':
        return <QuickActionsContent />
      case 'recent-activity':
        return <RecentActivityContent activities={activities} />
      case 'instance-health':
        return <InstanceHealthContent connected={connected} status={status} channels={channels} mode={mode} />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">
            <LayoutGrid className="h-3.5 w-3.5 text-accent-primary" />
            Custom Dashboard
          </div>
          <h2 className="text-lg font-semibold text-text-primary">Arrange your widget layout</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Drag cards to reorder them, hide the ones you do not need, and bring them back anytime.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPicker((current) => !current)}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-white/[0.1]"
            >
              <Plus className="h-4 w-4" />
              Add Widget
            </button>

            {showPicker ? (
              <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl border border-[var(--glass-border)] bg-[var(--background-card)]/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
                {hiddenWidgets.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-text-muted">All widgets are already visible.</div>
                ) : (
                  <div className="space-y-2">
                    {hiddenWidgets.map((id) => {
                      const widget = getWidget(id)
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => addWidget(id)}
                          className="flex w-full items-start gap-3 rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-3 py-3 text-left transition hover:bg-white/[0.06]"
                        >
                          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05] text-accent-primary">
                            <widget.icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-text-primary">{widget.title}</div>
                            <div className="mt-1 text-xs text-text-muted">{widget.description}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {isCustomLayout ? (
            <button
              type="button"
              onClick={resetLayout}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-white/[0.1]"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Layout
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <div
          className={cn(
            'rounded-2xl border px-4 py-3 text-sm',
            message.tone === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
              : 'border-red-500/20 bg-red-500/10 text-red-100',
          )}
        >
          {saving ? 'Saving dashboard layout...' : message.text}
        </div>
      ) : null}

      {visibleWidgets.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--glass-border)] bg-white/[0.03] px-6 py-16 text-center">
          <LayoutGrid className="mx-auto h-10 w-10 text-text-muted/40" />
          <h3 className="mt-4 text-lg font-semibold text-text-primary">No widgets visible</h3>
          <p className="mt-2 text-sm text-text-muted">
            Add one back from the widget picker, or reset to the default dashboard layout.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-white/[0.1]"
            >
              <Plus className="h-4 w-4" />
              Add Widget
            </button>
            <button
              type="button"
              onClick={resetLayout}
              className="inline-flex items-center gap-2 rounded-2xl bg-accent-primary px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Layout
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {visibleWidgets.map((id) => {
            const widget = getWidget(id)
            return (
              <WidgetFrame
                key={id}
                title={widget.title}
                description={widget.description}
                icon={widget.icon}
                dragging={draggingId === id}
                dropBefore={dropTarget?.id === id && dropTarget.position === 'before'}
                dropAfter={dropTarget?.id === id && dropTarget.position === 'after'}
                onHide={() => hideWidget(id)}
                onDragStart={(event) => handleDragStart(id, event)}
                onDragOver={(event) => handleDragOver(id, event)}
                onDrop={(event) => handleDrop(id, event)}
                onDragEnd={handleDragEnd}
              >
                {renderWidget(id)}
              </WidgetFrame>
            )
          })}
        </div>
      )}
    </div>
  )
}

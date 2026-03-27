'use client'

import { type ReactNode, useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  Clock3,
  DollarSign,
  Plus,
  RefreshCcw,
  Save,
  Server,
  Trash2,
  Wallet,
  Zap,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { formatTokens, formatUsd } from '@/lib/format'
import { useSettings } from '@/contexts/settings-context'

type ViewMode = 'daily' | 'weekly' | 'monthly'

type CostEntry = {
  id: string
  instanceId: string
  agentId: string
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
  timestamp: string
  taskDescription: string
}

type ModelRate = {
  input: number
  output: number
}

type BudgetStatus = {
  label: ViewMode
  limit: number
  spent: number
  percentage: number
  status: 'ok' | 'warning' | 'exceeded'
  warningThreshold: number
}

type CostSettings = {
  budgets: {
    daily: number
    weekly: number
    monthly: number
    warningThreshold: number
  }
  modelRates: Record<string, ModelRate>
  updatedAt: string
}

type CostPayload = {
  openrouter?: {
    usageDaily?: number
    usageWeekly?: number
    usageMonthly?: number
  } | null
  railway?: {
    estimated?: {
      total?: number
    }
  } | null
  sessionCosts: {
    settings: CostSettings
    entries: CostEntry[]
    summary: {
      totalInputTokens: number
      totalOutputTokens: number
      totalTokens: number
      totalCost: number
      activeAgents: number
      activeInstances: number
      latestEntryAt: string | null
    }
    budgetStatus: Record<ViewMode, BudgetStatus>
  }
}

type RateDraft = {
  id: string
  model: string
  input: string
  output: string
}

function createRateDrafts(modelRates: Record<string, ModelRate>): RateDraft[] {
  return Object.entries(modelRates).map(([model, rate], index) => ({
    id: `rate-${index}-${model}`,
    model,
    input: String(rate.input),
    output: String(rate.output),
  }))
}

function getViewWindowDays(view: ViewMode) {
  if (view === 'daily') return 1
  if (view === 'weekly') return 7
  return 30
}

function filterEntriesForView(entries: CostEntry[], view: ViewMode) {
  const cutoff = Date.now() - getViewWindowDays(view) * 24 * 60 * 60 * 1000
  return entries.filter((entry) => new Date(entry.timestamp).getTime() >= cutoff)
}

function buildChartData(entries: CostEntry[], view: ViewMode) {
  if (view === 'daily') {
    const start = new Date()
    start.setMinutes(0, 0, 0)
    start.setHours(start.getHours() - 23)

    return Array.from({ length: 24 }, (_, index) => {
      const bucketStart = new Date(start.getTime() + index * 60 * 60 * 1000)
      const bucketEnd = new Date(bucketStart.getTime() + 60 * 60 * 1000)
      const bucketEntries = entries.filter((entry) => {
        const time = new Date(entry.timestamp).getTime()
        return time >= bucketStart.getTime() && time < bucketEnd.getTime()
      })
      const inputTokens = bucketEntries.reduce((sum, entry) => sum + entry.inputTokens, 0)
      const outputTokens = bucketEntries.reduce((sum, entry) => sum + entry.outputTokens, 0)
      return {
        label: bucketStart.toLocaleTimeString([], { hour: 'numeric' }),
        cost: Number(bucketEntries.reduce((sum, entry) => sum + entry.cost, 0).toFixed(4)),
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      }
    })
  }

  const bucketCount = view === 'weekly' ? 7 : 30
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (bucketCount - 1))

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(start)
    bucketStart.setDate(start.getDate() + index)
    const bucketEnd = new Date(bucketStart)
    bucketEnd.setDate(bucketStart.getDate() + 1)
    const bucketEntries = entries.filter((entry) => {
      const time = new Date(entry.timestamp).getTime()
      return time >= bucketStart.getTime() && time < bucketEnd.getTime()
    })
    const inputTokens = bucketEntries.reduce((sum, entry) => sum + entry.inputTokens, 0)
    const outputTokens = bucketEntries.reduce((sum, entry) => sum + entry.outputTokens, 0)

    return {
      label: bucketStart.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      cost: Number(bucketEntries.reduce((sum, entry) => sum + entry.cost, 0).toFixed(4)),
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    }
  })
}

function buildBreakdown(entries: CostEntry[], key: 'agentId' | 'instanceId') {
  const map = new Map<string, { id: string; sessions: number; cost: number; totalTokens: number; models: Set<string> }>()

  for (const entry of entries) {
    const current = map.get(entry[key]) || {
      id: entry[key],
      sessions: 0,
      cost: 0,
      totalTokens: 0,
      models: new Set<string>(),
    }
    current.sessions += 1
    current.cost += entry.cost
    current.totalTokens += entry.inputTokens + entry.outputTokens
    current.models.add(entry.model)
    map.set(entry[key], current)
  }

  return Array.from(map.values())
    .map((entry) => ({
      id: entry.id,
      sessions: entry.sessions,
      cost: Number(entry.cost.toFixed(4)),
      totalTokens: entry.totalTokens,
      models: Array.from(entry.models),
    }))
    .sort((left, right) => right.cost - left.cost)
}

function getStatusClasses(status: BudgetStatus['status']) {
  if (status === 'exceeded') return { badge: 'bg-red-500/15 text-red-300 border-red-500/30', border: 'border-red-500/30' }
  if (status === 'warning') return { badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30', border: 'border-amber-500/30' }
  return { badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20', border: 'border-emerald-500/20' }
}

function summarizeCurrentEntries(entries: CostEntry[]) {
  const inputTokens = entries.reduce((sum, entry) => sum + entry.inputTokens, 0)
  const outputTokens = entries.reduce((sum, entry) => sum + entry.outputTokens, 0)
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    totalCost: entries.reduce((sum, entry) => sum + entry.cost, 0),
  }
}

function viewLabel(view: ViewMode) {
  if (view === 'daily') return 'Daily'
  if (view === 'weekly') return 'Weekly'
  return 'Monthly'
}

export function CostDashboard() {
  const { settings: appSettings } = useSettings()
  const [data, setData] = useState<CostPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<ViewMode>('weekly')
  const [budgets, setBudgets] = useState({ daily: '25', weekly: '150', monthly: '500' })
  const [rateDrafts, setRateDrafts] = useState<RateDraft[]>([])
  const [settingsDirty, setSettingsDirty] = useState(false)

  async function loadData() {
    try {
      const response = await fetch('/api/costs', { cache: 'no-store' })
      if (!response.ok) throw new Error('Could not load cost data')
      const nextData = (await response.json()) as CostPayload
      setData(nextData)
      setError(null)
      if (!settingsDirty) {
        setBudgets({
          daily: String(nextData.sessionCosts.settings.budgets.daily),
          weekly: String(nextData.sessionCosts.settings.budgets.weekly),
          monthly: String(nextData.sessionCosts.settings.budgets.monthly),
        })
        setRateDrafts(createRateDrafts(nextData.sessionCosts.settings.modelRates))
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load cost data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      void loadData()
    }, appSettings.refreshInterval * 1000)

    return () => clearInterval(interval)
  }, [appSettings.refreshInterval, settingsDirty])

  async function saveSettings() {
    setSaving(true)
    try {
      const modelRates = rateDrafts.reduce<Record<string, ModelRate>>((acc, draft) => {
        const model = draft.model.trim().toLowerCase()
        const input = Number(draft.input)
        const output = Number(draft.output)
        if (!model || !Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) {
          return acc
        }
        acc[model] = { input, output }
        return acc
      }, {})

      const response = await apiFetch('/api/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateSettings',
          settings: {
            budgets: {
              daily: Number(budgets.daily),
              weekly: Number(budgets.weekly),
              monthly: Number(budgets.monthly),
              warningThreshold: data?.sessionCosts.settings.budgets.warningThreshold ?? 80,
            },
            modelRates,
          },
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Could not save settings' }))
        throw new Error(payload.error || 'Could not save settings')
      }

      setSettingsDirty(false)
      await loadData()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-center py-12 text-text-muted">
          <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
          Loading cost dashboard...
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-text-primary">Cost data is unavailable</p>
            <p className="text-xs text-text-muted">{error || 'Try reloading the dashboard.'}</p>
          </div>
          <button
            onClick={() => void loadData()}
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-text-primary transition hover:bg-white/[0.08]"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }

  const filteredEntries = filterEntriesForView(data.sessionCosts.entries, view)
  const chartData = buildChartData(filteredEntries, view)
  const perAgent = buildBreakdown(filteredEntries, 'agentId')
  const perInstance = buildBreakdown(filteredEntries, 'instanceId')
  const currentBudget = data.sessionCosts.budgetStatus[view]
  const currentBudgetStyles = getStatusClasses(currentBudget.status)
  const currentSummary = summarizeCurrentEntries(filteredEntries)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-text-primary">Cost Dashboard</h1>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${currentBudgetStyles.badge}`}>
              {currentBudget.status === 'exceeded'
                ? 'Hard alert'
                : currentBudget.status === 'warning'
                  ? 'Approaching budget'
                  : 'Within budget'}
            </span>
          </div>
          <p className="mt-2 text-sm text-text-secondary">
            Real-time session usage, token spend, and budget pacing across agents and instances.
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Polling every {appSettings.refreshInterval}s | last event {data.sessionCosts.summary.latestEntryAt
              ? new Date(data.sessionCosts.summary.latestEntryAt).toLocaleString()
              : 'not available'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['daily', 'weekly', 'monthly'] as ViewMode[]).map((option) => (
            <button
              key={option}
              onClick={() => setView(option)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                view === option
                  ? 'border-[var(--accent-primary,#3b82f6)]/30 bg-[var(--accent-primary,#3b82f6)]/15 text-text-primary'
                  : 'border-white/[0.06] bg-white/[0.04] text-text-secondary hover:bg-white/[0.08]'
              }`}
            >
              {viewLabel(option)}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<DollarSign className="h-5 w-5 text-emerald-300" />}
          label={`${viewLabel(view)} spend`}
          value={formatUsd(currentSummary.totalCost)}
          detail={`${filteredEntries.length} sessions in range`}
        />
        <MetricCard
          icon={<Zap className="h-5 w-5 text-sky-300" />}
          label="Total tokens"
          value={formatTokens(currentSummary.totalTokens)}
          detail={`${formatTokens(currentSummary.inputTokens)} in / ${formatTokens(currentSummary.outputTokens)} out`}
        />
        <MetricCard
          icon={<Activity className="h-5 w-5 text-violet-300" />}
          label="Active agents"
          value={String(new Set(filteredEntries.map((entry) => entry.agentId)).size)}
          detail={`${data.sessionCosts.summary.activeAgents} tracked overall`}
        />
        <MetricCard
          icon={<Server className="h-5 w-5 text-amber-300" />}
          label="Instances"
          value={String(new Set(filteredEntries.map((entry) => entry.instanceId)).size)}
          detail={`${data.sessionCosts.summary.activeInstances} tracked overall`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {(['daily', 'weekly', 'monthly'] as ViewMode[]).map((key) => {
          const status = data.sessionCosts.budgetStatus[key]
          const styles = getStatusClasses(status.status)
          return (
            <div key={key} className={`glass rounded-2xl border ${styles.border} p-5`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{viewLabel(key)} budget</p>
                  <p className="mt-2 text-2xl font-semibold text-text-primary">{formatUsd(status.spent)}</p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[11px] font-medium ${styles.badge}`}>
                  {status.percentage}%
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className={`h-full rounded-full ${
                    status.status === 'exceeded'
                      ? 'bg-red-400'
                      : status.status === 'warning'
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(status.percentage, 100)}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-text-secondary">
                Limit {formatUsd(status.limit)} | warning at {status.warningThreshold}%
              </p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Spend trend</h2>
            <p className="text-xs text-text-muted">{viewLabel(view)} cost movement over time</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} tickFormatter={(value: number) => `$${value.toFixed(2)}`} />
                <Tooltip
                  contentStyle={{ background: 'rgba(10, 10, 12, 0.92)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, color: '#ececef' }}
                  formatter={(value: number | string | readonly (string | number)[] | undefined) =>
                    formatUsd(Number(Array.isArray(value) ? value[0] || 0 : value || 0))
                  }
                />
                <Legend />
                <Line type="monotone" dataKey="cost" stroke="var(--accent-primary,#3b82f6)" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 5 }} name="Cost" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Token flow</h2>
            <p className="text-xs text-text-muted">Input vs output tokens for the selected range</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} tickFormatter={(value: number) => formatTokens(Number(value))} />
                <Tooltip
                  contentStyle={{ background: 'rgba(10, 10, 12, 0.92)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, color: '#ececef' }}
                  formatter={(value: number | string | readonly (string | number)[] | undefined, name: string | number | undefined) => [
                    formatTokens(Number(Array.isArray(value) ? value[0] || 0 : value || 0)),
                    String(name || ''),
                  ]}
                />
                <Legend />
                <Bar dataKey="inputTokens" stackId="tokens" fill="rgba(56, 189, 248, 0.85)" radius={[6, 6, 0, 0]} name="Input" />
                <Bar dataKey="outputTokens" stackId="tokens" fill="rgba(168, 85, 247, 0.85)" radius={[6, 6, 0, 0]} name="Output" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <BreakdownCard
          title="Per-agent breakdown"
          subtitle={`Top agents in the ${viewLabel(view).toLowerCase()} window`}
          rows={perAgent}
        />
        <BreakdownCard
          title="Per-instance breakdown"
          subtitle={`Instance spend and token usage for the ${viewLabel(view).toLowerCase()} window`}
          rows={perInstance}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="glass rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Session activity</h2>
              <p className="text-xs text-text-muted">Latest agent usage entries with input, output, and total tokens</p>
            </div>
            <div className="text-xs text-text-muted">
              <Clock3 className="mr-1 inline h-3.5 w-3.5" />
              Live from <code className="rounded bg-white/[0.06] px-1.5 py-0.5">data/costs.json</code>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
            <div className="grid grid-cols-[1.1fr_0.9fr_0.7fr_0.7fr_0.7fr_0.7fr] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-text-muted">
              <span>Session</span>
              <span>Model</span>
              <span>Input</span>
              <span>Output</span>
              <span>Total</span>
              <span>Cost</span>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {data.sessionCosts.entries.slice(0, 10).map((entry) => (
                <div key={entry.id} className="grid grid-cols-[1.1fr_0.9fr_0.7fr_0.7fr_0.7fr_0.7fr] items-center px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text-primary">{entry.taskDescription}</p>
                    <p className="truncate text-xs text-text-muted">
                      {entry.agentId} | {entry.instanceId} | {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span className="truncate text-text-secondary">{entry.model}</span>
                  <span className="text-text-secondary">{formatTokens(entry.inputTokens)}</span>
                  <span className="text-text-secondary">{formatTokens(entry.outputTokens)}</span>
                  <span className="text-text-primary">{formatTokens(entry.inputTokens + entry.outputTokens)}</span>
                  <span className="font-medium text-emerald-300">{formatUsd(entry.cost)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Pricing settings</h2>
              <p className="text-xs text-text-muted">
                Configure per-model input/output rates and dashboard budgets. Rates are stored with the dashboard data.
              </p>
            </div>
            <button
              onClick={() => {
                setRateDrafts((current) => [
                  ...current,
                  { id: `rate-${Date.now()}`, model: '', input: '0', output: '0' },
                ])
                setSettingsDirty(true)
              }}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary transition hover:bg-white/[0.08]"
            >
              <Plus className="mr-1 inline h-3.5 w-3.5" />
              Add model
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <BudgetInput
                label="Daily limit"
                value={budgets.daily}
                onChange={(value) => {
                  setBudgets((current) => ({ ...current, daily: value }))
                  setSettingsDirty(true)
                }}
              />
              <BudgetInput
                label="Weekly limit"
                value={budgets.weekly}
                onChange={(value) => {
                  setBudgets((current) => ({ ...current, weekly: value }))
                  setSettingsDirty(true)
                }}
              />
              <BudgetInput
                label="Monthly limit"
                value={budgets.monthly}
                onChange={(value) => {
                  setBudgets((current) => ({ ...current, monthly: value }))
                  setSettingsDirty(true)
                }}
              />
            </div>

            <div className="space-y-3">
              {rateDrafts.map((draft) => (
                <div key={draft.id} className="grid grid-cols-[1.2fr_0.6fr_0.6fr_auto] gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <label className="text-xs text-text-muted">
                    Model
                    <input
                      value={draft.model}
                      onChange={(event) => {
                        setRateDrafts((current) =>
                          current.map((row) => row.id === draft.id ? { ...row, model: event.target.value } : row)
                        )
                        setSettingsDirty(true)
                      }}
                      className="mt-1 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-text-primary outline-none transition focus:border-[var(--accent-primary,#3b82f6)]/40"
                      placeholder="claude-sonnet-4"
                    />
                  </label>
                  <label className="text-xs text-text-muted">
                    Input / 1M
                    <input
                      type="number"
                      step="0.01"
                      value={draft.input}
                      onChange={(event) => {
                        setRateDrafts((current) =>
                          current.map((row) => row.id === draft.id ? { ...row, input: event.target.value } : row)
                        )
                        setSettingsDirty(true)
                      }}
                      className="mt-1 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-text-primary outline-none transition focus:border-[var(--accent-primary,#3b82f6)]/40"
                    />
                  </label>
                  <label className="text-xs text-text-muted">
                    Output / 1M
                    <input
                      type="number"
                      step="0.01"
                      value={draft.output}
                      onChange={(event) => {
                        setRateDrafts((current) =>
                          current.map((row) => row.id === draft.id ? { ...row, output: event.target.value } : row)
                        )
                        setSettingsDirty(true)
                      }}
                      className="mt-1 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-text-primary outline-none transition focus:border-[var(--accent-primary,#3b82f6)]/40"
                    />
                  </label>
                  <button
                    onClick={() => {
                      setRateDrafts((current) => current.filter((row) => row.id !== draft.id))
                      setSettingsDirty(true)
                    }}
                    className="mt-6 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-text-muted transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-200"
                    aria-label={`Remove ${draft.model || 'rate row'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-xs text-text-secondary">
              <p className="font-medium text-text-primary">Current live context</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-black/20 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">OpenRouter month</p>
                  <p className="mt-1 text-sm text-text-primary">{formatUsd(data.openrouter?.usageMonthly || 0)}</p>
                </div>
                <div className="rounded-xl bg-black/20 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Railway est.</p>
                  <p className="mt-1 text-sm text-text-primary">{formatUsd(data.railway?.estimated?.total || 0)}</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => void saveSettings()}
              disabled={saving || !settingsDirty}
              className="inline-flex items-center rounded-xl border border-[var(--accent-primary,#3b82f6)]/30 bg-[var(--accent-primary,#3b82f6)]/12 px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-[var(--accent-primary,#3b82f6)]/18 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save pricing settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="rounded-xl bg-white/[0.06] p-2">{icon}</div>
        <span className="text-sm text-text-secondary">{label}</span>
      </div>
      <p className="text-3xl font-bold text-text-primary">{value}</p>
      <p className="mt-1 text-xs text-text-muted">{detail}</p>
    </div>
  )
}

function BreakdownCard({
  title,
  subtitle,
  rows,
}: {
  title: string
  subtitle: string
  rows: Array<{ id: string; sessions: number; cost: number; totalTokens: number; models: string[] }>
}) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        <p className="text-xs text-text-muted">{subtitle}</p>
      </div>
      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-text-muted">
            No usage recorded for this range yet.
          </div>
        ) : rows.map((row) => (
          <div key={row.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-text-primary">{row.id}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {row.sessions} sessions | {row.models.slice(0, 2).join(', ')}
                  {row.models.length > 2 ? ` +${row.models.length - 2} more` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-emerald-300">{formatUsd(row.cost)}</p>
                <p className="text-xs text-text-muted">{formatTokens(row.totalTokens)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BudgetInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="text-xs text-text-muted">
      {label}
      <div className="relative mt-1">
        <Wallet className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        <input
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-white/[0.08] bg-black/20 py-2 pl-9 pr-3 text-sm text-text-primary outline-none transition focus:border-[var(--accent-primary,#3b82f6)]/40"
        />
      </div>
    </label>
  )
}

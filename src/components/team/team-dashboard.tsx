'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  BadgeDollarSign,
  Bot,
  Coins,
  Crown,
  RefreshCcw,
  TrendingDown,
  UsersRound,
} from 'lucide-react'

import { useSettings } from '@/contexts/settings-context'
import { formatTokens, formatUsd } from '@/lib/format'

type TeamUsageRange = 'today' | 'week' | 'month' | 'all'
type LeaderboardKind = 'users' | 'agents'

type LeaderboardEntry = {
  id: string
  name: string
  subtitle: string
  totalTokens: number
  totalCost: number
  sessionsCount: number
  avgCostPerSession: number
  avgCompletionRate: number
}

type WasteSession = {
  id: string
  userName: string
  agentName: string
  instanceId: string
  taskDescription: string
  totalTokens: number
  totalCost: number
  completionRate: number
  wastedTokens: number
  outcome: 'completed' | 'partial' | 'blocked'
  timestamp: string
}

type TeamDashboardPayload = {
  range: TeamUsageRange
  generatedAt: string
  summary: {
    totalTokens: number
    totalCost: number
    sessionsCount: number
    activeUsers: number
    activeAgents: number
  }
  userLeaderboard: LeaderboardEntry[]
  agentLeaderboard: LeaderboardEntry[]
  wasteSessions: WasteSession[]
}

const RANGE_OPTIONS: Array<{ value: TeamUsageRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
]

function completionTone(value: number) {
  if (value >= 0.9) return 'text-emerald-300'
  if (value >= 0.75) return 'text-sky-300'
  if (value >= 0.6) return 'text-amber-300'
  return 'text-rose-300'
}

function wasteTone(value: number) {
  if (value >= 0.6) return 'border-rose-400/30 bg-rose-400/10 text-rose-200'
  if (value >= 0.4) return 'border-amber-400/30 bg-amber-400/10 text-amber-200'
  return 'border-sky-400/30 bg-sky-400/10 text-sky-200'
}

function labelForRange(range: TeamUsageRange) {
  return RANGE_OPTIONS.find((option) => option.value === range)?.label || 'This Week'
}

export function TeamDashboard() {
  const { settings } = useSettings()
  const [range, setRange] = useState<TeamUsageRange>('week')
  const [leaderboardKind, setLeaderboardKind] = useState<LeaderboardKind>('users')
  const [data, setData] = useState<TeamDashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadDashboard(nextRange: TeamUsageRange) {
    try {
      if (!data) setLoading(true)
      const response = await fetch(`/api/team-dashboard?range=${nextRange}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Could not load team usage data.')
      setData((await response.json()) as TeamDashboardPayload)
      setError(null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load team usage data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard(range)
  }, [range])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadDashboard(range)
    }, settings.refreshInterval * 1000)

    return () => window.clearInterval(intervalId)
  }, [range, settings.refreshInterval])

  const leaderboard = useMemo(() => {
    if (!data) return []
    return leaderboardKind === 'users' ? data.userLeaderboard : data.agentLeaderboard
  }, [data, leaderboardKind])

  const chartData = useMemo(
    () =>
      leaderboard.slice(0, 6).map((entry) => ({
        name: entry.name,
        tokens: entry.totalTokens,
        cost: entry.totalCost,
        sessions: entry.sessionsCount,
        avgCostPerSession: entry.avgCostPerSession,
        avgCompletionRate: entry.avgCompletionRate,
      })),
    [leaderboard],
  )

  if (loading && !data) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-center gap-2 py-16 text-text-muted">
          <RefreshCcw className="h-4 w-4 animate-spin" />
          Loading team usage dashboard...
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-300" />
          <div>
            <p className="text-sm font-medium text-text-primary">Team usage data is unavailable</p>
            <p className="mt-1 text-xs text-text-muted">{error || 'Try reloading in a moment.'}</p>
          </div>
          <button
            onClick={() => void loadDashboard(range)}
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-text-primary transition hover:bg-white/[0.08]"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-[var(--glass-border)] bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_35%),rgba(255,255,255,0.04)] p-7 shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(9,9,11,0.22))]" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-white/[0.06] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-text-secondary">
              <UsersRound className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              Team Usage
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-text-primary">Usage rankings, team-wide spend, and sessions worth fixing.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-text-secondary">
                See who is burning the most tokens, which agents drive the bill, and where completion quality is low enough to deserve prompt or routing changes.
              </p>
            </div>
            <p className="text-xs text-text-muted">
              Updated {new Date(data.generatedAt).toLocaleString()} | {data.summary.sessionsCount} sessions in {labelForRange(data.range).toLowerCase()}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setRange(option.value)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  range === option.value
                    ? 'border-[var(--accent-primary,#3b82f6)]/30 bg-[var(--accent-primary,#3b82f6)]/15 text-text-primary'
                    : 'border-white/[0.06] bg-white/[0.04] text-text-secondary hover:bg-white/[0.08]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Coins className="h-5 w-5 text-sky-300" />}
          label="Total tokens"
          value={formatTokens(data.summary.totalTokens)}
          detail={`${data.summary.sessionsCount} tracked sessions`}
        />
        <MetricCard
          icon={<BadgeDollarSign className="h-5 w-5 text-emerald-300" />}
          label="Total cost"
          value={formatUsd(data.summary.totalCost)}
          detail={`${data.summary.activeUsers} active operators`}
        />
        <MetricCard
          icon={<UsersRound className="h-5 w-5 text-violet-300" />}
          label="Active users"
          value={String(data.summary.activeUsers)}
          detail={`${data.userLeaderboard.length} users ranked`}
        />
        <MetricCard
          icon={<Bot className="h-5 w-5 text-amber-300" />}
          label="Active agents"
          value={String(data.summary.activeAgents)}
          detail={`${data.agentLeaderboard.length} agents ranked`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="glass rounded-2xl p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Leaderboard</h2>
              <p className="text-xs text-text-muted">Rankings combine volume, spend, and session efficiency.</p>
            </div>
            <div className="inline-flex rounded-2xl border border-white/[0.06] bg-white/[0.03] p-1">
              {(['users', 'agents'] as LeaderboardKind[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setLeaderboardKind(option)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    leaderboardKind === option
                      ? 'bg-[var(--accent-primary,#3b82f6)]/15 text-text-primary'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {option === 'users' ? 'Per User' : 'Per Agent'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {leaderboard.map((entry, index) => (
              <div key={entry.id} className="grid gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-4 md:grid-cols-[auto_1fr_auto]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-sm font-semibold text-text-primary">
                  {index === 0 ? <Crown className="h-4 w-4 text-amber-300" /> : `#${index + 1}`}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-text-primary">{entry.name}</p>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                      {entry.subtitle}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-text-secondary sm:grid-cols-4">
                    <span>{formatTokens(entry.totalTokens)} tokens</span>
                    <span>{formatUsd(entry.totalCost)} total</span>
                    <span>{entry.sessionsCount} sessions</span>
                    <span className={completionTone(entry.avgCompletionRate)}>
                      {(entry.avgCompletionRate * 100).toFixed(0)}% avg completion
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-text-primary">{formatUsd(entry.avgCostPerSession)}</p>
                  <p className="text-xs text-text-muted">avg / session</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-text-primary">
              {leaderboardKind === 'users' ? 'User token ranking' : 'Agent token ranking'}
            </h2>
            <p className="text-xs text-text-muted">Top six entries for the selected range.</p>
          </div>

          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  type="number"
                  stroke="rgba(255,255,255,0.45)"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => formatTokens(value)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  stroke="rgba(255,255,255,0.45)"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{
                    background: 'rgba(10, 10, 12, 0.94)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 16,
                    color: '#ececef',
                  }}
                  formatter={(value: number | string | readonly (string | number)[] | undefined) => [
                    formatTokens(Number(Array.isArray(value) ? value[0] || 0 : value || 0)),
                    'Tokens',
                  ]}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as (typeof chartData)[number] | undefined
                    if (!row) return ''
                    return `${row.name} | ${formatUsd(row.cost)} total | ${row.sessions} sessions | ${(row.avgCompletionRate * 100).toFixed(0)}% completion`
                  }}
                />
                <Bar dataKey="tokens" fill="rgba(59,130,246,0.85)" radius={[0, 10, 10, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="glass rounded-2xl p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-rose-200">
              <TrendingDown className="h-3.5 w-3.5" />
              Waste detector
            </div>
            <h2 className="mt-3 text-lg font-semibold text-text-primary">High-token sessions with weak completion</h2>
            <p className="mt-1 text-xs text-text-muted">
              These runs consumed meaningful tokens but ended with low completion quality. They are the first places to improve prompts, routing, or handoff logic.
            </p>
          </div>
          <p className="text-xs text-text-muted">Completion is scored in the local usage dataset and surfaced here as a QA signal.</p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {data.wasteSessions.length === 0 ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/8 p-5 text-sm text-emerald-100">
              Nothing looks wasteful in this range. The current sessions are landing with healthy completion relative to their spend.
            </div>
          ) : (
            data.wasteSessions.map((session) => (
              <div key={session.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{session.taskDescription}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {session.userName} via {session.agentName} on {session.instanceId}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${wasteTone(1 - session.completionRate)}`}>
                    {(session.completionRate * 100).toFixed(0)}% completion
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <MiniMetric label="Total tokens" value={formatTokens(session.totalTokens)} />
                  <MiniMetric label="Likely waste" value={formatTokens(session.wastedTokens)} />
                  <MiniMetric label="Spend" value={formatUsd(session.totalCost)} />
                  <MiniMetric label="Outcome" value={session.outcome} />
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-text-secondary">
                  <span>{new Date(session.timestamp).toLocaleString()}</span>
                  <span className={completionTone(session.completionRate)}>
                    {(session.completionRate * 100).toFixed(0)}% completion quality
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/20 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-text-primary">{value}</p>
    </div>
  )
}

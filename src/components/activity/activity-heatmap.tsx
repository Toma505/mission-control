'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Calendar, Flame, Loader2, TrendingUp, Zap } from 'lucide-react'

type ActivityAgent = {
  id: string
  label: string
}

type ActivityDay = {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
  isFuture: boolean
  inRange: boolean
  dayOfWeek: number
}

type ActivityResponse = {
  agents: ActivityAgent[]
  selectedAgent: string | null
  range: {
    start: string
    end: string
  }
  summary: {
    totalSessions: number
    mostActiveDay: { date: string; count: number } | null
    currentStreak: number
    longestStreak: number
  }
  maxCount: number
  weeks: Array<{
    id: string
    days: ActivityDay[]
  }>
}

const DENSE_WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function levelClass(level: ActivityDay['level'], inRange: boolean, isFuture: boolean) {
  if (!inRange || isFuture) return 'bg-white/[0.01] border-white/[0.02]'
  if (level === 0) return 'bg-white/[0.02] border-white/[0.04]'
  if (level === 1) return 'bg-emerald-500/20 border-emerald-500/20'
  if (level === 2) return 'bg-emerald-500/40 border-emerald-500/30'
  if (level === 3) return 'bg-emerald-500/70 border-emerald-400/50'
  return 'bg-emerald-500 border-emerald-300/70'
}

function pluralize(count: number, label: string) {
  return `${count} ${label}${count === 1 ? '' : 's'}`
}

export function ActivityHeatmap() {
  const [selectedAgent, setSelectedAgent] = useState('all')
  const [data, setData] = useState<ActivityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadActivity() {
      setLoading(true)
      setError('')

      try {
        const params = selectedAgent === 'all'
          ? ''
          : `?agent=${encodeURIComponent(selectedAgent)}`
        const response = await fetch(`/api/activity${params}`, { cache: 'no-store' })
        const payload = (await response.json().catch(() => ({}))) as ActivityResponse & { error?: string }

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load activity history.')
        }

        if (!cancelled) {
          setData(payload)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Failed to load activity history.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadActivity()
    return () => {
      cancelled = true
    }
  }, [selectedAgent])

  const monthLabels = useMemo(() => {
    if (!data) return []

    const labels: Array<{ label: string; weekIndex: number }> = []
    let lastMonthKey = ''

    data.weeks.forEach((week, weekIndex) => {
      const anchor = week.days.find((day) => day.inRange && !day.isFuture)
      if (!anchor) return

      const date = new Date(`${anchor.date}T00:00:00`)
      const key = `${date.getFullYear()}-${date.getMonth()}`
      if (key === lastMonthKey) return

      lastMonthKey = key
      labels.push({
        label: date.toLocaleDateString('en-US', { month: 'short' }),
        weekIndex,
      })
    })

    return labels
  }, [data])

  if (loading && !data) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading activity heatmap...
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Calendar className="h-8 w-8 text-text-muted" />
          <div>
            <p className="text-sm font-medium text-text-primary">Activity history is unavailable</p>
            <p className="mt-1 text-xs text-text-muted">{error || 'Try reloading the page.'}</p>
          </div>
        </div>
      </div>
    )
  }

  const mostActiveLabel = data.summary.mostActiveDay
    ? `${formatDate(data.summary.mostActiveDay.date)} · ${pluralize(data.summary.mostActiveDay.count, 'session')}`
    : 'No activity recorded yet'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Activity</h1>
          <p className="mt-1 text-sm text-text-muted">
            A 12-month view of agent runs, task volume, and streaks across Mission Control.
          </p>
        </div>

        <label className="text-xs text-text-muted">
          Filter by agent
          <select
            value={selectedAgent}
            onChange={(event) => setSelectedAgent(event.target.value)}
            className="mt-1 block min-w-[220px] rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-primary outline-none transition focus:border-emerald-400/40"
          >
            <option value="all">All agents</option>
            {data.agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Zap className="h-5 w-5 text-emerald-300" />}
          label="Total sessions"
          value={String(data.summary.totalSessions)}
          detail={`${data.range.start} → ${data.range.end}`}
        />
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5 text-violet-300" />}
          label="Most active day"
          value={data.summary.mostActiveDay ? String(data.summary.mostActiveDay.count) : '0'}
          detail={mostActiveLabel}
        />
        <SummaryCard
          icon={<Flame className="h-5 w-5 text-amber-300" />}
          label="Current streak"
          value={String(data.summary.currentStreak)}
          detail={pluralize(data.summary.currentStreak, 'active day')}
        />
        <SummaryCard
          icon={<Calendar className="h-5 w-5 text-sky-300" />}
          label="Longest streak"
          value={String(data.summary.longestStreak)}
          detail={pluralize(data.summary.longestStreak, 'active day')}
        />
      </div>

      <div className="glass rounded-2xl p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Activity heatmap</h2>
            <p className="mt-1 text-xs text-text-muted">
              Darker cells mean more completed sessions or tasks on that day.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <span
                key={level}
                className={`h-3.5 w-3.5 rounded-[4px] border ${levelClass(level as 0 | 1 | 2 | 3 | 4, true, false)}`}
              />
            ))}
            <span>More</span>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <div className="inline-flex gap-3">
            <div className="grid grid-rows-7 gap-1 pt-7">
              {DENSE_WEEKDAY_LABELS.map((label, index) => (
                <div
                  key={`${label}-${index}`}
                  className="flex h-3.5 items-center pr-1 text-[10px] text-text-muted/70"
                >
                  {index % 2 === 1 ? label : ''}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div
                className="relative grid gap-1"
                style={{ gridTemplateColumns: `repeat(${data.weeks.length}, minmax(0, 1fr))` }}
              >
                {monthLabels.map((month) => (
                  <span
                    key={`${month.label}-${month.weekIndex}`}
                    className="text-[10px] text-text-muted/80"
                    style={{ gridColumn: `${month.weekIndex + 1} / span 4` }}
                  >
                    {month.label}
                  </span>
                ))}
              </div>

              <div className="flex gap-1">
                {data.weeks.map((week) => (
                  <div key={week.id} className="grid grid-rows-7 gap-1">
                    {week.days.map((day) => {
                      const tooltipText = day.inRange && !day.isFuture
                        ? `${formatDate(day.date)} · ${pluralize(day.count, 'session')}`
                        : formatDate(day.date)

                      return (
                        <div key={day.date} className="group relative">
                          <div
                            title={tooltipText}
                            className={`h-3.5 w-3.5 rounded-[4px] border transition-transform duration-150 group-hover:scale-[1.15] ${levelClass(day.level, day.inRange, day.isFuture)}`}
                          />
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max -translate-x-1/2 rounded-lg border border-white/[0.08] bg-[#0b0d10]/95 px-2 py-1 text-[10px] text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
                            {tooltipText}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatLine
            label="Most active day"
            value={mostActiveLabel}
          />
          <StatLine
            label="Current run"
            value={data.summary.currentStreak > 0
              ? `${pluralize(data.summary.currentStreak, 'active day')} in a row`
              : 'No active streak right now'}
          />
          <StatLine
            label="Longest run"
            value={data.summary.longestStreak > 0
              ? `${pluralize(data.summary.longestStreak, 'active day')} at peak`
              : 'No streaks recorded yet'}
          />
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
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

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <p className="mt-2 text-sm text-text-primary">{value}</p>
    </div>
  )
}

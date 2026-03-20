'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Calendar, BarChart3 } from 'lucide-react'
import { formatUsd } from '@/lib/format'

interface CostSnapshot {
  date: string
  openrouter: number
  anthropic: number
  railway: number
  subscriptions: number
  total: number
}

interface Aggregates {
  totalSpend: number
  avgDaily: number
  maxDay: { date: string; total: number }
  minDay: { date: string; total: number }
  trendPct: number
  projectedMonthly: number
}

interface HistoryData {
  history: CostSnapshot[]
  aggregates: Aggregates
}

type Range = '7d' | '30d' | '90d'

export function CostTrendChart() {
  const [data, setData] = useState<HistoryData | null>(null)
  const [range, setRange] = useState<Range>('30d')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/costs/history?range=${range}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => {
        if (!d.error) setData(d)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [range])

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-accent-primary" />
          <h3 className="text-base font-semibold text-text-primary">Spend Trends</h3>
        </div>
        <div className="h-48 flex items-center justify-center">
          <p className="text-sm text-text-muted">Loading trends...</p>
        </div>
      </div>
    )
  }

  if (!data || data.history.length === 0) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-accent-primary" />
          <h3 className="text-base font-semibold text-text-primary">Spend Trends</h3>
        </div>
        <div className="h-48 flex items-center justify-center flex-col gap-2">
          <Calendar className="w-8 h-8 text-text-muted" />
          <p className="text-sm text-text-muted">No cost history yet</p>
          <p className="text-xs text-text-muted">Cost data will be recorded daily as you use Mission Control</p>
        </div>
      </div>
    )
  }

  const { history, aggregates } = data
  const maxTotal = Math.max(...history.map(d => d.total), 0.01) // Avoid division by zero

  const TrendIcon = aggregates.trendPct > 5
    ? TrendingUp
    : aggregates.trendPct < -5
    ? TrendingDown
    : Minus

  const trendColor = aggregates.trendPct > 5
    ? 'text-red-400'
    : aggregates.trendPct < -5
    ? 'text-emerald-400'
    : 'text-text-muted'

  const trendBg = aggregates.trendPct > 5
    ? 'bg-red-400/10'
    : aggregates.trendPct < -5
    ? 'bg-emerald-400/10'
    : 'bg-white/[0.04]'

  const hovered = hoveredIdx !== null && hoveredIdx < history.length ? history[hoveredIdx] : null

  return (
    <div className="glass rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-accent-primary" />
          <h3 className="text-base font-semibold text-text-primary">Spend Trends</h3>
          <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 ${trendBg} ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            {Math.abs(aggregates.trendPct)}%
          </span>
        </div>
        <div className="flex gap-1">
          {(['7d', '30d', '90d'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                range === r
                  ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                  : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-background-elevated">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Avg Daily</p>
          <p className="text-lg font-bold text-text-primary">{formatUsd(aggregates.avgDaily)}</p>
        </div>
        <div className="p-3 rounded-xl bg-background-elevated">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Projected Monthly</p>
          <p className="text-lg font-bold text-status-progress">{formatUsd(aggregates.projectedMonthly)}</p>
        </div>
        <div className="p-3 rounded-xl bg-background-elevated">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Peak Day</p>
          <p className="text-lg font-bold text-text-primary">{formatUsd(aggregates.maxDay.total)}</p>
          <p className="text-[10px] text-text-muted">{aggregates.maxDay.date}</p>
        </div>
      </div>

      {/* Tooltip */}
      {hovered && (
        <div className="mb-2 p-3 rounded-xl bg-background-elevated border border-white/[0.08] text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-text-primary">{hovered.date}</span>
            <span className="font-bold text-text-primary">{formatUsd(hovered.total)}</span>
          </div>
          <div className="flex gap-4 text-text-muted">
            {hovered.openrouter > 0 && <span>OpenRouter: {formatUsd(hovered.openrouter)}</span>}
            {hovered.anthropic > 0 && <span>Anthropic: {formatUsd(hovered.anthropic)}</span>}
            {hovered.railway > 0 && <span>Railway: {formatUsd(hovered.railway)}</span>}
          </div>
        </div>
      )}

      {/* Bar chart */}
      <div className="relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-6 w-10 flex flex-col justify-between text-[10px] text-text-muted">
          <span>{formatUsd(maxTotal)}</span>
          <span>{formatUsd(maxTotal / 2)}</span>
          <span>$0</span>
        </div>

        {/* Chart area */}
        <div className="ml-12">
          <div
            className="flex items-end gap-[2px] h-48"
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {history.map((day, i) => {
              const heightPct = (day.total / maxTotal) * 100
              const isHovered = hoveredIdx === i

              // Stacked bar segments
              const orPct = day.total > 0 ? (day.openrouter / day.total) * heightPct : 0
              const antPct = day.total > 0 ? (day.anthropic / day.total) * heightPct : 0
              const railPct = day.total > 0 ? (day.railway / day.total) * heightPct : 0
              const subPct = Math.max(0, heightPct - orPct - antPct - railPct)

              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col justify-end cursor-pointer group relative"
                  style={{ height: '100%' }}
                  onMouseEnter={() => setHoveredIdx(i)}
                >
                  <div
                    className={`rounded-t-sm transition-all duration-150 flex flex-col justify-end overflow-hidden ${
                      isHovered ? 'opacity-100 ring-1 ring-accent-primary/50' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ height: `${Math.max(heightPct, 1)}%` }}
                  >
                    {subPct > 0 && (
                      <div className="bg-slate-500/60" style={{ height: `${(subPct / heightPct) * 100}%` }} />
                    )}
                    {railPct > 0 && (
                      <div className="bg-emerald-500/60" style={{ height: `${(railPct / heightPct) * 100}%` }} />
                    )}
                    {antPct > 0 && (
                      <div className="bg-amber-400/60" style={{ height: `${(antPct / heightPct) * 100}%` }} />
                    )}
                    {orPct > 0 && (
                      <div className="bg-violet-400/60" style={{ height: `${(orPct / heightPct) * 100}%` }} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between mt-1 text-[10px] text-text-muted">
            <span>{history[0]?.date.slice(5)}</span>
            {history.length > 2 && (
              <span>{history[Math.floor(history.length / 2)]?.date.slice(5)}</span>
            )}
            <span>{history[history.length - 1]?.date.slice(5)}</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-[10px] text-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-violet-400/60" /> OpenRouter
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-amber-400/60" /> Anthropic
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-emerald-500/60" /> Railway
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-slate-500/60" /> Subscriptions
        </span>
      </div>
    </div>
  )
}

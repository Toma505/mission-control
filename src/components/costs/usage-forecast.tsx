'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, TrendingDown, AlertTriangle, Clock, Info } from 'lucide-react'

interface Recommendation {
  type: 'switch' | 'throttle' | 'schedule' | 'info'
  title: string
  description: string
  savingsPercent?: number
  savingsAmount?: number
}

interface ForecastData {
  current: { dailySpend: number; monthlySpend: number; dailyAvg: number }
  forecast: {
    projectedMonthly: number
    projectedEndOfMonth: number
    projectedRemaining: number
    daysRemaining: number
    daysInMonth: number
    dayOfMonth: number
    monthlyPct: number
    daysUntilBudgetExceeded: number
  }
  budget: { dailyLimit: number; monthlyLimit: number }
  recommendations: Recommendation[]
}

const recIcons: Record<string, typeof Info> = {
  switch: TrendingDown,
  throttle: AlertTriangle,
  schedule: Clock,
  info: Info,
}

const recColors: Record<string, string> = {
  switch: 'border-emerald-400/30 bg-emerald-400/5',
  throttle: 'border-red-400/30 bg-red-400/5',
  schedule: 'border-amber-400/30 bg-amber-400/5',
  info: 'border-sky-400/30 bg-sky-400/5',
}

const recIconColors: Record<string, string> = {
  switch: 'text-emerald-400',
  throttle: 'text-red-400',
  schedule: 'text-amber-400',
  info: 'text-sky-400',
}

function BudgetGauge({ pct, label }: { pct: number; label: string }) {
  const clampedPct = Math.min(pct, 100)
  const color = pct > 100 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22c55e'
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (clampedPct / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={radius} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="70" y="65" textAnchor="middle" className="fill-text-primary text-2xl font-bold">
          {pct > 999 ? '999+' : `${pct}%`}
        </text>
        <text x="70" y="85" textAnchor="middle" className="fill-text-muted text-xs">
          {label}
        </text>
      </svg>
    </div>
  )
}

export function UsageForecast() {
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/forecast')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-center text-text-muted text-sm py-8">Loading forecast...</div>
  }

  if (!data) {
    return <div className="glass rounded-2xl p-8 text-center text-text-muted text-sm">Unable to load forecast data.</div>
  }

  const { current, forecast, budget, recommendations } = data

  return (
    <div className="space-y-6">
      {/* Overview row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-5 flex flex-col items-center">
          <BudgetGauge pct={forecast.monthlyPct} label="of budget" />
          <p className="text-xs text-text-muted mt-2">
            ${current.monthlySpend.toFixed(2)} of ${budget.monthlyLimit} used
          </p>
        </div>

        <div className="glass rounded-xl p-5 space-y-4">
          <div>
            <p className="text-xs text-text-muted">Today&apos;s Spend</p>
            <p className="text-xl font-bold text-text-primary">${current.dailySpend.toFixed(2)}</p>
            <p className="text-xs text-text-muted">Daily avg: ${current.dailyAvg.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Month to Date</p>
            <p className="text-xl font-bold text-text-primary">${current.monthlySpend.toFixed(2)}</p>
            <p className="text-xs text-text-muted">Day {forecast.dayOfMonth} of {forecast.daysInMonth}</p>
          </div>
        </div>

        <div className="glass rounded-xl p-5 space-y-4">
          <div>
            <p className="text-xs text-text-muted">Projected End of Month</p>
            <p className={`text-xl font-bold ${
              forecast.monthlyPct > 100 ? 'text-red-400' :
              forecast.monthlyPct > 80 ? 'text-amber-400' :
              'text-emerald-400'
            }`}>
              ${forecast.projectedEndOfMonth.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Remaining This Month</p>
            <p className="text-lg font-semibold text-text-primary">~${forecast.projectedRemaining.toFixed(2)}</p>
            <p className="text-xs text-text-muted">{forecast.daysRemaining} days left</p>
          </div>
          {forecast.daysUntilBudgetExceeded < forecast.daysRemaining && (
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              Budget exceeded in ~{forecast.daysUntilBudgetExceeded} days
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">Recommendations</h2>
          {recommendations.map((rec, i) => {
            const Icon = recIcons[rec.type] || Info
            return (
              <div
                key={i}
                className={`rounded-xl p-4 border flex items-start gap-4 ${recColors[rec.type] || recColors.info}`}
              >
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${recIconColors[rec.type] || recIconColors.info}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{rec.title}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{rec.description}</p>
                </div>
                {rec.savingsAmount && rec.savingsAmount > 0 && (
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-emerald-400">-${rec.savingsAmount}</p>
                    <p className="text-[10px] text-text-muted">/month</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Projection timeline */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-medium text-text-secondary mb-3">Monthly Projection</h3>
        <div className="relative h-8 bg-white/[0.04] rounded-full overflow-hidden">
          {/* Spent portion */}
          <div
            className="absolute left-0 top-0 h-full bg-[var(--accent-primary,#3b82f6)] rounded-l-full transition-all duration-500"
            style={{ width: `${Math.min((forecast.dayOfMonth / forecast.daysInMonth) * 100, 100)}%` }}
          />
          {/* Budget line */}
          {forecast.projectedEndOfMonth > 0 && (
            <div
              className="absolute top-0 h-full w-px bg-amber-400"
              style={{ left: `${Math.min((budget.monthlyLimit / forecast.projectedEndOfMonth) * 100, 100)}%` }}
            />
          )}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-text-muted">
          <span>Day 1</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-amber-400 rounded" /> Budget: ${budget.monthlyLimit}
          </span>
          <span>Day {forecast.daysInMonth}</span>
        </div>
      </div>
    </div>
  )
}

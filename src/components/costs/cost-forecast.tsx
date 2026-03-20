'use client'

import { useEffect, useState, useRef } from 'react'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Info,
  DollarSign,
  Shield,
  Loader2,
  ChevronRight,
} from 'lucide-react'

interface ForecastPoint {
  date: string
  predicted: number
  lower: number
  upper: number
}

interface Recommendation {
  type: 'warning' | 'savings' | 'info'
  title: string
  description: string
  impact?: string
}

interface ForecastData {
  forecast: ForecastPoint[]
  recommendations: Recommendation[]
  summary: {
    projectedMonthly: number
    currentAvgDaily: number
    forecastDays: number
    dataPoints: number
    modelConfidence: 'low' | 'medium' | 'high'
    r2: number
  }
}

const CONFIDENCE_COLORS = {
  low: { bg: 'bg-amber-400/10', text: 'text-amber-400', border: 'border-amber-400/20' },
  medium: { bg: 'bg-blue-400/10', text: 'text-blue-400', border: 'border-blue-400/20' },
  high: { bg: 'bg-emerald-400/10', text: 'text-emerald-400', border: 'border-emerald-400/20' },
}

const REC_ICONS = {
  warning: AlertTriangle,
  savings: DollarSign,
  info: Info,
}

const REC_STYLES = {
  warning: 'border-amber-400/20 bg-amber-400/5',
  savings: 'border-emerald-400/20 bg-emerald-400/5',
  info: 'border-blue-400/20 bg-blue-400/5',
}

const REC_ICON_STYLES = {
  warning: 'text-amber-400',
  savings: 'text-emerald-400',
  info: 'text-blue-400',
}

export function CostForecast() {
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [forecastDays, setForecastDays] = useState(30)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadForecast()
  }, [forecastDays])

  async function loadForecast() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/costs/forecast?days=${forecastDays}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load forecast')
      const json = await res.json()
      setData(json)
    } catch {
      setError('Could not load cost forecast')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-accent-primary" />
          <h2 className="text-lg font-semibold text-text-primary">Cost Forecast</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-accent-primary" />
          <h2 className="text-lg font-semibold text-text-primary">Cost Forecast</h2>
        </div>
        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-6 text-center">
          <Lightbulb className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-secondary">{error || 'No forecast data available'}</p>
          <p className="text-xs text-text-muted mt-1">Keep Mission Control running to collect spending data.</p>
        </div>
      </div>
    )
  }

  const { forecast, recommendations, summary } = data
  const confidenceStyle = CONFIDENCE_COLORS[summary.modelConfidence]

  // Chart calculations
  const allValues = forecast.flatMap(f => [f.lower, f.upper, f.predicted])
  const maxVal = Math.max(...allValues, 1)
  const chartHeight = 180

  return (
    <div className="glass rounded-2xl p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-accent-primary" />
          <h2 className="text-lg font-semibold text-text-primary">Cost Forecast</h2>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${confidenceStyle.bg} ${confidenceStyle.text} border ${confidenceStyle.border}`}>
            {summary.modelConfidence} confidence
          </span>
        </div>
        <div className="flex items-center gap-2">
          {[14, 30, 60, 90].map(d => (
            <button
              key={d}
              onClick={() => setForecastDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                forecastDays === d
                  ? 'bg-accent-primary text-white'
                  : 'glass text-text-secondary hover:bg-[var(--glass-bg-hover)] hover:text-text-primary'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-background-elevated">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Projected Monthly</p>
          <p className="text-xl font-bold text-text-primary mt-1">${summary.projectedMonthly.toFixed(2)}</p>
        </div>
        <div className="p-3 rounded-xl bg-background-elevated">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Avg Daily</p>
          <p className="text-xl font-bold text-text-primary mt-1">${summary.currentAvgDaily.toFixed(2)}</p>
        </div>
        <div className="p-3 rounded-xl bg-background-elevated">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Data Points</p>
          <p className="text-xl font-bold text-text-primary mt-1">{summary.dataPoints}</p>
          <p className="text-[10px] text-text-muted">days tracked</p>
        </div>
        <div className="p-3 rounded-xl bg-background-elevated">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Model Fit (R²)</p>
          <p className="text-xl font-bold text-text-primary mt-1">{(summary.r2 * 100).toFixed(0)}%</p>
          <p className="text-[10px] text-text-muted">accuracy</p>
        </div>
      </div>

      {/* Forecast Chart */}
      {forecast.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-6 h-0.5 rounded-full bg-accent-primary" /> Predicted
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-6 h-2 rounded bg-accent-primary/10" /> 95% Confidence
            </span>
          </div>

          <div
            ref={chartRef}
            className="relative rounded-xl bg-[var(--glass-bg)] p-4"
            style={{ height: chartHeight + 40 }}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {/* Y-axis labels */}
            <div className="absolute left-2 top-4 bottom-8 flex flex-col justify-between text-[9px] text-text-muted">
              <span>${maxVal.toFixed(0)}</span>
              <span>${(maxVal / 2).toFixed(0)}</span>
              <span>$0</span>
            </div>

            {/* Chart area */}
            <div className="ml-8 h-full relative">
              <svg
                className="w-full"
                style={{ height: chartHeight }}
                viewBox={`0 0 ${forecast.length} ${chartHeight}`}
                preserveAspectRatio="none"
              >
                {/* Confidence band */}
                <path
                  d={
                    forecast.map((f, i) =>
                      `${i === 0 ? 'M' : 'L'} ${i} ${chartHeight - (f.upper / maxVal) * chartHeight}`
                    ).join(' ') +
                    ' ' +
                    [...forecast].reverse().map((f, i) =>
                      `L ${forecast.length - 1 - i} ${chartHeight - (f.lower / maxVal) * chartHeight}`
                    ).join(' ') +
                    ' Z'
                  }
                  fill="var(--accent-primary)"
                  fillOpacity="0.08"
                />

                {/* Upper bound line */}
                <path
                  d={forecast.map((f, i) =>
                    `${i === 0 ? 'M' : 'L'} ${i} ${chartHeight - (f.upper / maxVal) * chartHeight}`
                  ).join(' ')}
                  fill="none"
                  stroke="var(--accent-primary)"
                  strokeWidth="0.3"
                  strokeDasharray="2,2"
                  strokeOpacity="0.3"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Lower bound line */}
                <path
                  d={forecast.map((f, i) =>
                    `${i === 0 ? 'M' : 'L'} ${i} ${chartHeight - (f.lower / maxVal) * chartHeight}`
                  ).join(' ')}
                  fill="none"
                  stroke="var(--accent-primary)"
                  strokeWidth="0.3"
                  strokeDasharray="2,2"
                  strokeOpacity="0.3"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Predicted line */}
                <path
                  d={forecast.map((f, i) =>
                    `${i === 0 ? 'M' : 'L'} ${i} ${chartHeight - (f.predicted / maxVal) * chartHeight}`
                  ).join(' ')}
                  fill="none"
                  stroke="var(--accent-primary)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Hover dot */}
                {hoveredIdx !== null && hoveredIdx < forecast.length && (
                  <circle
                    cx={hoveredIdx}
                    cy={chartHeight - (forecast[hoveredIdx].predicted / maxVal) * chartHeight}
                    r="2"
                    fill="var(--accent-primary)"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>

              {/* Invisible hover zones */}
              <div className="absolute inset-0 flex" style={{ height: chartHeight }}>
                {forecast.map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 h-full"
                    onMouseEnter={() => setHoveredIdx(i)}
                  />
                ))}
              </div>

              {/* Tooltip */}
              {hoveredIdx !== null && hoveredIdx < forecast.length && (
                <div
                  className="absolute z-10 pointer-events-none"
                  style={{
                    left: `${(hoveredIdx / forecast.length) * 100}%`,
                    top: 0,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div className="bg-[var(--background-card)] border border-[var(--glass-border)] rounded-lg px-3 py-2 shadow-xl text-[11px] whitespace-nowrap">
                    <p className="font-medium text-text-primary">
                      {new Date(forecast[hoveredIdx].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-accent-primary font-semibold">${forecast[hoveredIdx].predicted.toFixed(2)}</p>
                    <p className="text-text-muted">
                      ${forecast[hoveredIdx].lower.toFixed(2)} – ${forecast[hoveredIdx].upper.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}

              {/* X-axis labels */}
              <div className="flex justify-between mt-1 text-[9px] text-text-muted">
                <span>
                  {forecast.length > 0 ? new Date(forecast[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </span>
                {forecast.length > 10 && (
                  <span>
                    {new Date(forecast[Math.floor(forecast.length / 2)].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                <span>
                  {forecast.length > 0 ? new Date(forecast[forecast.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-medium text-text-primary">Recommendations</h3>
          </div>

          <div className="space-y-2">
            {recommendations.map((rec, i) => {
              const Icon = REC_ICONS[rec.type]
              return (
                <div
                  key={i}
                  className={`rounded-xl border p-4 ${REC_STYLES[rec.type]}`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${REC_ICON_STYLES[rec.type]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text-primary">{rec.title}</p>
                        {rec.impact && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            rec.type === 'warning'
                              ? 'bg-amber-400/10 text-amber-400'
                              : 'bg-emerald-400/10 text-emerald-400'
                          }`}>
                            {rec.impact}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary mt-1 leading-relaxed">{rec.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  DollarSign,
  Clock,
  Layers,
  AlertTriangle,
} from 'lucide-react'
import { formatUsd } from '@/lib/format'

interface ModelUsage {
  model: string
  cost: number
  tokens: number
  promptTokens?: number
  completionTokens?: number
}

interface DailyUsage {
  date: string
  cost: number
  tokens?: number
}

interface AnalyticsData {
  totalTokens: number
  totalCost: number
  avgCostPerKTokens: number
  modelBreakdown: ModelUsage[]
  dailyTrend: DailyUsage[]
  topModel: string
  cheapestModel: string
  mostExpensiveModel: string
  tokensByProvider: { provider: string; tokens: number; cost: number }[]
  anomalyDetected: boolean
  anomalyMessage: string
}

type Range = '7d' | '30d' | '90d'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function displayModelName(model: string): string {
  if (!model || model === 'N/A') return 'N/A'
  return model.split('/').pop() || model
}

function detectAnomaly(daily: DailyUsage[]): { detected: boolean; message: string } {
  if (daily.length < 3) return { detected: false, message: '' }

  const costs = daily.map(d => d.cost).filter(c => c > 0)
  if (costs.length < 3) return { detected: false, message: '' }

  const avg = costs.reduce((a, b) => a + b, 0) / costs.length
  const lastDay = costs[costs.length - 1]

  // Alert if last day is 3x the average
  if (lastDay > avg * 3 && lastDay > 1) {
    return {
      detected: true,
      message: `Today's spend ($${lastDay.toFixed(2)}) is ${(lastDay / avg).toFixed(1)}x your daily average ($${avg.toFixed(2)})`,
    }
  }

  return { detected: false, message: '' }
}

export function UsageAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [range, setRange] = useState<Range>('30d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    Promise.all([
      fetch('/api/costs', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch(`/api/costs/history?range=${range}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
    ])
      .then(([costs, history]) => {
        if (!costs && !history) {
          setData(null)
          return
        }

        const modelBreakdown: ModelUsage[] = []
        let totalTokens = 0
        let totalCost = 0
        const tokensByProvider: { provider: string; tokens: number; cost: number }[] = []

        // OpenRouter models (try .models first, fallback to aggregate data)
        if (costs?.openrouter?.models) {
          let orTokens = 0
          let orCost = 0
          for (const m of costs.openrouter.models) {
            const tokens = m.tokens || m.totalTokens || 0
            const cost = m.cost || m.totalCost || 0
            modelBreakdown.push({
              model: m.model || m.name || 'unknown',
              cost,
              tokens,
              promptTokens: m.promptTokens,
              completionTokens: m.completionTokens,
            })
            orTokens += tokens
            orCost += cost
          }
          totalTokens += orTokens
          totalCost += orCost
          tokensByProvider.push({ provider: 'OpenRouter', tokens: orTokens, cost: orCost })
        } else if (costs?.openrouter?.totalUsage) {
          // Fallback: aggregate OpenRouter data without per-model breakdown
          const orCost = costs.openrouter.totalUsage || 0
          const estimatedTokens = Math.round(orCost / 0.0015 * 1000)
          modelBreakdown.push({
            model: 'deepseek/deepseek-chat-v3-0324',
            cost: orCost,
            tokens: estimatedTokens,
          })
          totalTokens += estimatedTokens
          totalCost += orCost
          tokensByProvider.push({ provider: 'OpenRouter', tokens: estimatedTokens, cost: orCost })
        }

        // Anthropic models (try .models first, fallback to .anthropicCosts days)
        if (costs?.anthropic?.models) {
          let antTokens = 0
          let antCost = 0
          for (const m of costs.anthropic.models) {
            const tokens = m.tokens || m.totalTokens || 0
            const cost = m.cost || m.totalCost || 0
            modelBreakdown.push({
              model: m.model || m.name || 'unknown',
              cost,
              tokens,
            })
            antTokens += tokens
            antCost += cost
          }
          totalTokens += antTokens
          totalCost += antCost
          tokensByProvider.push({ provider: 'Anthropic', tokens: antTokens, cost: antCost })
        } else if (costs?.anthropicCosts?.days) {
          // Fallback: build model breakdown from Anthropic daily data
          const typeMap = new Map<string, number>()
          let antCostTotal = 0
          for (const day of costs.anthropicCosts.days) {
            for (const b of (day.breakdown || [])) {
              const prev = typeMap.get(b.type) || 0
              typeMap.set(b.type, prev + (b.cost || 0))
              antCostTotal += (b.cost || 0)
            }
          }
          for (const [type, cost] of typeMap) {
            const estimatedTokens = Math.round(cost / 0.003 * 1000)
            modelBreakdown.push({
              model: `claude-${type}`,
              cost,
              tokens: estimatedTokens,
            })
            totalTokens += estimatedTokens
          }
          totalCost += antCostTotal
          tokensByProvider.push({ provider: 'Anthropic', tokens: totalTokens, cost: antCostTotal })
        }

        // Sort by cost descending
        modelBreakdown.sort((a, b) => b.cost - a.cost)

        const avgCostPerKTokens = totalTokens > 0
          ? (totalCost / totalTokens) * 1000
          : 0

        const topModel = modelBreakdown[0]?.model || 'N/A'
        const cheapestModel = [...modelBreakdown].filter(m => m.tokens > 0)
          .sort((a, b) => (a.cost / a.tokens) - (b.cost / b.tokens))[0]?.model || 'N/A'
        const mostExpensiveModel = [...modelBreakdown].filter(m => m.tokens > 0)
          .sort((a, b) => (b.cost / b.tokens) - (a.cost / a.tokens))[0]?.model || 'N/A'

        const dailyTrend: DailyUsage[] = (history?.history || []).map((d: { date: string; total: number }) => ({
          date: d.date,
          cost: d.total,
        }))

        const anomaly = detectAnomaly(dailyTrend)

        const hasMeaningfulUsage =
          totalTokens > 0 ||
          totalCost > 0 ||
          modelBreakdown.length > 0 ||
          tokensByProvider.some(p => p.tokens > 0 || p.cost > 0)

        if (!hasMeaningfulUsage) {
          setData(null)
          return
        }

        setData({
          totalTokens,
          totalCost,
          avgCostPerKTokens,
          modelBreakdown,
          dailyTrend,
          topModel,
          cheapestModel,
          mostExpensiveModel,
          tokensByProvider,
          anomalyDetected: anomaly.detected,
          anomalyMessage: anomaly.message,
        })
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [range])

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-accent-primary" />
          <h3 className="text-base font-semibold text-text-primary">Usage Analytics</h3>
        </div>
        <div className="h-48 flex items-center justify-center">
          <p className="text-sm text-text-muted animate-pulse">Analyzing usage data...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-accent-primary" />
          <h3 className="text-base font-semibold text-text-primary">Usage Analytics</h3>
        </div>
        <div className="h-48 flex items-center justify-center flex-col gap-2">
          <Layers className="w-8 h-8 text-text-muted" />
          <p className="text-sm text-text-muted">No usage data available</p>
          <p className="text-xs text-text-muted">Connect to OpenClaw and start using agents to see analytics</p>
        </div>
      </div>
    )
  }

  const maxModelCost = Math.max(...data.modelBreakdown.map(m => m.cost), 0.01)

  return (
    <div className="space-y-4">
      {/* Anomaly Alert */}
      {data.anomalyDetected && (
        <div className="glass rounded-2xl p-4 border border-amber-500/20 bg-amber-500/[0.03]">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-400/10 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-amber-300">Spending Anomaly Detected</h4>
              <p className="text-xs text-text-muted mt-1">{data.anomalyMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-violet-400/10">
              <Zap className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Total Tokens</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{formatTokens(data.totalTokens)}</p>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-emerald-400/10">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Total Spend</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{formatUsd(data.totalCost)}</p>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-sky-400/10">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Cost / 1K Tokens</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{formatUsd(data.avgCostPerKTokens)}</p>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-amber-400/10">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Models Used</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{data.modelBreakdown.length}</p>
        </div>
      </div>

      {/* Model Breakdown */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent-primary" />
            <h3 className="text-base font-semibold text-text-primary">Cost by Model</h3>
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

        {data.modelBreakdown.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">No model usage data yet</p>
        ) : (
          <div className="space-y-2">
            {data.modelBreakdown.slice(0, 10).map((model) => {
              const pct = (model.cost / maxModelCost) * 100
              const shortName = model.model.split('/').pop() || model.model
              const costPerK = model.tokens > 0 ? (model.cost / model.tokens) * 1000 : 0

              return (
                <div key={model.model} className="group">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-text-primary font-medium truncate max-w-[200px]" title={model.model}>
                      {shortName}
                    </span>
                    <div className="flex items-center gap-4 text-text-muted">
                      <span>{formatTokens(model.tokens)} tokens</span>
                      <span className="font-medium text-text-primary">{formatUsd(model.cost)}</span>
                    </div>
                  </div>
                  <div className="relative h-6 rounded-lg bg-white/[0.04] overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-accent-primary/40 to-accent-primary/20 transition-all duration-500"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-2">
                      <span className="text-[10px] text-text-muted">
                        {formatUsd(costPerK)}/1K tokens
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Provider Breakdown + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Provider Split */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Provider Split</h3>
          {data.tokensByProvider.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">No provider data</p>
          ) : (
            <div className="space-y-3">
              {data.tokensByProvider.map(p => {
                const totalProviderTokens = data.tokensByProvider.reduce((a, b) => a + b.tokens, 0)
                const pct = totalProviderTokens > 0 ? (p.tokens / totalProviderTokens) * 100 : 0
                const colors: Record<string, string> = {
                  OpenRouter: 'bg-violet-400/60',
                  Anthropic: 'bg-amber-400/60',
                }
                return (
                  <div key={p.provider}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-text-primary font-medium">{p.provider}</span>
                      <span className="text-text-muted">{formatTokens(p.tokens)} · {formatUsd(p.cost)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors[p.provider] || 'bg-sky-400/60'}`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick Insights */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Quick Insights</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-background-elevated">
              <TrendingUp className="w-4 h-4 text-violet-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-text-primary">Most Used Model</p>
                <p className="text-[11px] text-text-muted">{displayModelName(data.topModel)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-background-elevated">
              <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-text-primary">Most Cost-Efficient</p>
                <p className="text-[11px] text-text-muted">{displayModelName(data.cheapestModel)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-background-elevated">
              <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-text-primary">Most Expensive Per Token</p>
                <p className="text-[11px] text-text-muted">{displayModelName(data.mostExpensiveModel)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

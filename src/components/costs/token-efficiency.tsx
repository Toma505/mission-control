'use client'

import { useEffect, useState } from 'react'
import { Gauge, TrendingDown, TrendingUp, Zap, AlertTriangle } from 'lucide-react'
import { formatUsd, formatTokens } from '@/lib/format'

interface ModelUsage {
  model: string
  cost: number
  tokens: number
}

interface EfficiencyData {
  models: ModelUsage[]
  totalCost: number
  totalTokens: number
  avgCostPer1k: number
  mostEfficient: string
  leastEfficient: string
}

function computeEfficiency(activity: ModelUsage[]): EfficiencyData | null {
  if (!activity || activity.length === 0) return null

  const totalCost = activity.reduce((s, m) => s + m.cost, 0)
  const totalTokens = activity.reduce((s, m) => s + m.tokens, 0)

  // Cost per 1k tokens for each model
  const withRates = activity
    .filter(m => m.tokens > 0)
    .map(m => ({
      ...m,
      costPer1k: (m.cost / m.tokens) * 1000,
    }))
    .sort((a, b) => a.costPer1k - b.costPer1k)

  const avgCostPer1k = totalTokens > 0 ? (totalCost / totalTokens) * 1000 : 0

  return {
    models: activity.sort((a, b) => b.cost - a.cost),
    totalCost,
    totalTokens,
    avgCostPer1k,
    mostEfficient: withRates[0]?.model || 'N/A',
    leastEfficient: withRates[withRates.length - 1]?.model || 'N/A',
  }
}

function shortModel(model: string): string {
  // Strip provider prefix like "openrouter/" or "anthropic/"
  const parts = model.split('/')
  return parts[parts.length - 1] || model
}

function EfficiencyBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full bg-white/[0.06] rounded-full h-1.5">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function TokenEfficiency() {
  const [data, setData] = useState<EfficiencyData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/costs')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => {
        if (d.error) return

        // Combine all model usage data
        const activity: ModelUsage[] = []

        // OpenRouter activity (already per-model)
        if (Array.isArray(d.openrouter?.activity)) {
          activity.push(...d.openrouter.activity)
        }

        // Anthropic CSV data — aggregate by model from days
        if (d.anthropicCosts?.days) {
          const modelMap = new Map<string, { cost: number; tokens: number }>()
          for (const day of d.anthropicCosts.days) {
            for (const entry of day.breakdown || []) {
              const existing = modelMap.get(entry.type) || { cost: 0, tokens: 0 }
              existing.cost += entry.cost
              modelMap.set(entry.type, existing)
            }
          }
          for (const [model, usage] of modelMap) {
            activity.push({ model: `anthropic/${model}`, cost: usage.cost, tokens: usage.tokens })
          }
        }

        // Anthropic token data (if available)
        if (d.anthropicTokens?.models) {
          for (const m of d.anthropicTokens.models) {
            const existing = activity.find(a => a.model === `anthropic/${m.model}` || a.model === m.model)
            if (existing && m.tokens) {
              existing.tokens = m.tokens
            }
          }
        }

        setData(computeEfficiency(activity))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="w-5 h-5 text-accent-secondary" />
          <h3 className="text-base font-semibold text-text-primary">Token Efficiency</h3>
        </div>
        <p className="text-sm text-text-muted">Analyzing efficiency...</p>
      </div>
    )
  }

  if (!data || data.models.length === 0) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="w-5 h-5 text-accent-secondary" />
          <h3 className="text-base font-semibold text-text-primary">Token Efficiency</h3>
        </div>
        <div className="h-32 flex items-center justify-center flex-col gap-2">
          <Zap className="w-8 h-8 text-text-muted" />
          <p className="text-sm text-text-muted">No API usage data yet</p>
          <p className="text-xs text-text-muted">Efficiency scores appear once your agent starts using API credits</p>
        </div>
      </div>
    )
  }

  const maxCost = Math.max(...data.models.map(m => m.cost))

  // Efficiency score: 0-100 based on cost per 1k tokens
  // Lower cost = higher score. Baseline: $0.05/1k = 50, $0.01/1k = 90, $0.10/1k = 20
  const efficiencyScore = Math.min(100, Math.max(0, Math.round(100 - (data.avgCostPer1k * 800))))

  const scoreColor = efficiencyScore >= 70
    ? 'text-emerald-400'
    : efficiencyScore >= 40
    ? 'text-amber-400'
    : 'text-red-400'

  const scoreBg = efficiencyScore >= 70
    ? 'bg-emerald-400/10 border-emerald-400/20'
    : efficiencyScore >= 40
    ? 'bg-amber-400/10 border-amber-400/20'
    : 'bg-red-400/10 border-red-400/20'

  return (
    <div className="glass rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Gauge className="w-5 h-5 text-accent-secondary" />
          <h3 className="text-base font-semibold text-text-primary">Token Efficiency</h3>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${scoreBg} ${scoreColor}`}>
          Score: {efficiencyScore}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-background-elevated">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Total Tokens</p>
          <p className="text-lg font-bold text-text-primary">{formatTokens(data.totalTokens)}</p>
        </div>
        <div className="p-3 rounded-xl bg-background-elevated">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Avg $/1k Tokens</p>
          <p className="text-lg font-bold text-text-primary">${data.avgCostPer1k.toFixed(4)}</p>
        </div>
        <div className="p-3 rounded-xl bg-background-elevated">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Total API Cost</p>
          <p className="text-lg font-bold text-text-primary">{formatUsd(data.totalCost)}</p>
        </div>
      </div>

      {/* Efficiency insights */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 p-2.5 rounded-lg bg-emerald-400/5 border border-emerald-400/10">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-emerald-400">Most Efficient</span>
          </div>
          <p className="text-xs font-medium text-text-primary font-mono truncate">
            {shortModel(data.mostEfficient)}
          </p>
        </div>
        <div className="flex-1 p-2.5 rounded-lg bg-amber-400/5 border border-amber-400/10">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] uppercase tracking-wider text-amber-400">Most Expensive</span>
          </div>
          <p className="text-xs font-medium text-text-primary font-mono truncate">
            {shortModel(data.leastEfficient)}
          </p>
        </div>
      </div>

      {/* Per-model breakdown */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-wider text-text-muted">Per-Model Breakdown</p>
        {data.models.slice(0, 8).map(m => {
          const costPer1k = m.tokens > 0 ? (m.cost / m.tokens) * 1000 : 0
          const costPct = data.totalCost > 0 ? (m.cost / data.totalCost) * 100 : 0

          return (
            <div key={m.model} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-primary font-mono truncate max-w-[60%]">
                  {shortModel(m.model)}
                </span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-text-muted">{formatTokens(m.tokens)} tok</span>
                  <span className="text-text-secondary font-medium w-16 text-right">{formatUsd(m.cost)}</span>
                  <span className="text-text-muted w-12 text-right">{costPct.toFixed(0)}%</span>
                </div>
              </div>
              <EfficiencyBar value={m.cost} max={maxCost} color="bg-accent-primary/60" />
              {costPer1k > 0 && (
                <p className="text-[10px] text-text-muted">
                  ${costPer1k.toFixed(4)}/1k tokens
                  {costPer1k > data.avgCostPer1k * 2 && (
                    <span className="ml-2 text-amber-400 inline-flex items-center gap-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" /> High cost
                    </span>
                  )}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {data.models.length > 8 && (
        <p className="text-[10px] text-text-muted mt-2">
          +{data.models.length - 8} more models
        </p>
      )}
    </div>
  )
}

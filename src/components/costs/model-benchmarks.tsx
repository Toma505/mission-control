'use client'

import { useEffect, useState } from 'react'
import {
  BarChart3,
  Zap,
  DollarSign,
  TrendingDown,
  Lightbulb,
  Layers,
  Award,
} from 'lucide-react'
import { formatUsd } from '@/lib/format'

interface ModelBenchmark {
  model: string
  provider: string
  totalCost: number
  totalTokens: number
  costPerKTokens: number
  usageShare: number
  efficiency: 'excellent' | 'good' | 'fair' | 'poor'
}

interface BenchmarkData {
  benchmarks: ModelBenchmark[]
  summary: {
    totalModels: number
    totalCost: number
    totalTokens: number
    avgCostPerK: number
  }
  recommendations: string[]
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

const efficiencyConfig = {
  excellent: { color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Excellent' },
  good: { color: 'text-sky-400', bg: 'bg-sky-400/10', label: 'Good' },
  fair: { color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Fair' },
  poor: { color: 'text-red-400', bg: 'bg-red-400/10', label: 'Poor' },
}

export function ModelBenchmarks() {
  const [data, setData] = useState<BenchmarkData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'cost' | 'tokens' | 'efficiency'>('cost')

  useEffect(() => {
    fetch('/api/benchmarks', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-accent-primary" />
          <h3 className="text-base font-semibold text-text-primary">Model Benchmarks</h3>
        </div>
        <div className="h-48 flex items-center justify-center">
          <p className="text-sm text-text-muted animate-pulse">Analyzing model performance...</p>
        </div>
      </div>
    )
  }

  if (!data || data.benchmarks.length === 0) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-accent-primary" />
          <h3 className="text-base font-semibold text-text-primary">Model Benchmarks</h3>
        </div>
        <div className="h-48 flex flex-col items-center justify-center gap-2">
          <Layers className="w-8 h-8 text-text-muted" />
          <p className="text-sm text-text-muted">No model usage data available</p>
          <p className="text-xs text-text-muted/60">Use your OpenClaw agent to generate benchmark data</p>
        </div>
      </div>
    )
  }

  const sorted = [...data.benchmarks].sort((a, b) => {
    if (sortBy === 'cost') return b.totalCost - a.totalCost
    if (sortBy === 'tokens') return b.totalTokens - a.totalTokens
    const order = { excellent: 0, good: 1, fair: 2, poor: 3 }
    return order[a.efficiency] - order[b.efficiency]
  })

  const maxCost = Math.max(...data.benchmarks.map(b => b.totalCost), 0.01)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-violet-400/10">
              <Layers className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Models</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{data.summary.totalModels}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-emerald-400/10">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Total Spend</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{formatUsd(data.summary.totalCost)}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-sky-400/10">
              <Zap className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Total Tokens</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{formatTokens(data.summary.totalTokens)}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-amber-400/10">
              <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Avg Cost/1K</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{formatUsd(data.summary.avgCostPerK)}</p>
        </div>
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-text-primary">Recommendations</h3>
          </div>
          <div className="space-y-2">
            {data.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-xl bg-amber-500/[0.03]">
                <span className="text-amber-400 text-xs mt-0.5">→</span>
                <p className="text-xs text-text-muted">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model Table */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent-primary" />
            <h3 className="text-base font-semibold text-text-primary">Model Comparison</h3>
          </div>
          <div className="flex gap-1">
            {(['cost', 'tokens', 'efficiency'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                  sortBy === s
                    ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                    : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {sorted.map((b, i) => {
            const ec = efficiencyConfig[b.efficiency]
            const costBarPct = (b.totalCost / maxCost) * 100
            const shortName = b.model.split('/').pop() || b.model

            return (
              <div key={b.model} className="group">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-text-muted/40 w-5 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary truncate max-w-[200px]" title={b.model}>
                          {shortName}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${ec.bg} ${ec.color}`}>
                          {ec.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-text-muted">
                        <span>{formatTokens(b.totalTokens)}</span>
                        <span>{b.usageShare.toFixed(1)}%</span>
                        <span className="font-medium text-text-primary w-16 text-right">{formatUsd(b.totalCost)}</span>
                      </div>
                    </div>
                    <div className="relative h-4 rounded-lg bg-white/[0.04] overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-lg transition-all duration-500 ${
                          b.efficiency === 'excellent' ? 'bg-emerald-500/40' :
                          b.efficiency === 'good' ? 'bg-sky-500/40' :
                          b.efficiency === 'fair' ? 'bg-amber-500/40' : 'bg-red-500/40'
                        }`}
                        style={{ width: `${Math.max(costBarPct, 2)}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-[9px] text-text-muted">
                          {formatUsd(b.costPerKTokens)}/1K tokens
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

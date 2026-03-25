'use client'

import { useEffect, useState } from 'react'

interface ModelComparison {
  id: string
  label: string
  provider: string
  input: number
  output: number
  estimatedMonthlyCost: number
}

interface UsageData {
  dailySpend: number
  monthlySpend: number
  totalInputTokens: number
  totalOutputTokens: number
  currentModel: string
}

const providerColors: Record<string, string> = {
  Anthropic: 'bg-orange-400/20 text-orange-300',
  OpenAI: 'bg-emerald-400/20 text-emerald-300',
  Google: 'bg-blue-400/20 text-blue-300',
  Deepseek: 'bg-violet-400/20 text-violet-300',
  Local: 'bg-zinc-400/20 text-zinc-300',
}

function CostBar({ cost, maxCost }: { cost: number; maxCost: number }) {
  const pct = maxCost > 0 ? Math.min((cost / maxCost) * 100, 100) : 0
  const color = pct < 20 ? 'bg-emerald-400' : pct < 50 ? 'bg-sky-400' : pct < 80 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function CostCompare() {
  const [comparisons, setComparisons] = useState<ModelComparison[]>([])
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [filter, setFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/cost-compare')
      .then(r => r.json())
      .then(data => {
        setComparisons(data.comparisons || [])
        setUsage(data.usage || null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter
    ? comparisons.filter(c => c.provider === filter)
    : comparisons

  const maxCost = Math.max(...filtered.map(c => c.estimatedMonthlyCost), 1)
  const providers = [...new Set(comparisons.map(c => c.provider))]

  const cheapest = filtered[0]
  const currentSpend = usage?.monthlySpend ?? 0
  const savings = cheapest && currentSpend > 0
    ? Math.round(((currentSpend - cheapest.estimatedMonthlyCost) / currentSpend) * 100)
    : 0

  if (loading) {
    return <div className="text-center text-text-muted text-sm py-8">Loading cost comparison...</div>
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      {usage && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-text-muted">Current Monthly Spend</p>
            <p className="text-2xl font-bold text-text-primary">${currentSpend.toFixed(2)}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-text-muted">Cheapest Option</p>
            <p className="text-2xl font-bold text-emerald-400">
              {cheapest ? `$${cheapest.estimatedMonthlyCost.toFixed(2)}` : '—'}
            </p>
            <p className="text-xs text-text-muted">{cheapest?.label}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-text-muted">Potential Savings</p>
            <p className={`text-2xl font-bold ${savings > 0 ? 'text-emerald-400' : 'text-text-primary'}`}>
              {savings > 0 ? `${savings}%` : '—'}
            </p>
            {savings > 0 && (
              <p className="text-xs text-text-muted">
                Save ~${(currentSpend - (cheapest?.estimatedMonthlyCost ?? 0)).toFixed(2)}/mo
              </p>
            )}
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !filter ? 'bg-white/[0.12] text-text-primary' : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
          }`}
        >
          All Providers
        </button>
        {providers.map(p => (
          <button
            key={p}
            onClick={() => setFilter(filter === p ? '' : p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === p ? 'bg-white/[0.12] text-text-primary' : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Comparison table */}
      <div className="space-y-1">
        {filtered.map((model, i) => (
          <div key={model.id} className="glass rounded-xl p-4 flex items-center gap-4">
            <span className="text-xs text-text-muted font-mono w-6 shrink-0">#{i + 1}</span>

            <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${
              providerColors[model.provider] || 'bg-zinc-400/20 text-zinc-300'
            }`}>
              {model.provider}
            </span>

            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary font-medium">{model.label}</p>
              <p className="text-xs text-text-muted">
                ${model.input}/M in · ${model.output}/M out
              </p>
            </div>

            <CostBar cost={model.estimatedMonthlyCost} maxCost={maxCost} />

            <div className="shrink-0 text-right w-24">
              <p className={`text-sm font-bold ${
                model.estimatedMonthlyCost === 0 ? 'text-emerald-400' :
                model.estimatedMonthlyCost < currentSpend * 0.5 ? 'text-emerald-400' :
                model.estimatedMonthlyCost < currentSpend ? 'text-sky-400' :
                'text-text-primary'
              }`}>
                {model.estimatedMonthlyCost === 0 ? 'Free' : `$${model.estimatedMonthlyCost.toFixed(2)}`}
              </p>
              <p className="text-[10px] text-text-muted">/month</p>
            </div>
          </div>
        ))}
      </div>

      <div className="glass rounded-xl p-4">
        <p className="text-xs text-text-muted">
          Estimates based on your current token usage pattern. Local model costs exclude hardware/electricity.
          Actual costs may vary based on caching, batching, and provider-specific pricing changes.
        </p>
      </div>
    </div>
  )
}

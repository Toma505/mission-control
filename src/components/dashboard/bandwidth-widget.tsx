'use client'

import { useState, useEffect } from 'react'
import { DollarSign, TrendingDown, TrendingUp, Shield } from 'lucide-react'
import Link from 'next/link'

export function CostWidget() {
  const [data, setData] = useState<{
    openrouterRemaining: number
    openrouterTotal: number
    dailySpend: number
    pctUsed: number
    dailyLimit: number
    dailyPct: number
    alertLevel: string
    throttled: boolean
  } | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [costsRes, budgetRes] = await Promise.all([
          fetch('/api/costs'),
          fetch('/api/budget'),
        ])
        const costs = costsRes.ok ? await costsRes.json() : {}
        const budget = budgetRes.ok ? await budgetRes.json() : {}

        if (costs.openrouter) {
          const pct = costs.openrouter.totalCredits > 0
            ? (costs.openrouter.totalUsage / costs.openrouter.totalCredits) * 100
            : 0
          setData({
            openrouterRemaining: costs.openrouter.remaining,
            openrouterTotal: costs.openrouter.totalCredits,
            dailySpend: costs.openrouter.usageDaily,
            pctUsed: pct,
            dailyLimit: budget.budget?.dailyLimit ?? 5,
            dailyPct: budget.dailyPct ?? 0,
            alertLevel: budget.alertLevel ?? 'ok',
            throttled: budget.throttled ?? false,
          })
        }
      } catch {}
    }
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (!data) {
    return (
      <div className="glass rounded-2xl p-4">
        <p className="text-[10px] font-medium text-text-muted/70 uppercase tracking-[0.1em] mb-2">Credits</p>
        <p className="text-xs text-text-muted">Loading...</p>
      </div>
    )
  }

  const isLow = data.pctUsed > 70

  const budgetColor = data.alertLevel === 'exceeded' ? 'text-red-400' :
    data.alertLevel === 'critical' ? 'text-orange-400' :
    data.alertLevel === 'warning' ? 'text-amber-400' : 'text-emerald-400'

  const budgetBarColor = data.alertLevel === 'exceeded' ? 'bg-red-400' :
    data.alertLevel === 'critical' ? 'bg-orange-400' :
    data.alertLevel === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <Link href="/costs" className="glass rounded-2xl p-4 block hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-medium text-text-muted/70 uppercase tracking-[0.1em]">OpenRouter Credits</p>
        <DollarSign className="w-3.5 h-3.5 text-text-muted/50" />
      </div>
      <p className={`text-xl font-bold ${isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
        ${data.openrouterRemaining.toFixed(2)}
      </p>
      <div className="w-full bg-white/[0.06] rounded-full h-1.5 mt-2">
        <div
          className={`h-1.5 rounded-full transition-all ${isLow ? 'bg-amber-400' : 'bg-emerald-400'}`}
          style={{ width: `${Math.min(100 - data.pctUsed, 100)}%` }}
        />
      </div>

      {/* Budget bar */}
      <div className="mt-3 pt-2 border-t border-white/[0.04]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-text-muted flex items-center gap-1">
            <Shield className="w-2.5 h-2.5" /> Daily Budget
          </span>
          <span className={`text-[10px] font-medium ${budgetColor}`}>
            ${data.dailySpend.toFixed(2)} / ${data.dailyLimit.toFixed(2)}
          </span>
        </div>
        <div className="w-full bg-white/[0.06] rounded-full h-1">
          <div
            className={`h-1 rounded-full transition-all ${budgetBarColor}`}
            style={{ width: `${Math.min(data.dailyPct, 100)}%` }}
          />
        </div>
        {data.throttled && (
          <p className="text-[9px] text-red-400 mt-1 flex items-center gap-0.5">
            <Shield className="w-2.5 h-2.5" /> Throttled to budget mode
          </p>
        )}
      </div>
    </Link>
  )
}

// Keep old export name for backward compat
export { CostWidget as BandwidthWidget }

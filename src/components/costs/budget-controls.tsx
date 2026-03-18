'use client'

import { useState, useEffect } from 'react'
import { Shield, Zap, AlertTriangle, CheckCircle, Settings } from 'lucide-react'

interface BudgetData {
  budget: {
    dailyLimit: number
    monthlyLimit: number
    autoThrottle: boolean
    throttleMode: string
  }
  spend: { daily: number; monthly: number; remaining: number }
  dailyPct: number
  monthlyPct: number
  alertLevel: 'ok' | 'warning' | 'critical' | 'exceeded'
  throttled: boolean
  projectedMonthly: number
}

export function BudgetControls() {
  const [data, setData] = useState<BudgetData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [dailyLimit, setDailyLimit] = useState('')
  const [monthlyLimit, setMonthlyLimit] = useState('')
  const [autoThrottle, setAutoThrottle] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const fetchBudget = (updateForm = true) => {
    fetch('/api/budget')
      .then(r => r.json())
      .then(d => {
        if (!d.error) {
          setData(d)
          setLoadError(false)
          // Only update form fields if not currently editing
          // (auto-refresh was overwriting user input mid-edit)
          if (updateForm) {
            setDailyLimit(String(d.budget.dailyLimit))
            setMonthlyLimit(String(d.budget.monthlyLimit))
            setAutoThrottle(d.budget.autoThrottle)
          }
        } else {
          setLoadError(true)
        }
      })
      .catch(() => { setLoadError(true) })
  }

  useEffect(() => {
    fetchBudget(true)
    const interval = setInterval(() => fetchBudget(!editing), 30000)
    return () => clearInterval(interval)
  }, [editing])

  const save = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyLimit: parseFloat(dailyLimit) || 5,
          monthlyLimit: parseFloat(monthlyLimit) || 50,
          autoThrottle,
        }),
      })
      if (res.ok) {
        fetchBudget()
        setEditing(false)
      } else {
        setSaveError('Could not save budget settings. Try again.')
      }
    } catch {
      setSaveError('Could not reach OpenClaw. Check your connection.')
    }
    setSaving(false)
  }

  if (!data) {
    return (
      <div className="glass rounded-2xl p-6">
        {loadError ? (
          <div className="text-center space-y-3">
            <AlertTriangle className="w-6 h-6 text-text-muted mx-auto" />
            <p className="text-sm text-text-secondary">Could not load budget data</p>
            <p className="text-xs text-text-muted">Make sure OpenClaw is running and your connection is configured.</p>
            <button
              onClick={() => fetchBudget(true)}
              className="px-4 py-1.5 rounded-lg bg-white/[0.06] text-text-secondary text-xs hover:bg-white/[0.1] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <p className="text-sm text-text-muted">Loading budget...</p>
        )}
      </div>
    )
  }

  const alertColors = {
    ok: 'text-emerald-400',
    warning: 'text-amber-400',
    critical: 'text-orange-400',
    exceeded: 'text-red-400',
  }

  const alertBg = {
    ok: 'bg-emerald-400/10 border-emerald-400/20',
    warning: 'bg-amber-400/10 border-amber-400/20',
    critical: 'bg-orange-400/10 border-orange-400/20',
    exceeded: 'bg-red-400/10 border-red-400/20',
  }

  const alertIcons = {
    ok: <CheckCircle className="w-4 h-4 text-emerald-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    critical: <AlertTriangle className="w-4 h-4 text-orange-400" />,
    exceeded: <Shield className="w-4 h-4 text-red-400" />,
  }

  const alertLabels = {
    ok: 'Within budget',
    warning: 'Approaching limit',
    critical: 'Near limit',
    exceeded: data.throttled ? 'Throttled to budget mode' : 'Over budget',
  }

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent-primary" />
          <h3 className="text-base font-semibold text-text-primary">Spending Limits</h3>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          title="Edit limits"
        >
          <Settings className="w-4 h-4 text-text-muted" />
        </button>
      </div>

      {/* Status banner */}
      <div className={`rounded-xl p-3 border mb-4 ${alertBg[data.alertLevel]}`}>
        <div className="flex items-center gap-2">
          {alertIcons[data.alertLevel]}
          <span className={`text-sm font-medium ${alertColors[data.alertLevel]}`}>
            {alertLabels[data.alertLevel]}
          </span>
          {data.budget.autoThrottle && (
            <span className="ml-auto text-[10px] text-text-muted flex items-center gap-1">
              <Zap className="w-3 h-3" /> Auto-throttle {data.alertLevel === 'exceeded' ? 'active' : 'armed'}
            </span>
          )}
        </div>
      </div>

      {/* Daily limit */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-text-secondary">Daily Spend</span>
          <span className="text-xs text-text-muted">
            ${data.spend.daily.toFixed(2)} / ${data.budget.dailyLimit.toFixed(2)}
          </span>
        </div>
        <div className="w-full bg-white/[0.06] rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              data.dailyPct >= 100 ? 'bg-red-400' :
              data.dailyPct >= 80 ? 'bg-amber-400' :
              'bg-emerald-400'
            }`}
            style={{ width: `${Math.min(data.dailyPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Monthly limit */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-text-secondary">Monthly Spend</span>
          <span className="text-xs text-text-muted">
            ${data.spend.monthly.toFixed(2)} / ${data.budget.monthlyLimit.toFixed(2)}
          </span>
        </div>
        <div className="w-full bg-white/[0.06] rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              data.monthlyPct >= 100 ? 'bg-red-400' :
              data.monthlyPct >= 80 ? 'bg-amber-400' :
              'bg-emerald-400'
            }`}
            style={{ width: `${Math.min(data.monthlyPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Projection */}
      <div className="text-xs text-text-muted mb-1">
        At current pace: <span className={data.projectedMonthly > data.budget.monthlyLimit ? 'text-amber-400 font-medium' : 'text-text-secondary'}>
          ~${data.projectedMonthly.toFixed(0)}/mo projected
        </span>
      </div>

      {/* Credits remaining */}
      <div className="text-xs text-text-muted">
        OpenRouter balance: <span className="text-text-secondary">${data.spend.remaining.toFixed(2)}</span>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Daily Limit ($)</label>
              <input
                type="number"
                value={dailyLimit}
                onChange={e => setDailyLimit(e.target.value)}
                step="0.5"
                min="0"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Monthly Limit ($)</label>
              <input
                type="number"
                value={monthlyLimit}
                onChange={e => setMonthlyLimit(e.target.value)}
                step="5"
                min="0"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary/50"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoThrottle}
              onChange={e => setAutoThrottle(e.target.checked)}
              className="rounded border-white/20 bg-white/[0.04] text-accent-primary focus:ring-accent-primary/50"
            />
            <span className="text-xs text-text-secondary">Auto-switch to budget mode when limit exceeded</span>
          </label>

          {saveError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-400/10 border border-red-400/20 text-xs text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {saveError}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setSaveError('') }}
              className="px-4 py-1.5 rounded-lg bg-white/[0.06] text-text-secondary text-xs hover:bg-white/[0.1] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

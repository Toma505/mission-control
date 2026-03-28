'use client'

import { useEffect, useState } from 'react'
import {
  Bell,
  BellRing,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  History,
  Settings,
  Shield,
  DollarSign,
  Gauge,
  X,
  Check,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'

interface AlertRule {
  id: string
  name: string
  enabled: boolean
  type: string
  condition: { metric: string; operator: string; value: number }
  action: string
  cooldownMinutes: number
  lastTriggered?: string
  createdAt: string
}

interface AlertHistory {
  ruleId: string
  ruleName: string
  message: string
  timestamp: string
}

const ALERT_TYPE_OPTIONS = [
  { value: 'spend_daily', label: 'Daily Spend', icon: DollarSign, metric: 'openrouter.usageDaily', unit: '$' },
  { value: 'spend_monthly', label: 'Monthly Spend', icon: DollarSign, metric: 'openrouter.usageMonthly', unit: '$' },
  { value: 'credits_low', label: 'Credits Low', icon: Gauge, metric: 'openrouter.remainingPct', unit: '%' },
  { value: 'budget_pct', label: 'Budget Usage', icon: Shield, metric: 'budget.maxPct', unit: '%' },
]

const OPERATOR_LABELS: Record<string, string> = {
  gt: 'is above',
  lt: 'is below',
  gte: 'reaches',
  lte: 'drops to',
  eq: 'equals',
}

const ACTION_OPTIONS = [
  { value: 'notify', label: 'Notify only' },
  { value: 'notify_and_throttle', label: 'Notify & auto-throttle' },
  { value: 'throttle', label: 'Auto-throttle silently' },
]

export function SmartAlerts() {
  const [rules, setRules] = useState<AlertRule[]>([])
  const [history, setHistory] = useState<AlertHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // New rule form state
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('spend_daily')
  const [newOperator, setNewOperator] = useState('gt')
  const [newValue, setNewValue] = useState('5')
  const [newAction, setNewAction] = useState('notify')
  const [newCooldown, setNewCooldown] = useState('60')

  useEffect(() => {
    fetchAlerts()

    // Poll alert checks every 60 seconds; desktop notifications are handled centrally
    // by the Notification Center once alerts are persisted to notifications.json.
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/alerts/check')
        const data = await res.json()
        if (data.triggered?.length > 0) {
          // Refresh rules to get updated lastTriggered timestamps
          fetchAlerts()
        }
      } catch {}
    }, 60_000)

    return () => clearInterval(interval)
  }, [])

  async function fetchAlerts() {
    setLoading(true)
    try {
      const res = await fetch('/api/alerts')
      const data = await res.json()
      if (!data.error) {
        setRules(data.rules || [])
        setHistory(data.history || [])
      }
    } catch {
      setError('Could not load alerts')
    }
    setLoading(false)
  }

  async function toggleRule(ruleId: string) {
    try {
      const res = await apiFetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', ruleId }),
      })
      const data = await res.json()
      if (data.ok) {
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: data.rule.enabled } : r))
      }
    } catch {}
  }

  async function deleteRule(ruleId: string) {
    try {
      const res = await apiFetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ruleId }),
      })
      const data = await res.json()
      if (data.ok) {
        setRules(prev => prev.filter(r => r.id !== ruleId))
      }
    } catch {}
  }

  async function createRule() {
    setSaving(true)
    setError('')

    const typeConfig = ALERT_TYPE_OPTIONS.find(t => t.value === newType)
    const rule = {
      name: newName || typeConfig?.label || 'New Alert',
      type: newType,
      condition: {
        metric: typeConfig?.metric || 'openrouter.usageDaily',
        operator: newOperator,
        value: parseFloat(newValue) || 0,
      },
      action: newAction,
      cooldownMinutes: parseInt(newCooldown) || 60,
    }

    try {
      const res = await apiFetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', rule }),
      })
      const data = await res.json()
      if (data.ok) {
        setRules(prev => [...prev, data.rule])
        setShowCreate(false)
        resetForm()
      } else {
        setError(data.error || 'Failed to create alert')
      }
    } catch {
      setError('Could not save alert')
    }
    setSaving(false)
  }

  function resetForm() {
    setNewName('')
    setNewType('spend_daily')
    setNewOperator('gt')
    setNewValue('5')
    setNewAction('notify')
    setNewCooldown('60')
  }

  function getTypeIcon(type: string) {
    const config = ALERT_TYPE_OPTIONS.find(t => t.value === type)
    const Icon = config?.icon || Bell
    return <Icon className="w-4 h-4" />
  }

  function getTypeUnit(type: string) {
    return ALERT_TYPE_OPTIONS.find(t => t.value === type)?.unit || ''
  }

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <BellRing className="w-5 h-5 text-accent-highlight" />
          <h3 className="text-base font-semibold text-text-primary">Smart Alerts</h3>
        </div>
        <p className="text-sm text-text-muted">Loading alert rules...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-accent-highlight" />
            <h3 className="text-base font-semibold text-text-primary">Smart Alerts</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent-highlight/10 text-accent-highlight">
              {rules.filter(r => r.enabled).length} active
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showHistory
                  ? 'bg-accent-primary/20 text-accent-primary'
                  : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
              }`}
            >
              <History className="w-3.5 h-3.5 inline mr-1" />
              History
            </button>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-3 py-1.5 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/80 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 inline mr-1" />
              New Alert
            </button>
          </div>
        </div>

        <p className="text-xs text-text-muted">
          Configure alerts to monitor spend, budget usage, and credit levels. Alerts can notify you or automatically throttle to budget mode.
        </p>
      </div>

      {/* Create alert form */}
      {showCreate && (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-text-primary">Create Alert Rule</h4>
            <button onClick={() => { setShowCreate(false); resetForm() }} className="text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Alert Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. High daily spend warning"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-primary/50"
              />
            </div>

            {/* Type + Condition row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">When</label>
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary/50"
                >
                  {ALERT_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Condition</label>
                <select
                  value={newOperator}
                  onChange={e => setNewOperator(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary/50"
                >
                  {Object.entries(OPERATOR_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">
                  Threshold ({getTypeUnit(newType)})
                </label>
                <input
                  type="number"
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  min="0"
                  step="0.5"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary/50"
                />
              </div>
            </div>

            {/* Action + Cooldown */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Action</label>
                <select
                  value={newAction}
                  onChange={e => setNewAction(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary/50"
                >
                  {ACTION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Cooldown (minutes)</label>
                <input
                  type="number"
                  value={newCooldown}
                  onChange={e => setNewCooldown(e.target.value)}
                  min="5"
                  step="5"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary/50"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-400/10 border border-red-400/20 text-xs text-red-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={createRule}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Alert'}
              </button>
              <button
                onClick={() => { setShowCreate(false); resetForm() }}
                className="px-4 py-2 rounded-lg bg-white/[0.06] text-text-secondary text-xs hover:bg-white/[0.1] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert rules list */}
      <div className="space-y-3">
        {rules.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <Bell className="w-8 h-8 text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-secondary">No alert rules configured</p>
            <p className="text-xs text-text-muted mt-1">Create your first alert to start monitoring</p>
          </div>
        ) : (
          rules.map(rule => {
            const typeConfig = ALERT_TYPE_OPTIONS.find(t => t.value === rule.type)
            const unit = typeConfig?.unit || ''
            const operatorLabel = OPERATOR_LABELS[rule.condition.operator] || rule.condition.operator
            const actionConfig = ACTION_OPTIONS.find(a => a.value === rule.action)

            return (
              <div
                key={rule.id}
                className={`glass rounded-2xl p-4 transition-opacity ${!rule.enabled ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  {/* Type icon */}
                  <div className={`p-2 rounded-xl ${rule.enabled ? 'bg-accent-highlight/10' : 'bg-white/[0.04]'}`}>
                    <span className={rule.enabled ? 'text-accent-highlight' : 'text-text-muted'}>
                      {getTypeIcon(rule.type)}
                    </span>
                  </div>

                  {/* Rule info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">{rule.name}</p>
                      {rule.action === 'notify_and_throttle' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">
                          Auto-throttle
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      When {typeConfig?.label?.toLowerCase() || rule.condition.metric} {operatorLabel} {unit === '$' ? `$${rule.condition.value}` : `${rule.condition.value}${unit}`}
                      <span className="text-text-muted/50"> — {actionConfig?.label || rule.action}</span>
                    </p>
                    {rule.lastTriggered && (
                      <p className="text-[10px] text-text-muted mt-1">
                        Last triggered: {new Date(rule.lastTriggered).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
                      title={rule.enabled ? 'Disable' : 'Enable'}
                    >
                      {rule.enabled ? (
                        <ToggleRight className="w-5 h-5 text-accent-highlight" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-text-muted" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="p-1.5 rounded-lg hover:bg-red-400/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-text-muted hover:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Alert history */}
      {showHistory && (
        <div className="glass rounded-2xl p-6">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Alert History</h4>
          {history.length === 0 ? (
            <p className="text-xs text-text-muted">No alerts have been triggered yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {[...history].reverse().map((entry, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-background-elevated">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary">{entry.ruleName}</p>
                    <p className="text-[11px] text-text-muted">{entry.message}</p>
                    <p className="text-[10px] text-text-muted/50 mt-0.5">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

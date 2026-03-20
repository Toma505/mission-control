'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Clock,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Power,
  Sun,
  Moon,
  X,
  Shield,
  Zap,
  Sparkles,
  Brain,
  AlertTriangle,
  Check,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'

interface ScheduleEntry {
  id: string
  name: string
  mode: 'best' | 'standard' | 'budget' | 'auto'
  startTime: string
  endTime: string
  days: number[]
  enabled: boolean
}

interface ScheduleData {
  enabled: boolean
  entries: ScheduleEntry[]
  activeEntry: { id: string; name: string; mode: string } | null
  lastApplied?: string
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const MODE_CONFIG = {
  best: { label: 'Best', icon: Shield, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
  standard: { label: 'Standard', icon: Sparkles, color: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/30' },
  budget: { label: 'Budget', icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
  auto: { label: 'Auto', icon: Brain, color: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/30' },
}

type ModeName = keyof typeof MODE_CONFIG

export function ModeSchedule() {
  const [data, setData] = useState<ScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Form state
  const [newName, setNewName] = useState('')
  const [newMode, setNewMode] = useState<ModeName>('budget')
  const [newStart, setNewStart] = useState('18:00')
  const [newEnd, setNewEnd] = useState('09:00')
  const [newDays, setNewDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchSchedule()
    // Check schedule every 5 minutes
    const interval = setInterval(() => applySchedule(), 300_000)
    return () => {
      clearInterval(interval)
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current)
    }
  }, [])

  async function fetchSchedule() {
    setLoading(true)
    try {
      const res = await fetch('/api/mode/schedule')
      const d = await res.json()
      if (!d.error) setData(d)
    } catch {}
    setLoading(false)
  }

  async function toggleSchedule() {
    try {
      const res = await apiFetch('/api/mode/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_schedule' }),
      })
      const d = await res.json()
      if (d.ok) {
        setData(prev => prev ? { ...prev, enabled: d.enabled } : prev)
        if (d.enabled) applySchedule()
      }
    } catch {}
  }

  async function applySchedule() {
    try {
      const res = await apiFetch('/api/mode/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply' }),
      })
      const d = await res.json()
      if (d.applied) {
        setStatus({ type: 'success', message: `Switched to ${d.mode} mode (${d.entryName})` })
        fetchSchedule()
        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current)
        statusTimeoutRef.current = setTimeout(() => setStatus(null), 5000)
      }
    } catch {}
  }

  async function toggleEntry(entryId: string) {
    try {
      const res = await apiFetch('/api/mode/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', entryId }),
      })
      const d = await res.json()
      if (d.ok) {
        setData(prev => prev ? {
          ...prev,
          entries: prev.entries.map(e => e.id === entryId ? { ...e, enabled: d.entry.enabled } : e),
        } : prev)
      }
    } catch {}
  }

  async function deleteEntry(entryId: string) {
    try {
      const res = await apiFetch('/api/mode/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', entryId }),
      })
      const d = await res.json()
      if (d.ok) {
        setData(prev => prev ? { ...prev, entries: prev.entries.filter(e => e.id !== entryId) } : prev)
      }
    } catch {}
  }

  async function createEntry() {
    setSaving(true)
    setError('')
    try {
      const res = await apiFetch('/api/mode/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          entry: {
            name: newName || `${MODE_CONFIG[newMode].label} mode — ${newStart} to ${newEnd}`,
            mode: newMode,
            startTime: newStart,
            endTime: newEnd,
            days: newDays,
          },
        }),
      })
      const d = await res.json()
      if (d.ok) {
        setData(prev => prev ? { ...prev, entries: [...prev.entries, d.entry] } : prev)
        setShowCreate(false)
        resetForm()
      } else {
        setError(d.error || 'Failed to create')
      }
    } catch {
      setError('Could not save schedule')
    }
    setSaving(false)
  }

  function resetForm() {
    setNewName('')
    setNewMode('budget')
    setNewStart('18:00')
    setNewEnd('09:00')
    setNewDays([0, 1, 2, 3, 4, 5, 6])
  }

  function toggleDay(day: number) {
    setNewDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort())
  }

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-accent-secondary" />
          <h3 className="text-base font-semibold text-text-primary">Mode Schedule</h3>
        </div>
        <p className="text-sm text-text-muted">Loading schedule...</p>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="glass rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-accent-secondary" />
          <h3 className="text-base font-semibold text-text-primary">Mode Schedule</h3>
          {data.activeEntry && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${MODE_CONFIG[data.activeEntry.mode as ModeName]?.bg} ${MODE_CONFIG[data.activeEntry.mode as ModeName]?.color}`}>
              {data.activeEntry.mode} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSchedule}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              data.enabled
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {data.enabled ? 'Active' : 'Off'}
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
            title="Add schedule"
          >
            <Plus className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      </div>

      <p className="text-xs text-text-muted mb-4">
        Automatically switch AI modes based on time of day. Save money overnight, use premium during work hours.
      </p>

      {/* Status message */}
      {status && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-xs ${
          status.type === 'success'
            ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
            : 'bg-red-400/10 text-red-400 border border-red-400/20'
        }`}>
          {status.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {status.message}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-4 p-4 rounded-xl bg-background-elevated border border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-primary">New Schedule Entry</span>
            <button onClick={() => { setShowCreate(false); resetForm() }} className="text-text-muted hover:text-text-primary">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Schedule name (optional)"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-primary/50"
          />

          {/* Mode selector */}
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(MODE_CONFIG) as ModeName[]).map(mode => {
              const cfg = MODE_CONFIG[mode]
              const Icon = cfg.icon
              const selected = newMode === mode
              return (
                <button
                  key={mode}
                  onClick={() => setNewMode(mode)}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    selected
                      ? `${cfg.border} ${cfg.bg}`
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className={`w-4 h-4 mx-auto mb-1 ${selected ? cfg.color : 'text-text-muted'}`} />
                  <span className={`text-[10px] font-medium ${selected ? cfg.color : 'text-text-muted'}`}>
                    {cfg.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Start Time</label>
              <input
                type="time"
                value={newStart}
                onChange={e => setNewStart(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">End Time</label>
              <input
                type="time"
                value={newEnd}
                onChange={e => setNewEnd(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary/50"
              />
            </div>
          </div>

          {/* Day selector */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Active Days</label>
            <div className="flex gap-1.5">
              {DAY_SHORT.map((label, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    newDays.includes(i)
                      ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                      : 'bg-white/[0.04] text-text-muted border border-white/[0.06] hover:bg-white/[0.08]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={createEntry}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreate(false); resetForm() }}
              className="px-4 py-1.5 rounded-lg bg-white/[0.06] text-text-secondary text-xs hover:bg-white/[0.1] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Schedule entries */}
      <div className="space-y-2">
        {data.entries.length === 0 ? (
          <div className="text-center py-6">
            <Clock className="w-6 h-6 text-text-muted mx-auto mb-2" />
            <p className="text-xs text-text-muted">No schedules configured</p>
          </div>
        ) : (
          data.entries.map(entry => {
            const cfg = MODE_CONFIG[entry.mode]
            const Icon = cfg.icon
            const isActive = data.activeEntry?.id === entry.id && data.enabled
            const isOvernight = entry.startTime > entry.endTime

            return (
              <div
                key={entry.id}
                className={`p-3 rounded-xl border transition-all ${
                  isActive
                    ? `${cfg.border} ${cfg.bg}`
                    : `border-white/[0.06] ${entry.enabled ? 'bg-white/[0.02]' : 'bg-white/[0.01] opacity-50'}`
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Mode icon */}
                  <div className={`p-1.5 rounded-lg ${cfg.bg}`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">{entry.name}</p>
                      {isActive && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-status-active/10 text-status-active border border-status-active/20">
                          NOW
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        {isOvernight ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                        {entry.startTime} — {entry.endTime}
                      </span>
                      <span className="text-[10px] text-text-muted/60">
                        {entry.days.map(d => DAY_LABELS[d]).join(', ')}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleEntry(entry.id)}
                      className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
                    >
                      {entry.enabled ? (
                        <ToggleRight className="w-5 h-5 text-accent-highlight" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-text-muted" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="p-1.5 rounded-lg hover:bg-red-400/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-text-muted hover:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

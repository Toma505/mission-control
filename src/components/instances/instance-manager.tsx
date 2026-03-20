'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Server,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Zap,
  Users,
  Activity,
  Globe,
  ChevronDown,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'

interface InstanceHealth {
  mode?: string
  model?: string
  uptime?: string
  agents?: number
  checkedAt: string
}

interface Instance {
  id: string
  name: string
  url: string
  enabled: boolean
  color: string
  addedAt: string
  lastSeen?: string
  status?: 'online' | 'offline' | 'error'
  statusMessage?: string
  health?: InstanceHealth
}

const MODE_COLORS: Record<string, string> = {
  best: 'bg-amber-400',
  standard: 'bg-sky-400',
  budget: 'bg-emerald-400',
  auto: 'bg-violet-400',
}

function StatusDot({ status }: { status?: string }) {
  const color =
    status === 'online' ? 'bg-emerald-400' :
    status === 'error' ? 'bg-amber-400' :
    'bg-red-400'

  return (
    <span className={`w-2 h-2 rounded-full ${color} ${status === 'online' ? 'animate-pulse' : ''}`} />
  )
}

function InstanceCard({ instance, onRefresh, onDelete, onToggle }: {
  instance: Instance
  onRefresh: (id: string) => void
  onDelete: (id: string) => void
  onToggle: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const shortModel = (m?: string) => {
    if (!m) return '—'
    const parts = m.split('/')
    return parts[parts.length - 1] || m
  }

  const timeAgo = (iso?: string) => {
    if (!iso) return 'Never'
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
  }

  return (
    <div className={`rounded-xl border transition-all ${
      instance.enabled
        ? 'bg-white/[0.02] border-white/[0.08] hover:border-white/[0.12]'
        : 'bg-white/[0.01] border-white/[0.04] opacity-60'
    }`}>
      {/* Color accent bar */}
      <div className="h-1 rounded-t-xl" style={{ backgroundColor: instance.color }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${instance.color}15` }}
            >
              <Server className="w-5 h-5" style={{ color: instance.color }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-text-primary truncate">{instance.name}</h4>
                <StatusDot status={instance.status} />
              </div>
              <p className="text-xs text-text-muted truncate">{instance.url}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onRefresh(instance.id)}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
              title="Refresh status"
            >
              <RefreshCw className="w-3.5 h-3.5 text-text-muted" />
            </button>
            <button
              onClick={() => onToggle(instance.id)}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
              title={instance.enabled ? 'Disable' : 'Enable'}
            >
              {instance.enabled
                ? <Eye className="w-3.5 h-3.5 text-text-muted" />
                : <EyeOff className="w-3.5 h-3.5 text-text-muted" />}
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        {instance.health && instance.status === 'online' && (
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-background-elevated">
              <Activity className="w-3 h-3 text-text-muted" />
              <span className="text-xs text-text-primary capitalize">{instance.health.mode || '—'}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-background-elevated">
              <Zap className="w-3 h-3 text-text-muted" />
              <span className="text-xs text-text-primary truncate">{shortModel(instance.health.model)}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-background-elevated">
              <Users className="w-3 h-3 text-text-muted" />
              <span className="text-xs text-text-primary">{instance.health.agents ?? 0} sessions</span>
            </div>
          </div>
        )}

        {instance.status === 'offline' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-400/5 border border-red-400/10">
            <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="text-xs text-red-400">{instance.statusMessage || 'Connection failed'}</span>
          </div>
        )}

        {instance.status === 'error' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-400/5 border border-amber-400/10">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-400">{instance.statusMessage || 'Error communicating'}</span>
          </div>
        )}

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Added</span>
              <span className="text-text-secondary">{new Date(instance.addedAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Last seen</span>
              <span className="text-text-secondary">{timeAgo(instance.lastSeen)}</span>
            </div>
            {instance.health?.checkedAt && (
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Last check</span>
                <span className="text-text-secondary">{timeAgo(instance.health.checkedAt)}</span>
              </div>
            )}
            <button
              onClick={() => onDelete(instance.id)}
              className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-400/5 border border-red-400/10 text-xs text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Remove Instance
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function InstanceManager() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadInstances = useCallback(async (refresh = false) => {
    try {
      const url = refresh ? '/api/instances?refresh=true' : '/api/instances'
      const res = await fetch(url)
      const data = await res.json()
      if (data.instances) setInstances(data.instances)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    loadInstances().finally(() => setLoading(false))

    // Auto-refresh every 60s
    refreshTimerRef.current = setInterval(() => {
      loadInstances(true)
    }, 60000)

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [loadInstances])

  async function refreshAll() {
    setRefreshing(true)
    await loadInstances(true)
    setRefreshing(false)
  }

  async function testConnection() {
    if (!newUrl || !newPassword) return
    setTesting(true)
    setTestResult(null)

    try {
      const res = await apiFetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-new',
          instance: { url: newUrl, password: newPassword },
        }),
      })
      const data = await res.json()
      setTestResult({
        ok: data.ok,
        message: data.ok
          ? `Connected! Mode: ${data.health?.mode || 'unknown'}`
          : data.statusMessage || 'Connection failed',
      })
    } catch {
      setTestResult({ ok: false, message: 'Network error' })
    } finally {
      setTesting(false)
    }
  }

  async function addInstance() {
    if (!newName.trim() || !newUrl.trim() || !newPassword.trim()) return
    setSaving(true)

    try {
      const res = await apiFetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          instance: { name: newName.trim(), url: newUrl.trim(), password: newPassword.trim() },
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setNewName('')
        setNewUrl('')
        setNewPassword('')
        setShowAddForm(false)
        setTestResult(null)
        await loadInstances()
      }
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  async function deleteInstance(id: string) {
    try {
      await apiFetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', instanceId: id }),
      })
      setInstances(prev => prev.filter(i => i.id !== id))
    } catch {
      // silent
    }
  }

  async function toggleInstance(id: string) {
    try {
      const res = await apiFetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', instanceId: id }),
      })
      const data = await res.json()
      if (data.ok) {
        setInstances(prev => prev.map(i => i.id === id ? { ...i, enabled: data.instance.enabled } : i))
      }
    } catch {
      // silent
    }
  }

  async function refreshInstance(id: string) {
    try {
      const res = await apiFetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', instanceId: id }),
      })
      const data = await res.json()
      if (data.ok) {
        setInstances(prev => prev.map(i => i.id === id ? { ...i, ...data.instance } : i))
      }
    } catch {
      // silent
    }
  }

  // ─── Aggregated stats ────────────────────────────────
  const onlineCount = instances.filter(i => i.status === 'online' && i.enabled).length
  const totalSessions = instances.reduce((s, i) => s + (i.health?.agents || 0), 0)
  const uniqueModes = [...new Set(instances.filter(i => i.status === 'online').map(i => i.health?.mode).filter(Boolean))]

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-accent-primary" />
          <h3 className="text-base font-semibold text-text-primary">Instances</h3>
        </div>
        <div className="h-32 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Total Instances</p>
          <p className="text-2xl font-bold text-text-primary">{instances.length}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Online</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-emerald-400">{onlineCount}</p>
            {instances.length > 0 && (
              <span className="text-xs text-text-muted">/ {instances.length}</span>
            )}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Active Sessions</p>
          <p className="text-2xl font-bold text-accent-primary">{totalSessions}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Modes Active</p>
          <div className="flex items-center gap-1.5 mt-1">
            {uniqueModes.length > 0 ? uniqueModes.map(m => (
              <span
                key={m}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${
                  MODE_COLORS[m || ''] ? `${MODE_COLORS[m || '']}/20 text-text-primary` : 'bg-white/[0.06] text-text-secondary'
                }`}
              >
                {m}
              </span>
            )) : (
              <span className="text-sm text-text-muted">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Instance list + controls */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-accent-primary" />
            <h3 className="text-base font-semibold text-text-primary">Connected Instances</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshAll}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] text-xs text-text-secondary hover:bg-white/[0.08] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh All
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-primary/10 text-xs text-accent-primary hover:bg-accent-primary/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Instance
            </button>
          </div>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="mb-4 p-4 rounded-xl bg-background-elevated border border-white/[0.08] space-y-3">
            <p className="text-xs font-medium text-text-primary">Add New OpenClaw Instance</p>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Production Agent"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-primary/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">URL</label>
                <input
                  type="text"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  placeholder="https://my-agent.up.railway.app"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-primary/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Setup Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="password"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-primary/50"
                />
              </div>
            </div>

            {testResult && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                testResult.ok
                  ? 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-400'
                  : 'bg-red-400/10 border border-red-400/20 text-red-400'
              }`}>
                {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                {testResult.message}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={testConnection}
                disabled={testing || !newUrl || !newPassword}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] text-xs text-text-secondary hover:bg-white/[0.08] transition-colors disabled:opacity-40"
              >
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                Test Connection
              </button>
              <button
                onClick={addInstance}
                disabled={saving || !newName || !newUrl || !newPassword}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent-primary text-xs text-white hover:bg-accent-primary/80 transition-colors disabled:opacity-40"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add Instance
              </button>
              <button
                onClick={() => { setShowAddForm(false); setTestResult(null) }}
                className="px-3 py-2 rounded-lg text-xs text-text-muted hover:bg-white/[0.06] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Instance cards */}
        {instances.length === 0 ? (
          <div className="h-48 flex items-center justify-center flex-col gap-3">
            <Server className="w-10 h-10 text-text-muted/40" />
            <p className="text-sm text-text-secondary">No instances connected</p>
            <p className="text-xs text-text-muted max-w-sm text-center">
              Add your OpenClaw instances to monitor and manage them all from one dashboard.
              Each instance needs its URL and setup password.
            </p>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-primary text-sm text-white hover:bg-accent-primary/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Your First Instance
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {instances.map(inst => (
              <InstanceCard
                key={inst.id}
                instance={inst}
                onRefresh={refreshInstance}
                onDelete={deleteInstance}
                onToggle={toggleInstance}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

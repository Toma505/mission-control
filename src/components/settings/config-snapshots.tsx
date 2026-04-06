'use client'

import { useEffect, useState } from 'react'
import {
  Camera,
  RotateCcw,
  Trash2,
  Plus,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Layers,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'

interface ConfigSnapshot {
  id: string
  name: string
  createdAt: string
  data: {
    budget?: Record<string, unknown>
    mode?: string
    openclawUrl?: string
  }
}

export function ConfigSnapshots() {
  const [snapshots, setSnapshots] = useState<ConfigSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    fetchSnapshots()
  }, [])

  async function fetchSnapshots() {
    setLoading(true)
    try {
      const res = await fetch('/api/snapshots')
      const data = await res.json()
      setSnapshots(data.snapshots || [])
    } catch {}
    setLoading(false)
  }

  async function createSnapshot() {
    setSaving(true)
    setStatus(null)
    try {
      const res = await apiFetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: name || undefined }),
      })
      const data = await res.json()
      if (data.ok) {
        setSnapshots(prev => [...prev, data.snapshot])
        setShowCreate(false)
        setName('')
        setStatus({ type: 'success', message: `Snapshot "${data.snapshot.name}" created` })
      }
    } catch {
      setStatus({ type: 'error', message: 'Failed to create snapshot' })
    }
    setSaving(false)
  }

  async function restoreSnapshot(id: string, snapshotName: string) {
    setStatus(null)
    try {
      const res = await apiFetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', snapshotId: id }),
      })
      const data = await res.json()
      if (data.ok) {
        setStatus({ type: 'success', message: `Restored "${snapshotName}" — budget and mode applied` })
      }
    } catch {
      setStatus({ type: 'error', message: 'Failed to restore snapshot' })
    }
  }

  async function deleteSnapshot(id: string) {
    try {
      const res = await apiFetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', snapshotId: id }),
      })
      const data = await res.json()
      if (data.ok) {
        setSnapshots(prev => prev.filter(s => s.id !== id))
      }
    } catch {}
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-accent-highlight" />
            <h3 className="text-base font-semibold text-text-primary">Config Snapshots</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent-highlight/10 text-accent-highlight">
              {snapshots.length} saved
            </span>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 inline mr-1" />
            Save Current
          </button>
        </div>
        <p className="text-xs text-text-muted">
          Save your current budget limits, mode, and connection settings as a snapshot. Restore anytime with one click.
        </p>
      </div>

      {/* Status message */}
      {status && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs ${
          status.type === 'success'
            ? 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-400'
            : 'bg-red-400/10 border border-red-400/20 text-red-400'
        }`}>
          {status.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {status.message}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-text-primary">Save Snapshot</h4>
            <button onClick={() => setShowCreate(false)} className="text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
                  placeholder='e.g. "Primary workspace config" or "Friday night budget"'
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-primary/50"
              onKeyDown={e => e.key === 'Enter' && createSnapshot()}
            />
            <button
              onClick={createSnapshot}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-text-muted mt-2">
            Saves: budget limits, active mode, and connection URL. Does not save passwords or API keys.
          </p>
        </div>
      )}

      {/* Snapshots list */}
      {loading ? (
        <div className="glass rounded-2xl p-8 text-center">
          <Loader2 className="w-5 h-5 text-text-muted mx-auto animate-spin" />
        </div>
      ) : snapshots.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <Camera className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary">No snapshots saved</p>
          <p className="text-xs text-text-muted mt-1">Save your first config snapshot to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {snapshots.map(snap => (
            <div key={snap.id} className="glass rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-accent-highlight/10">
                  <Camera className="w-4 h-4 text-accent-highlight" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{snap.name}</p>
                  <p className="text-[11px] text-text-muted">
                    {new Date(snap.createdAt).toLocaleString()}
                    {snap.data.mode && <> &middot; Mode: {snap.data.mode}</>}
                    {snap.data.budget && typeof snap.data.budget === 'object' && 'dailyLimit' in snap.data.budget && (
                      <> &middot; Budget: ${String(snap.data.budget.dailyLimit)}/day</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => restoreSnapshot(snap.id, snap.name)}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-text-secondary text-xs hover:bg-white/[0.1] transition-colors flex items-center gap-1"
                    title="Restore this snapshot"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore
                  </button>
                  <button
                    onClick={() => deleteSnapshot(snap.id)}
                    className="p-1.5 rounded-lg hover:bg-red-400/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-text-muted hover:text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

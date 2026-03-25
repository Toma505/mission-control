'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AuditEntry } from '@/app/api/audit-log/route'

const categoryColors: Record<string, string> = {
  mode: 'bg-violet-400/20 text-violet-300',
  budget: 'bg-emerald-400/20 text-emerald-300',
  config: 'bg-sky-400/20 text-sky-300',
  backup: 'bg-amber-400/20 text-amber-300',
  webhook: 'bg-pink-400/20 text-pink-300',
  alert: 'bg-red-400/20 text-red-300',
  license: 'bg-cyan-400/20 text-cyan-300',
  preset: 'bg-orange-400/20 text-orange-300',
  system: 'bg-zinc-400/20 text-zinc-300',
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [filter, setFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const fetchEntries = useCallback(async () => {
    try {
      const url = filter ? `/api/audit-log?category=${filter}` : '/api/audit-log'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchEntries()
    const interval = setInterval(fetchEntries, 15000)
    return () => clearInterval(interval)
  }, [fetchEntries])

  const categories = ['mode', 'budget', 'config', 'backup', 'webhook', 'alert', 'license', 'preset', 'system']

  return (
    <div className="space-y-6">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !filter ? 'bg-white/[0.12] text-text-primary' : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
          }`}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(filter === cat ? '' : cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === cat ? 'bg-white/[0.12] text-text-primary' : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="text-center text-text-muted text-sm py-8">Loading audit log...</div>
      ) : entries.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-text-muted text-sm">No audit entries yet.</p>
          <p className="text-text-muted/60 text-xs mt-1">Actions like mode changes, budget edits, and restores will appear here.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => (
            <div key={entry.id} className="glass rounded-xl p-4 flex items-start gap-4">
              {/* Category badge */}
              <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
                categoryColors[entry.category] || categoryColors.system
              }`}>
                {entry.category}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary font-medium">{entry.action}</p>
                <p className="text-xs text-text-secondary mt-0.5">{entry.details}</p>
                {entry.previous && (
                  <p className="text-xs text-text-muted mt-0.5">Previous: {entry.previous}</p>
                )}
              </div>

              {/* Timestamp */}
              <span className="shrink-0 text-xs text-text-muted">{timeAgo(entry.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

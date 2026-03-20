'use client'

import { useEffect, useState } from 'react'

type UptimeRange = '24h' | '7d' | '30d'
type UptimeStatus = 'online' | 'offline' | 'error'

type TimelineResponse = {
  range: UptimeRange
  agents: {
    name: string
    model: string
    uptimePercentage: number
    buckets: {
      timestamp: string
      status: UptimeStatus
    }[]
  }[]
}

const RANGES: UptimeRange[] = ['24h', '7d', '30d']

function getStatusColor(status: UptimeStatus) {
  switch (status) {
    case 'online':
      return 'var(--status-active)'
    case 'error':
      return 'var(--status-error)'
    default:
      return 'var(--text-muted)'
  }
}

export function UptimeTimeline() {
  const [range, setRange] = useState<UptimeRange>('24h')
  const [data, setData] = useState<TimelineResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/agents/uptime?range=${range}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Failed to load uptime')
        const nextData = await response.json()
        if (!cancelled) setData(nextData)
      } catch {
        if (!cancelled) {
          setError('Could not load uptime history')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [range])

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Agent Uptime</h2>
          <p className="text-xs text-text-secondary">Online, offline, and error state history across your configured agents.</p>
        </div>

        <div className="flex items-center gap-2">
          {RANGES.map((option) => (
            <button
              key={option}
              onClick={() => setRange(option)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                range === option
                  ? 'bg-accent-primary text-white'
                  : 'glass text-text-secondary hover:bg-[var(--glass-bg-hover)] hover:text-text-primary'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--status-active)' }} /> Online</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} /> Offline</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--status-error)' }} /> Error</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((row) => (
            <div key={row} className="space-y-2">
              <div className="h-4 w-40 rounded bg-white/[0.06]" />
              <div className="h-8 rounded-xl bg-white/[0.04]" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-3 text-sm text-text-secondary">
          {error}
        </div>
      ) : data?.agents?.length ? (
        <div className="space-y-4">
          {data.agents.map((agent) => (
            <div key={agent.name} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">{agent.name}</p>
                  <p className="truncate text-[11px] text-text-muted">{agent.model}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-text-primary">{agent.uptimePercentage.toFixed(1)}%</p>
                  <p className="text-[11px] text-text-muted">uptime</p>
                </div>
              </div>

              <div
                className="grid gap-[2px] rounded-xl bg-[var(--glass-bg)] p-2"
                style={{ gridTemplateColumns: `repeat(${Math.max(agent.buckets.length, 1)}, minmax(0, 1fr))` }}
              >
                {agent.buckets.map((bucket) => (
                  <div
                    key={`${agent.name}-${bucket.timestamp}`}
                    className="h-8 rounded-[4px]"
                    style={{ backgroundColor: getStatusColor(bucket.status) }}
                    title={`${new Date(bucket.timestamp).toLocaleString()} · ${bucket.status}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-6 text-sm text-text-secondary">
          No uptime history yet. Keep Mission Control open and it will start recording agent status snapshots automatically.
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import {
  Webhook,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Send,
  Zap,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'

interface WebhookConfig {
  id: string
  name: string
  url: string
  type: 'slack' | 'discord' | 'generic'
  events: string[]
  enabled: boolean
  createdAt: string
  lastFired?: string
  lastStatus?: number
}

const TYPE_OPTIONS = [
  { value: 'slack', label: 'Slack' },
  { value: 'discord', label: 'Discord' },
  { value: 'generic', label: 'Generic (JSON)' },
]

const EVENT_LABELS: Record<string, string> = {
  'alert.triggered': 'Alert triggered',
  'budget.exceeded': 'Budget exceeded',
  'budget.warning': 'Budget warning',
  'agent.offline': 'Agent offline',
  'mode.changed': 'Mode changed',
  'throttle.activated': 'Throttle activated',
}

export function WebhookManager() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [events, setEvents] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [type, setType] = useState<string>('slack')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['alert.triggered', 'budget.exceeded'])

  useEffect(() => {
    fetchWebhooks()
  }, [])

  async function fetchWebhooks() {
    setLoading(true)
    try {
      const res = await apiFetch('/api/webhooks')
      const data = await res.json()
      setWebhooks(data.webhooks || [])
      setEvents(data.events || [])
    } catch {}
    setLoading(false)
  }

  async function createWebhook() {
    setSaving(true)
    setStatus(null)
    try {
      const res = await apiFetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name, url, type, events: selectedEvents }),
      })
      const data = await res.json()
      if (data.ok) {
        setWebhooks(prev => [...prev, data.webhook])
        setShowCreate(false)
        resetForm()
        setStatus({ type: 'success', message: `Webhook "${data.webhook.name}" created` })
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to create webhook' })
      }
    } catch {
      setStatus({ type: 'error', message: 'Failed to create webhook' })
    }
    setSaving(false)
  }

  async function toggleWebhook(id: string) {
    try {
      const res = await apiFetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', webhookId: id }),
      })
      const data = await res.json()
      if (data.ok) {
        setWebhooks(prev => prev.map(w => w.id === id ? { ...w, enabled: data.webhook.enabled } : w))
      }
    } catch {}
  }

  async function deleteWebhook(id: string) {
    try {
      const res = await apiFetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', webhookId: id }),
      })
      const data = await res.json()
      if (data.ok) {
        setWebhooks(prev => prev.filter(w => w.id !== id))
      }
    } catch {}
  }

  async function testWebhook(id: string) {
    setTesting(id)
    setStatus(null)
    try {
      const res = await apiFetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', webhookId: id }),
      })
      const data = await res.json()
      if (data.ok) {
        setStatus({ type: 'success', message: `Test sent (HTTP ${data.status})` })
        fetchWebhooks() // Refresh to get lastFired
      } else {
        setStatus({ type: 'error', message: data.error || 'Test failed' })
      }
    } catch {
      setStatus({ type: 'error', message: 'Test request failed' })
    }
    setTesting(null)
  }

  function resetForm() {
    setName('')
    setUrl('')
    setType('slack')
    setSelectedEvents(['alert.triggered', 'budget.exceeded'])
  }

  function toggleEvent(event: string) {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent-highlight" />
            <h3 className="text-base font-semibold text-text-primary">Webhook Integrations</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent-highlight/10 text-accent-highlight">
              {webhooks.filter(w => w.enabled).length} active
            </span>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 inline mr-1" />
            Add Webhook
          </button>
        </div>
        <p className="text-xs text-text-muted">
          Send real-time notifications to Slack, Discord, or any HTTP endpoint when alerts trigger, budgets are exceeded, or agents go offline.
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
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-text-primary">Add Webhook</h4>
            <button onClick={() => { setShowCreate(false); resetForm() }} className="text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. #alerts channel"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-primary/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Type</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary/50"
                >
                  {TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Webhook URL</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder={type === 'slack' ? 'https://hooks.slack.com/services/...' : type === 'discord' ? 'https://discord.com/api/webhooks/...' : 'https://...'}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-primary/50"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Events</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {events.map(event => (
                  <button
                    key={event}
                    onClick={() => toggleEvent(event)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                      selectedEvents.includes(event)
                        ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                        : 'bg-white/[0.04] text-text-muted border border-white/[0.08] hover:bg-white/[0.08]'
                    }`}
                  >
                    {EVENT_LABELS[event] || event}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={createWebhook}
                disabled={saving || !name || !url}
                className="px-4 py-2 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Webhook'}
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

      {/* Webhook list */}
      {loading ? (
        <div className="glass rounded-2xl p-8 text-center">
          <Loader2 className="w-5 h-5 text-text-muted mx-auto animate-spin" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <Webhook className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary">No webhooks configured</p>
          <p className="text-xs text-text-muted mt-1">Add a Slack, Discord, or custom webhook to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(webhook => (
            <div
              key={webhook.id}
              className={`glass rounded-2xl p-4 transition-opacity ${!webhook.enabled ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl ${webhook.enabled ? 'bg-accent-highlight/10' : 'bg-white/[0.04]'}`}>
                  <Zap className={`w-4 h-4 ${webhook.enabled ? 'text-accent-highlight' : 'text-text-muted'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">{webhook.name}</p>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/[0.06] text-text-muted border border-white/[0.08]">
                      {webhook.type}
                    </span>
                    {webhook.lastStatus !== undefined && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        webhook.lastStatus >= 200 && webhook.lastStatus < 300
                          ? 'bg-emerald-400/10 text-emerald-400'
                          : 'bg-red-400/10 text-red-400'
                      }`}>
                        {webhook.lastStatus || 'failed'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5 truncate">{webhook.url}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Events: {webhook.events.map(e => EVENT_LABELS[e] || e).join(', ')}
                    {webhook.lastFired && <> &middot; Last fired: {new Date(webhook.lastFired).toLocaleString()}</>}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => testWebhook(webhook.id)}
                    disabled={testing === webhook.id}
                    className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] text-text-secondary text-xs hover:bg-white/[0.1] transition-colors flex items-center gap-1"
                    title="Send test notification"
                  >
                    {testing === webhook.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Test
                  </button>
                  <button
                    onClick={() => toggleWebhook(webhook.id)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
                    title={webhook.enabled ? 'Disable' : 'Enable'}
                  >
                    {webhook.enabled ? (
                      <ToggleRight className="w-5 h-5 text-accent-highlight" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-text-muted" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteWebhook(webhook.id)}
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

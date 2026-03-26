'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  KeyRound,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
  RotateCw,
  Shield,
  X,
  AlertTriangle,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'

interface VaultKey {
  id: string
  name: string
  provider: string
  keyPrefix: string
  masked: string
  addedAt: string
  lastUsed?: string
  isActive: boolean
  notes?: string
}

const PROVIDER_COLORS: Record<string, { bg: string; text: string }> = {
  OpenRouter: { bg: 'bg-violet-400/10', text: 'text-violet-400' },
  Anthropic: { bg: 'bg-amber-400/10', text: 'text-amber-400' },
  OpenAI: { bg: 'bg-emerald-400/10', text: 'text-emerald-400' },
  Groq: { bg: 'bg-orange-400/10', text: 'text-orange-400' },
  'Google AI': { bg: 'bg-sky-400/10', text: 'text-sky-400' },
  Other: { bg: 'bg-white/[0.06]', text: 'text-text-muted' },
}

export function KeyVault() {
  const [keys, setKeys] = useState<VaultKey[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formKey, setFormKey] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')

  // Rotate form
  const [rotatingId, setRotatingId] = useState<string | null>(null)
  const [rotateKey, setRotateKey] = useState('')

  const loadKeys = useCallback(async () => {
    try {
      const res = await apiFetch('/api/key-vault')
      const data = await res.json()
      setKeys(data.keys || [])
    } catch {}
  }, [])

  useEffect(() => { loadKeys() }, [loadKeys])

  async function addKey() {
    if (!formKey) return
    setError('')
    const res = await apiFetch('/api/key-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: formName, key: formKey, notes: formNotes }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to add key')
      return
    }
    setFormName('')
    setFormKey('')
    setFormNotes('')
    setShowForm(false)
    loadKeys()
  }

  async function toggleKey(id: string) {
    await apiFetch('/api/key-vault', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'toggle' }),
    })
    loadKeys()
  }

  async function deleteKey(id: string) {
    await apiFetch('/api/key-vault', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadKeys()
  }

  async function handleRotate() {
    if (!rotatingId || !rotateKey) return
    await apiFetch('/api/key-vault', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rotatingId, action: 'rotate', newKey: rotateKey }),
    })
    setRotatingId(null)
    setRotateKey('')
    loadKeys()
  }

  const activeCount = keys.filter(k => k.isActive).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-400/10">
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-text-muted">
              {keys.length} key{keys.length !== 1 ? 's' : ''} stored · {activeCount} active
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setError('') }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-primary/20 text-accent-primary text-xs font-medium hover:bg-accent-primary/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Key
        </button>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/[0.05] border border-amber-500/10">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-text-muted">
          Keys are stored locally on this machine and encrypted at rest when the desktop app&apos;s secure storage is available.
          Keys are never sent to any external server by Mission Control.
        </p>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="glass rounded-2xl p-5 border border-accent-primary/20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Add API Key</h3>
            <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-white/[0.08]">
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>

          {error && (
            <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-[11px] text-red-400">{error}</p>
            </div>
          )}

          <input
            type="text"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="Key name (e.g., Production OpenRouter)"
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none mb-3"
          />

          <div className="relative mb-3">
            <input
              type={showKey ? 'text' : 'password'}
              value={formKey}
              onChange={e => setFormKey(e.target.value)}
              placeholder="sk-or-... or sk-ant-..."
              className="w-full px-3 py-2 pr-10 rounded-xl bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary font-mono placeholder:text-text-muted/50 focus:outline-none"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/[0.08]"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5 text-text-muted" /> : <Eye className="w-3.5 h-3.5 text-text-muted" />}
            </button>
          </div>

          <input
            type="text"
            value={formNotes}
            onChange={e => setFormNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none mb-4"
          />

          <button
            onClick={addKey}
            disabled={!formKey}
            className="px-4 py-2 rounded-xl bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/90 disabled:opacity-50"
          >
            Store Key
          </button>
        </div>
      )}

      {/* Keys List */}
      {keys.length === 0 && !showForm ? (
        <div className="glass rounded-2xl p-12 text-center">
          <KeyRound className="w-10 h-10 text-text-muted/20 mx-auto mb-3" />
          <p className="text-sm text-text-muted">No API keys stored</p>
          <p className="text-xs text-text-muted/60 mt-1">
            Securely store your OpenRouter, Anthropic, and OpenAI keys in one place
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map(k => {
            const pc = PROVIDER_COLORS[k.provider] || PROVIDER_COLORS.Other
            return (
              <div key={k.id} className={`glass rounded-2xl p-4 ${!k.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${pc.bg}`}>
                      <KeyRound className={`w-4 h-4 ${pc.text}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-text-primary">{k.name}</h4>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${pc.bg} ${pc.text}`}>
                          {k.provider}
                        </span>
                        {!k.isActive && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-muted font-mono mt-0.5">{k.masked}</p>
                      {k.notes && <p className="text-[10px] text-text-muted/60 mt-0.5">{k.notes}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleKey(k.id)}
                      className="p-1.5 rounded-lg hover:bg-white/[0.08]"
                      title={k.isActive ? 'Disable' : 'Enable'}
                    >
                      {k.isActive
                        ? <ToggleRight className="w-4 h-4 text-emerald-400" />
                        : <ToggleLeft className="w-4 h-4 text-text-muted" />}
                    </button>
                    <button
                      onClick={() => setRotatingId(rotatingId === k.id ? null : k.id)}
                      className="p-1.5 rounded-lg hover:bg-white/[0.08]"
                      title="Rotate key"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-text-muted" />
                    </button>
                    <button
                      onClick={() => deleteKey(k.id)}
                      className="p-1.5 rounded-lg hover:bg-white/[0.08]"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-text-muted hover:text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Rotate form */}
                {rotatingId === k.id && (
                  <div className="mt-3 p-3 rounded-xl bg-white/[0.02] border border-[var(--glass-border)]/50 flex gap-2">
                    <input
                      type="password"
                      value={rotateKey}
                      onChange={e => setRotateKey(e.target.value)}
                      placeholder="Paste new key..."
                      className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary font-mono placeholder:text-text-muted/50 focus:outline-none"
                    />
                    <button
                      onClick={handleRotate}
                      disabled={!rotateKey}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium disabled:opacity-50"
                    >
                      Rotate
                    </button>
                    <button
                      onClick={() => { setRotatingId(null); setRotateKey('') }}
                      className="p-1.5 rounded-lg hover:bg-white/[0.08]"
                    >
                      <X className="w-3.5 h-3.5 text-text-muted" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

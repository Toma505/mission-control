'use client'

import { useEffect, useState } from 'react'
import {
  Zap,
  Scale,
  Crown,
  Code2,
  BookOpen,
  Plus,
  Trash2,
  Play,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'

interface ModelPreset {
  id: string
  name: string
  description: string
  model: string
  fallbacks: string[]
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  isBuiltIn: boolean
  createdAt: string
}

const PRESET_ICONS: Record<string, typeof Zap> = {
  'preset-fast-cheap': Zap,
  'preset-balanced': Scale,
  'preset-max-quality': Crown,
  'preset-code-expert': Code2,
  'preset-long-context': BookOpen,
}

const PRESET_COLORS: Record<string, string> = {
  'preset-fast-cheap': 'text-emerald-400 bg-emerald-400/10',
  'preset-balanced': 'text-blue-400 bg-blue-400/10',
  'preset-max-quality': 'text-amber-400 bg-amber-400/10',
  'preset-code-expert': 'text-violet-400 bg-violet-400/10',
  'preset-long-context': 'text-cyan-400 bg-cyan-400/10',
}

export function ModelPresets() {
  const [presets, setPresets] = useState<ModelPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('')
  const [fallbacks, setFallbacks] = useState('')

  useEffect(() => {
    fetchPresets()
  }, [])

  useEffect(() => {
    if (!status) return
    const timer = setTimeout(() => setStatus(null), 4000)
    return () => clearTimeout(timer)
  }, [status])

  async function fetchPresets() {
    setLoading(true)
    try {
      const res = await fetch('/api/presets')
      const data = await res.json()
      setPresets(data.presets || [])
    } catch {}
    setLoading(false)
  }

  async function applyPreset(id: string) {
    setApplying(id)
    setStatus(null)
    try {
      const res = await apiFetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', presetId: id }),
      })
      const data = await res.json()
      if (data.ok) {
        setStatus({ type: 'success', message: `Applied "${data.applied}" — model set to ${data.model.split('/').pop()}` })
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to apply preset' })
      }
    } catch {
      setStatus({ type: 'error', message: 'Failed to apply preset' })
    }
    setApplying(null)
  }

  async function deletePreset(id: string) {
    try {
      const res = await apiFetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', presetId: id }),
      })
      const data = await res.json()
      if (data.ok) {
        setPresets(prev => prev.filter(p => p.id !== id))
        setStatus({ type: 'success', message: 'Preset deleted' })
      }
    } catch {}
  }

  async function createPreset() {
    setSaving(true)
    setStatus(null)
    try {
      const res = await apiFetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name,
          description,
          model,
          fallbacks: fallbacks.split(',').map(s => s.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setPresets(prev => [...prev, data.preset])
        setShowCreate(false)
        resetForm()
        setStatus({ type: 'success', message: `Preset "${data.preset.name}" created` })
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to create' })
      }
    } catch {
      setStatus({ type: 'error', message: 'Failed to create preset' })
    }
    setSaving(false)
  }

  function resetForm() {
    setName('')
    setDescription('')
    setModel('')
    setFallbacks('')
  }

  const builtIn = presets.filter(p => p.isBuiltIn)
  const custom = presets.filter(p => !p.isBuiltIn)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent-highlight" />
            <h3 className="text-base font-semibold text-text-primary">Model Presets</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent-highlight/10 text-accent-highlight">
              {presets.length} presets
            </span>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 inline mr-1" />
            New Preset
          </button>
        </div>
        <p className="text-xs text-text-muted">
          One-click model configurations. Apply a preset to instantly switch your agent&apos;s model, fallbacks, and settings.
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
            <h4 className="text-sm font-semibold text-text-primary">Create Custom Preset</h4>
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
                  placeholder="e.g. My Custom Config"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-primary/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Primary Model</label>
                <input
                  type="text"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder="e.g. anthropic/claude-sonnet-4-6"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-primary/50"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What is this preset good for?"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-primary/50"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Fallback Models (comma-separated)</label>
              <input
                type="text"
                value={fallbacks}
                onChange={e => setFallbacks(e.target.value)}
                placeholder="e.g. openai/gpt-4o, google/gemini-2.5-pro-preview-06-05"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-primary/50"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={createPreset}
                disabled={saving || !name || !model}
                className="px-4 py-2 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Preset'}
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

      {/* Loading */}
      {loading ? (
        <div className="glass rounded-2xl p-8 text-center">
          <Loader2 className="w-5 h-5 text-text-muted mx-auto animate-spin" />
        </div>
      ) : (
        <>
          {/* Built-in presets */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {builtIn.map(preset => {
              const Icon = PRESET_ICONS[preset.id] || Sparkles
              const color = PRESET_COLORS[preset.id] || 'text-text-muted bg-white/[0.04]'
              const isApplying = applying === preset.id

              return (
                <div key={preset.id} className="glass rounded-2xl p-5 flex flex-col">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2.5 rounded-xl ${color.split(' ').slice(1).join(' ')}`}>
                      <Icon className={`w-5 h-5 ${color.split(' ')[0]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-text-primary">{preset.name}</h4>
                      <p className="text-[11px] text-text-muted font-mono mt-0.5">
                        {preset.model.split('/').pop()}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-text-secondary leading-relaxed mb-3 flex-1">
                    {preset.description}
                  </p>

                  {preset.fallbacks.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {preset.fallbacks.map(f => (
                        <span key={f} className="px-2 py-0.5 rounded-full text-[10px] bg-white/[0.04] text-text-muted border border-white/[0.06] font-mono">
                          {f.split('/').pop()}
                        </span>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => applyPreset(preset.id)}
                    disabled={!!applying}
                    className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-xl text-xs font-medium bg-accent-primary text-white hover:bg-accent-primary/80 transition-colors disabled:opacity-50 mt-auto"
                  >
                    {isApplying ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    Apply Preset
                  </button>
                </div>
              )
            })}
          </div>

          {/* Custom presets */}
          {custom.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">Custom Presets</h3>
              {custom.map(preset => {
                const isApplying = applying === preset.id

                return (
                  <div key={preset.id} className="glass rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-white/[0.04]">
                        <Sparkles className="w-4 h-4 text-text-muted" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-text-primary">{preset.name}</p>
                          <span className="text-[10px] text-text-muted font-mono">
                            {preset.model.split('/').pop()}
                          </span>
                        </div>
                        {preset.description && (
                          <p className="text-xs text-text-secondary mt-0.5">{preset.description}</p>
                        )}
                        {preset.fallbacks.length > 0 && (
                          <p className="text-[10px] text-text-muted mt-1 font-mono">
                            Fallbacks: {preset.fallbacks.map(f => f.split('/').pop()).join(', ')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => applyPreset(preset.id)}
                          disabled={!!applying}
                          className="px-2.5 py-1.5 rounded-lg bg-accent-primary text-white text-xs hover:bg-accent-primary/80 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {isApplying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                          Apply
                        </button>
                        <button
                          onClick={() => deletePreset(preset.id)}
                          className="p-1.5 rounded-lg hover:bg-red-400/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-text-muted hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

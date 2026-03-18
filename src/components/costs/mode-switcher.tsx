'use client'

import { useState, useEffect } from 'react'
import { Zap, Shield, Brain, Loader2, Check, AlertCircle, Sparkles } from 'lucide-react'

type ModeName = 'best' | 'standard' | 'budget' | 'auto'

interface ModeConfig {
  label: string
  description: string
  icon: React.ReactNode
  color: string
  bg: string
  border: string
  glow: string
}

const MODE_UI: Record<ModeName, ModeConfig> = {
  best: {
    label: 'Best',
    description: 'Opus 4.6 → Gemini 3.1 Pro',
    icon: <Shield className="w-5 h-5" />,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/30',
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.15)]',
  },
  standard: {
    label: 'Standard',
    description: 'Sonnet 4.6 → Gemini 3.1 Pro',
    icon: <Sparkles className="w-5 h-5" />,
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/30',
    glow: 'shadow-[0_0_20px_rgba(56,189,248,0.15)]',
  },
  budget: {
    label: 'Budget',
    description: 'Deepseek V3 → GPT-4.1 Nano → Gemini Flash',
    icon: <Zap className="w-5 h-5" />,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/30',
    glow: 'shadow-[0_0_20px_rgba(52,211,153,0.15)]',
  },
  auto: {
    label: 'Auto',
    description: 'Smart routing — best model per task type',
    icon: <Brain className="w-5 h-5" />,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    border: 'border-violet-400/30',
    glow: 'shadow-[0_0_20px_rgba(167,139,250,0.15)]',
  },
}

export function ModeSwitcher() {
  const [currentMode, setCurrentMode] = useState<ModeName>('standard')
  const [currentModel, setCurrentModel] = useState<string>('')
  const [switching, setSwitching] = useState<ModeName | null>(null)
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    fetch('/api/mode')
      .then((r) => r.json())
      .then((data) => {
        setCurrentMode(data.mode)
        setCurrentModel(data.currentModel || '')
        setConnected(data.connected)
      })
      .catch(() => setConnected(false))
  }, [])

  async function switchMode(mode: ModeName) {
    if (mode === currentMode || switching) return

    setSwitching(mode)
    setStatus(null)

    try {
      const res = await fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const data = await res.json()

      if (data.ok) {
        setCurrentMode(mode)
        setCurrentModel(data.currentModel)
        setStatus({ type: 'success', message: `Switched to ${MODE_UI[mode].label} mode. Restart your agent to apply.` })
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to switch mode' })
      }
    } catch {
      setStatus({ type: 'error', message: 'Failed to connect to OpenClaw' })
    } finally {
      setSwitching(null)
    }
  }

  if (!connected) {
    return (
      <div className="glass rounded-2xl p-5">
        <h2 className="text-sm font-medium text-text-secondary mb-3">AI Mode Switcher</h2>
        <p className="text-sm text-text-muted">Connect OpenClaw to switch between AI modes.</p>
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium text-text-secondary">AI Mode Switcher</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Current model: <span className="text-text-primary font-mono">{currentModel}</span>
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${MODE_UI[currentMode].bg} ${MODE_UI[currentMode].color} border ${MODE_UI[currentMode].border}`}>
          {MODE_UI[currentMode].label} Mode
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(MODE_UI) as ModeName[]).map((mode) => {
          const ui = MODE_UI[mode]
          const isActive = mode === currentMode
          const isSwitching = switching === mode

          return (
            <button
              key={mode}
              onClick={() => switchMode(mode)}
              disabled={isActive || !!switching}
              className={`
                relative p-4 rounded-xl border transition-all duration-300 text-left
                ${isActive
                  ? `${ui.border} ${ui.bg} ${ui.glow}`
                  : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12]'
                }
                ${switching && !isSwitching ? 'opacity-50' : ''}
                disabled:cursor-default
              `}
            >
              {isActive && (
                <div className="absolute top-2 right-2">
                  <Check className={`w-3.5 h-3.5 ${ui.color}`} />
                </div>
              )}

              <div className={`p-2 rounded-lg ${ui.bg} w-fit mb-3`}>
                {isSwitching ? (
                  <Loader2 className={`w-5 h-5 ${ui.color} animate-spin`} />
                ) : (
                  <span className={ui.color}>{ui.icon}</span>
                )}
              </div>

              <p className={`text-sm font-semibold ${isActive ? ui.color : 'text-text-primary'}`}>
                {ui.label}
              </p>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                {ui.description}
              </p>
            </button>
          )
        })}
      </div>

      {status && (
        <div
          className={`mt-3 p-3 rounded-lg flex items-center gap-2 text-xs ${
            status.type === 'success'
              ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
              : 'bg-red-400/10 text-red-400 border border-red-400/20'
          }`}
        >
          {status.type === 'success' ? (
            <Check className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          )}
          {status.message}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { X, Monitor, Moon, Sun, RotateCcw, Palette, Type, Gauge, Layout, Zap, Plug, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { useSettings, Theme, AccentColor, FontSize, RefreshInterval } from '@/contexts/settings-context'

interface Props {
  open: boolean
  onClose: () => void
}

const THEMES: { value: Theme; label: string; icon: React.ReactNode; preview: string }[] = [
  { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" />, preview: '#09090b' },
  { value: 'midnight', label: 'Midnight', icon: <Monitor className="w-4 h-4" />, preview: '#020617' },
  { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" />, preview: '#f8fafc' },
]

const ACCENTS: { value: AccentColor; label: string; color: string }[] = [
  { value: 'blue', label: 'Blue', color: '#3b82f6' },
  { value: 'purple', label: 'Purple', color: '#8b5cf6' },
  { value: 'cyan', label: 'Cyan', color: '#06b6d4' },
  { value: 'green', label: 'Green', color: '#10b981' },
  { value: 'orange', label: 'Orange', color: '#f97316' },
  { value: 'rose', label: 'Rose', color: '#f43f5e' },
]

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
]

const REFRESH_INTERVALS: { value: RefreshInterval; label: string }[] = [
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 120, label: '2m' },
]

export function PreferencesModal({ open, onClose }: Props) {
  const { settings, updateSetting, resetSettings, saveWarning } = useSettings()
  const [tab, setTab] = useState<'appearance' | 'layout' | 'performance' | 'connection'>('appearance')
  const [connectionInfo, setConnectionInfo] = useState<{ configured: boolean; source?: string; openclawUrl?: string } | null>(null)
  const [connectionError, setConnectionError] = useState(false)

  // Fetch connection info when connection tab is opened
  const loadConnectionInfo = () => {
    setConnectionInfo(null) // Clear stale data so user sees a fresh load
    setConnectionError(false)
    fetch('/api/connection')
      .then(r => {
        if (!r.ok) throw new Error('API error')
        return r.json()
      })
      .then(data => { setConnectionInfo(data); setConnectionError(false) })
      .catch(() => setConnectionError(true))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-2xl border border-[var(--glass-border)] bg-[var(--background-card)] shadow-2xl shadow-black/40 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Preferences</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={resetSettings}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] transition-colors"
              title="Reset to defaults"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--glass-bg)] transition-colors"
            >
              <X className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 border-b border-[var(--glass-border)]">
          {[
            { id: 'appearance' as const, label: 'Appearance', icon: <Palette className="w-3.5 h-3.5" /> },
            { id: 'layout' as const, label: 'Layout', icon: <Layout className="w-3.5 h-3.5" /> },
            { id: 'performance' as const, label: 'Performance', icon: <Zap className="w-3.5 h-3.5" /> },
            { id: 'connection' as const, label: 'Connection', icon: <Plug className="w-3.5 h-3.5" /> },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); if (t.id === 'connection') loadConnectionInfo(); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                tab === t.id
                  ? 'text-[var(--text-primary)] bg-[var(--glass-bg)] border-b-2 border-[var(--accent-primary,#3b82f6)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Storage warning */}
          {saveWarning && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/20 text-xs text-amber-400">
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              Settings apply for this session but could not be saved permanently. Storage may be full.
            </div>
          )}
          {tab === 'appearance' && (
            <>
              {/* Theme */}
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3 block">Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {THEMES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => updateSetting('theme', t.value)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                        settings.theme === t.value
                          ? 'border-[var(--accent-primary,#3b82f6)] bg-[var(--accent-primary,#3b82f6)]/10'
                          : 'border-[var(--glass-border)] hover:border-[var(--text-muted)] hover:bg-[var(--glass-bg)]'
                      }`}
                    >
                      <div
                        className="w-full h-8 rounded-lg border border-[var(--glass-border)]"
                        style={{ backgroundColor: t.preview }}
                      />
                      <div className="flex items-center gap-1.5">
                        {t.icon}
                        <span className="text-xs text-[var(--text-primary)]">{t.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color */}
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3 block">Accent Color</label>
                <div className="flex gap-2">
                  {ACCENTS.map(a => (
                    <button
                      key={a.value}
                      onClick={() => updateSetting('accentColor', a.value)}
                      className={`w-9 h-9 rounded-xl border-2 transition-all flex items-center justify-center ${
                        settings.accentColor === a.value
                          ? 'border-white/40 scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: a.color }}
                      title={a.label}
                    >
                      {settings.accentColor === a.value && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3 block flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5" />
                  Font Size
                </label>
                <div className="flex gap-2">
                  {FONT_SIZES.map(f => (
                    <button
                      key={f.value}
                      onClick={() => updateSetting('fontSize', f.value)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                        settings.fontSize === f.value
                          ? 'border-[var(--accent-primary,#3b82f6)] bg-[var(--accent-primary,#3b82f6)]/10 text-[var(--text-primary)]'
                          : 'border-white/[0.06] text-[var(--text-muted)] hover:border-white/[0.12]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'layout' && (
            <>
              {/* Sidebar Position */}
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3 block">Sidebar Position</label>
                <div className="flex gap-2">
                  {(['left', 'right'] as const).map(pos => (
                    <button
                      key={pos}
                      onClick={() => updateSetting('sidebarPosition', pos)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all ${
                        settings.sidebarPosition === pos
                          ? 'border-[var(--accent-primary,#3b82f6)] bg-[var(--accent-primary,#3b82f6)]/10'
                          : 'border-[var(--glass-border)] hover:border-[var(--text-muted)]'
                      }`}
                    >
                      {/* Mini layout preview */}
                      <div className="flex gap-1 w-12 h-8">
                        {pos === 'left' ? (
                          <>
                            <div className="w-3 h-full rounded-sm bg-[var(--accent-primary,#3b82f6)]/40" />
                            <div className="flex-1 h-full rounded-sm bg-[var(--glass-bg)]" />
                          </>
                        ) : (
                          <>
                            <div className="flex-1 h-full rounded-sm bg-[var(--glass-bg)]" />
                            <div className="w-3 h-full rounded-sm bg-[var(--accent-primary,#3b82f6)]/40" />
                          </>
                        )}
                      </div>
                      <span className="text-xs text-[var(--text-primary)] capitalize">{pos}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Compact Mode */}
              <ToggleSetting
                label="Compact Mode"
                description="Reduce padding and spacing throughout the UI"
                checked={settings.compactMode}
                onChange={v => updateSetting('compactMode', v)}
              />

              {/* Collapse Sidebar */}
              <ToggleSetting
                label="Collapse Sidebar"
                description="Show only icons in the sidebar"
                checked={settings.sidebarCollapsed}
                onChange={v => updateSetting('sidebarCollapsed', v)}
              />
            </>
          )}

          {tab === 'performance' && (
            <>
              {/* Refresh Interval */}
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-1 block flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5" />
                  Data Refresh Interval
                </label>
                <p className="text-[11px] text-[var(--text-muted)] mb-3">How often Mission Control polls for new data</p>
                <div className="flex gap-2">
                  {REFRESH_INTERVALS.map(r => (
                    <button
                      key={r.value}
                      onClick={() => updateSetting('refreshInterval', r.value)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                        settings.refreshInterval === r.value
                          ? 'border-[var(--accent-primary,#3b82f6)] bg-[var(--accent-primary,#3b82f6)]/10 text-[var(--text-primary)]'
                          : 'border-white/[0.06] text-[var(--text-muted)] hover:border-white/[0.12]'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Animations */}
              <ToggleSetting
                label="Animations"
                description="Enable smooth transitions and animations"
                checked={settings.animationsEnabled}
                onChange={v => updateSetting('animationsEnabled', v)}
              />
            </>
          )}

          {tab === 'connection' && (
            <>
              {connectionInfo ? (
                <div className="space-y-4">
                  {/* Status */}
                  <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm ${
                    connectionInfo.configured
                      ? 'bg-emerald-400/10 border border-emerald-400/20'
                      : 'bg-red-400/10 border border-red-400/20'
                  }`}>
                    {connectionInfo.configured ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span className={connectionInfo.configured ? 'text-emerald-400' : 'text-red-400'}>
                      {connectionInfo.configured ? 'Connected' : 'Not configured'}
                    </span>
                    {connectionInfo.source && (
                      <span className="text-text-muted text-xs ml-auto">
                        via {connectionInfo.source === 'file' ? 'setup' : 'legacy config'}
                      </span>
                    )}
                  </div>

                  {/* URL */}
                  {connectionInfo.openclawUrl && (
                    <div>
                      <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">OpenClaw URL</label>
                      <p className="text-sm text-[var(--text-primary)] font-mono bg-[var(--glass-bg)] px-3 py-2 rounded-lg truncate">
                        {connectionInfo.openclawUrl}
                      </p>
                    </div>
                  )}

                  {/* Reconfigure */}
                  <a
                    href="/setup?reconfigure=true"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg glass-inset text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)] transition-colors"
                  >
                    <Plug className="w-4 h-4" />
                    Reconfigure Connection
                    <ExternalLink className="w-3 h-3 ml-auto text-[var(--text-muted)]" />
                  </a>
                </div>
              ) : connectionError ? (
                <div className="text-center space-y-3 py-4">
                  <XCircle className="w-6 h-6 text-[var(--text-muted)] mx-auto" />
                  <p className="text-sm text-[var(--text-secondary)]">Could not load connection info</p>
                  <button
                    onClick={loadConnectionInfo}
                    className="px-4 py-1.5 rounded-lg bg-[var(--glass-bg)] text-[var(--text-secondary)] text-xs hover:bg-[var(--glass-bg-hover)] transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ToggleSetting({ label, description, checked, onChange }: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-[var(--text-primary)]">{label}</p>
        <p className="text-[11px] text-[var(--text-muted)]">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-[22px] rounded-full transition-colors ${
          checked ? 'bg-[var(--accent-primary,#3b82f6)]' : 'bg-[var(--text-muted)]/30'
        }`}
        style={!checked ? { backgroundColor: 'color-mix(in srgb, var(--text-muted) 30%, transparent)' } : undefined}
      >
        <div
          className={`absolute top-[3px] w-4 h-4 rounded-full shadow-sm transition-transform ${
            checked ? 'left-[22px] bg-white' : 'left-[3px] bg-[var(--text-secondary)]'
          }`}
        />
      </button>
    </div>
  )
}

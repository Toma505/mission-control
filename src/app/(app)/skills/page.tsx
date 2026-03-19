'use client'

import { useState, useCallback, useEffect } from 'react'
import { apiFetch } from '@/lib/api-client'
import {
  Upload,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertCircle,
  AlertTriangle,
  Info,
  Check,
  FileCode,
  File,
  Package,
  Loader2,
  Download,
  Plug,
  Circle,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  file: string
  line?: number
  pattern: string
  description: string
}

interface FileInfo { name: string; size: number; type: string }

interface ScanReport {
  safe: boolean
  score: number
  files: FileInfo[]
  findings: Finding[]
  summary: string
}

interface ScanResult {
  ok: boolean
  fileName: string
  fileSize: number
  report: ScanReport
}

interface Plugin {
  name: string
  id: string
  status: 'loaded' | 'disabled'
  description: string
  version: string
}

// ─── Helpers ────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SeverityIcon({ severity }: { severity: Finding['severity'] }) {
  switch (severity) {
    case 'critical': return <ShieldX className="w-4 h-4 text-red-400" />
    case 'high': return <ShieldAlert className="w-4 h-4 text-orange-400" />
    case 'medium': return <AlertTriangle className="w-4 h-4 text-yellow-400" />
    case 'low': return <Info className="w-4 h-4 text-blue-400" />
    default: return <Info className="w-4 h-4 text-text-muted" />
  }
}

function SeverityBadge({ severity }: { severity: Finding['severity'] }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    info: 'bg-white/[0.06] text-text-muted border-white/[0.06]',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border ${colors[severity]}`}>
      {severity}
    </span>
  )
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--glass-border)" strokeWidth="2.5" />
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray={`${score}, 100`} className={color} />
      </svg>
      <span className={`text-lg font-bold ${color}`}>{score}</span>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────

export default function SkillsPage() {
  const [dragging, setDragging] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [installMsg, setInstallMsg] = useState('')
  const [error, setError] = useState('')
  const [npmName, setNpmName] = useState('')
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [pluginCounts, setPluginCounts] = useState({ loaded: 0, total: 0 })
  const [connected, setConnected] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetch('/api/skills')
      .then((r) => r.json())
      .then((data) => {
        setConnected(data.connected)
        setPlugins(data.plugins || [])
        setPluginCounts({ loaded: data.loaded || 0, total: data.total || 0 })
      })
      .catch(() => {})
  }, [])

  const handleScan = useCallback(async (file: File) => {
    setScanning(true)
    setResult(null)
    setError('')
    setInstallMsg('')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await apiFetch('/api/skills/scan', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Scan failed'); return }
      setResult(data)
    } catch {
      setError('Scan failed. Check the console.')
    } finally {
      setScanning(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file && file.name.endsWith('.zip')) handleScan(file)
      else setError('Please drop a .zip file')
    },
    [handleScan]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleScan(file)
    },
    [handleScan]
  )

  const handleNpmInstall = useCallback(async () => {
    if (!npmName.trim()) return
    setInstalling(true)
    setInstallMsg('')
    setError('')
    try {
      const res = await apiFetch('/api/skills/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillName: npmName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInstallMsg(`Error: ${data.error}${data.hint ? ` — ${data.hint}` : ''}`)
        return
      }
      setInstallMsg(data.message)
      setNpmName('')
    } catch {
      setInstallMsg('Install failed. Check the console.')
    } finally {
      setInstalling(false)
    }
  }, [npmName])

  const loadedPlugins = plugins.filter((p) => p.status === 'loaded')
  const disabledPlugins = plugins.filter((p) => p.status === 'disabled')
  const report = result?.report

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Skills</h1>
        <p className="text-sm text-text-secondary">
          Install and manage OpenClaw plugins
          {connected && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-status-active">
              <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-pulse" />
              OpenClaw connected
            </span>
          )}
        </p>
      </div>

      {/* Overview cards */}
      {connected && plugins.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-5">
            <p className="text-xs text-text-muted mb-1">Total Plugins</p>
            <p className="text-2xl font-bold text-text-primary">{pluginCounts.total}</p>
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-xs text-text-muted mb-1">Loaded</p>
            <p className="text-2xl font-bold text-status-active">{pluginCounts.loaded}</p>
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-xs text-text-muted mb-1">Disabled</p>
            <p className="text-2xl font-bold text-text-muted">{pluginCounts.total - pluginCounts.loaded}</p>
          </div>
        </div>
      )}

      {/* Active plugins */}
      {loadedPlugins.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">Active Plugins</h2>
          {loadedPlugins.map((p) => (
            <div key={p.id} className="glass rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-status-active/10">
                  <Plug className="w-4 h-4 text-status-active" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">{p.name}</p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-status-active/10 text-status-active border border-status-active/20">
                      Loaded
                    </span>
                    {p.version && (
                      <span className="text-[10px] text-text-muted font-mono">{p.version}</span>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-xs text-text-secondary mt-0.5">{p.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Available (disabled) plugins */}
      {disabledPlugins.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">Available Plugins</h2>
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              {showAll ? 'Show less' : `Show all ${disabledPlugins.length}`}
            </button>
          </div>
          <div className="glass rounded-2xl overflow-hidden">
            <div className="divide-y divide-white/[0.04]">
              {(showAll ? disabledPlugins : disabledPlugins.slice(0, 6)).map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                  <Circle className="w-3 h-3 text-text-muted/40" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-secondary">{p.name}</p>
                    {p.description && (
                      <p className="text-xs text-text-muted truncate">{p.description}</p>
                    )}
                  </div>
                  {p.version && (
                    <span className="text-[10px] text-text-muted font-mono">{p.version}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Install via npm */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Download className="w-4 h-4 text-text-muted" />
          <h2 className="text-sm font-medium text-text-primary">Install Skill (npm)</h2>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={npmName}
            onChange={(e) => setNpmName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNpmInstall()}
            placeholder="e.g. @openclaw/skill-name"
            className="flex-1 bg-background-elevated rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted border border-white/[0.06] focus:border-white/[0.12] focus:outline-none transition-colors"
          />
          <button
            onClick={handleNpmInstall}
            disabled={installing || !npmName.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.08] text-text-primary border border-white/[0.06] hover:bg-white/[0.12] transition-all disabled:opacity-50"
          >
            {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Install'}
          </button>
        </div>
        <p className="text-xs text-text-muted mt-2">
          Skills are npm packages installed on your OpenClaw instance.
        </p>
      </div>

      {/* Status messages */}
      {installMsg && (
        <div className={`glass rounded-2xl p-4 border ${
          installMsg.startsWith('Error') ? 'border-status-error/20' : 'border-status-active/20'
        }`}>
          <p className={`text-sm ${installMsg.startsWith('Error') ? 'text-status-error' : 'text-status-active'}`}>
            {installMsg}
          </p>
        </div>
      )}

      {error && (
        <div className="glass rounded-2xl p-4 border border-status-error/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-status-error" />
            <p className="text-sm text-status-error">{error}</p>
          </div>
        </div>
      )}

      {/* Security scanner */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-text-muted" />
          <h2 className="text-sm font-medium text-text-primary">Security Scanner</h2>
        </div>
        <p className="text-xs text-text-muted mb-4">
          Drop a .zip to scan for security issues before installing.
        </p>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`rounded-xl p-6 border-2 border-dashed transition-all duration-200 text-center cursor-pointer ${
            dragging ? 'border-accent-primary bg-accent-primary/5' : 'border-white/[0.06] hover:border-white/[0.12]'
          }`}
          onClick={() => document.getElementById('skill-input')?.click()}
        >
          <input id="skill-input" type="file" accept=".zip" onChange={handleFileInput} className="hidden" />
          {scanning ? (
            <>
              <Loader2 className="w-6 h-6 text-text-muted mx-auto mb-2 animate-spin" />
              <p className="text-sm text-text-secondary">Scanning...</p>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-secondary">Drop .zip here or click to browse</p>
            </>
          )}
        </div>
      </div>

      {/* Scan report */}
      {report && (
        <>
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-6">
              <ScoreRing score={report.score} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {report.safe ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <ShieldAlert className="w-5 h-5 text-red-400" />}
                  <h2 className="text-lg font-semibold text-text-primary">{result.fileName}</h2>
                </div>
                <p className="text-sm text-text-secondary">{report.summary}</p>
                <p className="text-xs text-text-muted mt-1">
                  {report.files.length} files · {formatBytes(result.fileSize)} · {report.findings.length} findings
                </p>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-medium text-text-secondary mb-3">Files in Package</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {report.files.map((f) => (
                <div key={f.name} className="flex items-center gap-2 py-1">
                  {f.type === 'code' ? <FileCode className="w-3.5 h-3.5 text-text-muted" /> : f.type === 'binary' ? <Package className="w-3.5 h-3.5 text-status-error" /> : <File className="w-3.5 h-3.5 text-text-muted" />}
                  <span className="text-xs text-text-primary font-mono flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-text-muted">{formatBytes(f.size)}</span>
                </div>
              ))}
            </div>
          </div>

          {report.findings.length > 0 && (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-medium text-text-primary">Security Findings ({report.findings.length})</h3>
              </div>
              <div className="divide-y divide-white/[0.04] max-h-96 overflow-y-auto">
                {report.findings.map((f, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <SeverityIcon severity={f.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <SeverityBadge severity={f.severity} />
                          <span className="text-xs text-text-muted font-mono">{f.pattern}</span>
                        </div>
                        <p className="text-sm text-text-primary">{f.description}</p>
                        <p className="text-xs text-text-muted mt-0.5 font-mono">{f.file}{f.line ? `:${f.line}` : ''}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => { setResult(null); setError('') }}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-text-secondary bg-white/[0.06] border border-white/[0.06] hover:bg-white/[0.1] transition-all"
          >
            Clear Report
          </button>
        </>
      )}
    </div>
  )
}

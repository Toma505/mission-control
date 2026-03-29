'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowUpCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  File,
  FileCode,
  Filter,
  Loader2,
  Package,
  Plug,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { ExtensionsDevMode } from '@/components/extensions/extensions-dev-mode'

interface Extension {
  id: string
  name: string
  description: string
  author: string
  version: string
  category: string
  tags: string[]
  installed: boolean
  enabled: boolean
  source: 'openclaw' | 'marketplace' | 'npm'
  hasUpdate: boolean
  homepage?: string
  npmPackage?: string
  installedVersion?: string
}

interface ExtensionsPayload {
  connected: boolean
  installed: Extension[]
  marketplace: Extension[]
  categories: string[]
}

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  file: string
  line?: number
  pattern: string
  description: string
}

interface ScanReport {
  safe: boolean
  score: number
  files: { name: string; size: number; type: string }[]
  findings: Finding[]
  summary: string
}

interface ScanResult {
  ok: boolean
  fileName: string
  fileSize: number
  report: ScanReport
}

type TabKey = 'installed' | 'marketplace' | 'upload'

const TAB_OPTIONS: { key: TabKey; label: string }[] = [
  { key: 'installed', label: 'Installed' },
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'upload', label: 'Upload & Scan' },
]

const CATEGORY_ICONS: Record<string, typeof Shield> = {
  automation: Wrench,
  developer: Sparkles,
  integration: Plug,
  memory: Package,
  observability: Shield,
  ops: Wrench,
  plugins: Package,
  security: Shield,
  skills: Sparkles,
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="relative flex h-20 w-20 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="var(--glass-border)"
          strokeWidth="2.5"
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray={`${score}, 100`}
          className={color}
        />
      </svg>
      <span className={`text-lg font-bold ${color}`}>{score}</span>
    </div>
  )
}

function SeverityIcon({ severity }: { severity: Finding['severity'] }) {
  switch (severity) {
    case 'critical':
      return <ShieldX className="h-4 w-4 text-red-400" />
    case 'high':
      return <ShieldAlert className="h-4 w-4 text-orange-400" />
    case 'medium':
      return <AlertCircle className="h-4 w-4 text-yellow-400" />
    default:
      return <Shield className="h-4 w-4 text-text-muted" />
  }
}

function SeverityBadge({ severity }: { severity: Finding['severity'] }) {
  const colors: Record<Finding['severity'], string> = {
    critical: 'border-red-500/20 bg-red-500/10 text-red-400',
    high: 'border-orange-500/20 bg-orange-500/10 text-orange-400',
    medium: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400',
    low: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
    info: 'border-white/[0.06] bg-white/[0.04] text-text-muted',
  }

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${colors[severity]}`}>
      {severity}
    </span>
  )
}

function SourceBadge({ source }: { source: Extension['source'] }) {
  const styles: Record<Extension['source'], string> = {
    marketplace: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
    npm: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    openclaw: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  }

  const label: Record<Extension['source'], string> = {
    marketplace: 'Catalog',
    npm: 'NPM',
    openclaw: 'OpenClaw',
  }

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles[source]}`}>
      {label[source]}
    </span>
  )
}

export function ExtensionsManager() {
  const [tab, setTab] = useState<TabKey>('installed')
  const [data, setData] = useState<ExtensionsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [actionMessage, setActionMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [npmName, setNpmName] = useState('')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanError, setScanError] = useState('')
  const [dragging, setDragging] = useState(false)

  const loadExtensions = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/extensions', { cache: 'no-store' })
      if (!response.ok) throw new Error('Could not load extensions')
      setData(await response.json())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load extensions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadExtensions()
  }, [loadExtensions])

  useEffect(() => {
    if (!actionMessage) return
    const timer = setTimeout(() => setActionMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [actionMessage])

  async function runAction(action: string, extensionId?: string, packageName?: string) {
    setActionInProgress(`${action}:${extensionId || packageName || 'manual'}`)
    setActionMessage(null)

    try {
      const response = await apiFetch('/api/extensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, extensionId, packageName }),
      })
      const result = await response.json()
      setActionMessage({
        ok: !!result.ok,
        text: result.message || result.error || `Failed to ${action} extension`,
      })

      if (result.ok) {
        if (action === 'install' && !extensionId) {
          setNpmName('')
        }
        await loadExtensions()
      }
    } catch {
      setActionMessage({ ok: false, text: `Failed to ${action} extension` })
    } finally {
      setActionInProgress(null)
    }
  }

  async function handleScan(file: File) {
    setActionInProgress('scan')
    setScanResult(null)
    setScanError('')

    const formData = new FormData()
    formData.append('action', 'scan')
    formData.append('file', file)

    try {
      const response = await apiFetch('/api/extensions', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()
      if (!response.ok) {
        setScanError(result.error || 'Scan failed')
        return
      }
      setScanResult(result)
    } catch {
      setScanError('Scan failed')
    } finally {
      setActionInProgress(null)
    }
  }

  const marketplace = data?.marketplace ?? []
  const installed = data?.installed ?? []

  const filteredMarketplace = useMemo(() => {
    return marketplace.filter((extension) => {
      if (activeCategory !== 'all' && extension.category !== activeCategory) return false
      if (!search) return true

      const query = search.toLowerCase()
      return (
        extension.name.toLowerCase().includes(query) ||
        extension.description.toLowerCase().includes(query) ||
        extension.author.toLowerCase().includes(query) ||
        extension.tags.some((tag) => tag.toLowerCase().includes(query))
      )
    })
  }, [activeCategory, marketplace, search])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-accent-primary" />
          <h1 className="text-3xl font-bold text-text-primary">Extensions</h1>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-accent-primary" />
            <h1 className="text-3xl font-bold text-text-primary">Extensions</h1>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Install, manage, and scan OpenClaw plugins and reusable skills.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className={`rounded-full border px-2 py-1 ${data?.connected ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-white/[0.08] bg-white/[0.04]'}`}>
              {data?.connected ? 'OpenClaw connected' : 'OpenClaw not connected'}
            </span>
            <span>{installed.length} installed</span>
            <span>{marketplace.length} catalog entries</span>
          </div>
        </div>
      </div>

      <ExtensionsDevMode />

      {actionMessage && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${actionMessage.ok ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>
          {actionMessage.text}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="glass rounded-2xl p-2">
        <div className="flex flex-wrap gap-2">
          {TAB_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => setTab(option.key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                tab === option.key
                  ? 'bg-accent-primary text-white'
                  : 'bg-white/[0.04] text-text-secondary hover:text-text-primary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'installed' && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <div className="mb-3 flex items-center gap-2">
              <Download className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-medium text-text-primary">Install From NPM</h2>
            </div>
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                type="text"
                value={npmName}
                onChange={(event) => setNpmName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && npmName.trim()) {
                    void runAction('install', undefined, npmName.trim())
                  }
                }}
                placeholder="e.g. @openclaw/skill-research-scout"
                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/40 focus:border-accent-primary/50 focus:outline-none"
              />
              <button
                onClick={() => void runAction('install', undefined, npmName.trim())}
                disabled={!npmName.trim() || actionInProgress === 'install:manual'}
                className="rounded-xl bg-accent-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-primary/80 disabled:opacity-50"
              >
                {actionInProgress === 'install:manual' ? 'Installing...' : 'Install'}
              </button>
            </div>
          </div>

          {installed.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <Package className="mx-auto mb-3 h-8 w-8 text-text-muted" />
              <p className="text-sm text-text-secondary">No extensions are installed yet.</p>
              <p className="mt-1 text-xs text-text-muted">Install one from the marketplace or via npm to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {installed.map((extension) => {
                const actionKey = (action: string) => `${action}:${extension.id}`
                return (
                  <div key={extension.id} className="glass rounded-2xl p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-text-primary">{extension.name}</h3>
                          <SourceBadge source={extension.source} />
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${extension.enabled ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-white/[0.08] bg-white/[0.04] text-text-muted'}`}>
                            {extension.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                          {extension.hasUpdate ? (
                            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                              Update available
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-text-secondary">{extension.description}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                          <span>{extension.author}</span>
                          <span>Installed {extension.installedVersion || extension.version}</span>
                          {extension.npmPackage ? <span>{extension.npmPackage}</span> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => void runAction(extension.enabled ? 'disable' : 'enable', extension.id)}
                          disabled={actionInProgress === actionKey(extension.enabled ? 'disable' : 'enable')}
                          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.08] disabled:opacity-50"
                        >
                          {extension.enabled ? 'Disable' : 'Enable'}
                        </button>
                        {extension.hasUpdate ? (
                          <button
                            onClick={() => void runAction('update', extension.id)}
                            disabled={actionInProgress === actionKey('update')}
                            className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                          >
                            Update
                          </button>
                        ) : null}
                        <button
                          onClick={() => void runAction('uninstall', extension.id)}
                          disabled={actionInProgress === actionKey('uninstall')}
                          className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          Uninstall
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'marketplace' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search extensions..."
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted/40 focus:border-accent-primary/50 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCategory('all')}
                className={`rounded-xl px-3 py-2 text-xs font-medium ${activeCategory === 'all' ? 'bg-accent-primary text-white' : 'glass text-text-secondary hover:text-text-primary'}`}
              >
                <Filter className="mr-1 inline h-3.5 w-3.5" />
                All
              </button>
              {(data?.categories || []).map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category === activeCategory ? 'all' : category)}
                  className={`rounded-xl px-3 py-2 text-xs font-medium ${activeCategory === category ? 'bg-accent-primary text-white' : 'glass text-text-secondary hover:text-text-primary'}`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {filteredMarketplace.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-text-muted" />
              <p className="text-sm text-text-secondary">No extensions match your current filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredMarketplace.map((extension) => {
                const Icon = CATEGORY_ICONS[extension.category] || Package
                const busyKey = (action: string) => `${action}:${extension.id}`

                return (
                  <div key={extension.id} className="glass rounded-2xl p-5">
                    <div className="mb-3 flex items-start gap-3">
                      <div className="rounded-xl bg-white/[0.04] p-2.5">
                        <Icon className="h-5 w-5 text-accent-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-text-primary">{extension.name}</h3>
                          <SourceBadge source={extension.source} />
                        </div>
                        <p className="text-[11px] text-text-muted">
                          {extension.author} · v{extension.version}
                        </p>
                      </div>
                    </div>

                    <p className="mb-3 text-xs leading-relaxed text-text-secondary">{extension.description}</p>

                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {extension.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[10px] text-text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                      <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-2 py-0.5">
                        {extension.category}
                      </span>
                      {extension.installed ? (
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
                          Installed {extension.installedVersion || extension.version}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 border-t border-white/[0.06] pt-3">
                      {extension.installed ? (
                        <>
                          <button
                            onClick={() => void runAction(extension.enabled ? 'disable' : 'enable', extension.id)}
                            disabled={actionInProgress === busyKey(extension.enabled ? 'disable' : 'enable')}
                            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.08] disabled:opacity-50"
                          >
                            {extension.enabled ? 'Disable' : 'Enable'}
                          </button>
                          {extension.hasUpdate ? (
                            <button
                              onClick={() => void runAction('update', extension.id)}
                              disabled={actionInProgress === busyKey('update')}
                              className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                            >
                              <ArrowUpCircle className="mr-1 inline h-3.5 w-3.5" />
                              Update
                            </button>
                          ) : null}
                          <button
                            onClick={() => void runAction('uninstall', extension.id)}
                            disabled={actionInProgress === busyKey('uninstall')}
                            className="ml-auto rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                          >
                            <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                            Remove
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => void runAction('install', extension.id)}
                          disabled={actionInProgress === busyKey('install')}
                          className="flex-1 rounded-xl bg-accent-primary px-3 py-2.5 text-xs font-medium text-white hover:bg-accent-primary/80 disabled:opacity-50"
                        >
                          {actionInProgress === busyKey('install') ? (
                            <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Download className="mr-1 inline h-3.5 w-3.5" />
                              Install
                            </>
                          )}
                        </button>
                      )}
                      {extension.homepage ? (
                        <a
                          href={extension.homepage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl p-2 text-text-muted hover:bg-white/[0.06] hover:text-text-primary"
                          title="Open source"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'upload' && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-medium text-text-primary">Security Scanner</h2>
            </div>
            <p className="mb-4 text-xs text-text-muted">
              Drop a .zip extension bundle here to scan it for dangerous code before installation.
            </p>
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                const file = event.dataTransfer.files[0]
                if (file) {
                  void handleScan(file)
                }
              }}
              onClick={() => document.getElementById('extensions-upload-input')?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent-primary bg-accent-primary/5' : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.14]'}`}
            >
              <input
                id="extensions-upload-input"
                type="file"
                accept=".zip"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void handleScan(file)
                  }
                }}
                className="hidden"
              />
              {actionInProgress === 'scan' ? (
                <>
                  <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-text-muted" />
                  <p className="text-sm text-text-secondary">Scanning extension bundle...</p>
                </>
              ) : (
                <>
                  <Upload className="mx-auto mb-2 h-6 w-6 text-text-muted" />
                  <p className="text-sm text-text-secondary">Drop .zip here or click to browse</p>
                </>
              )}
            </div>
          </div>

          {scanError ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {scanError}
            </div>
          ) : null}

          {scanResult ? (
            <>
              <div className="glass rounded-2xl p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <ScoreRing score={scanResult.report.score} />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {scanResult.report.safe ? (
                        <ShieldCheck className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <ShieldAlert className="h-5 w-5 text-red-400" />
                      )}
                      <h3 className="text-lg font-semibold text-text-primary">{scanResult.fileName}</h3>
                    </div>
                    <p className="text-sm text-text-secondary">{scanResult.report.summary}</p>
                    <p className="text-xs text-text-muted">
                      {scanResult.report.files.length} files · {formatBytes(scanResult.fileSize)} · {scanResult.report.findings.length} findings
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass rounded-2xl p-5">
                <h3 className="mb-3 text-sm font-medium text-text-primary">Files In Package</h3>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {scanResult.report.files.map((file) => (
                    <div key={file.name} className="flex items-center gap-2 py-1">
                      {file.type === 'code' ? (
                        <FileCode className="h-3.5 w-3.5 text-text-muted" />
                      ) : (
                        <File className="h-3.5 w-3.5 text-text-muted" />
                      )}
                      <span className="flex-1 truncate font-mono text-xs text-text-primary">{file.name}</span>
                      <span className="text-xs text-text-muted">{formatBytes(file.size)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {scanResult.report.findings.length > 0 ? (
                <div className="glass overflow-hidden rounded-2xl">
                  <div className="border-b border-white/[0.06] p-4">
                    <h3 className="text-sm font-medium text-text-primary">
                      Findings ({scanResult.report.findings.length})
                    </h3>
                  </div>
                  <div className="max-h-96 divide-y divide-white/[0.04] overflow-y-auto">
                    {scanResult.report.findings.map((finding, index) => (
                      <div key={`${finding.file}-${finding.pattern}-${index}`} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <SeverityIcon severity={finding.severity} />
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <SeverityBadge severity={finding.severity} />
                              <span className="font-mono text-xs text-text-muted">{finding.pattern}</span>
                            </div>
                            <p className="text-sm text-text-primary">{finding.description}</p>
                            <p className="mt-0.5 font-mono text-xs text-text-muted">
                              {finding.file}{finding.line ? `:${finding.line}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

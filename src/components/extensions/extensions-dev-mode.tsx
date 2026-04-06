'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BadgeCheck,
  Code2,
  FolderCode,
  Loader2,
  Radio,
  RefreshCcw,
  ShieldCheck,
  ShieldX,
  TerminalSquare,
  Wand2,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'

type DevTemplateId = 'basic' | 'skill' | 'integration'

interface ExtensionDevLog {
  id: string
  level: 'info' | 'success' | 'warn' | 'error'
  message: string
  timestamp: string
  pluginId?: string
  filePath?: string
}

interface ExtensionDevScaffold {
  id: string
  name: string
  slug: string
  template: DevTemplateId
  rootPath: string
  manifestPath: string
  createdAt: string
  updatedAt: string
  lastReloadAt?: string
  lastValidationAt?: string
  fileCount: number
  manifestValid: boolean
  manifestErrors: string[]
  manifestWarnings: string[]
}

interface ExtensionDevTemplateDescriptor {
  id: DevTemplateId
  label: string
  description: string
}

interface ManifestValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

interface ExtensionDevPayload {
  enabled: boolean
  watcher: {
    active: boolean
    rootPath: string
    watchedPlugins: number
    lastEventAt: string | null
  }
  templates: ExtensionDevTemplateDescriptor[]
  scaffolds: ExtensionDevScaffold[]
  logs: ExtensionDevLog[]
}

function relativeTime(value?: string | null) {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.round((date.getTime() - Date.now()) / 60000),
    'minute',
  )
}

function logStyles(level: ExtensionDevLog['level']) {
  switch (level) {
    case 'success':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
    case 'warn':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-300'
    case 'error':
      return 'border-red-500/20 bg-red-500/10 text-red-300'
    default:
      return 'border-white/[0.08] bg-white/[0.04] text-text-secondary'
  }
}

export function ExtensionsDevMode() {
  const [payload, setPayload] = useState<ExtensionDevPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [scaffoldName, setScaffoldName] = useState('')
  const [template, setTemplate] = useState<DevTemplateId>('basic')
  const [manifestText, setManifestText] = useState('{\n  "name": "my-plugin",\n  "displayName": "My Plugin",\n  "version": "0.1.0",\n  "description": "Local extension scaffold",\n  "entry": "src/index.ts",\n  "template": "basic",\n  "permissions": []\n}')
  const [validation, setValidation] = useState<ManifestValidationResult | null>(null)

  const loadDevMode = useCallback(async () => {
    try {
      const response = await apiFetch('/api/extensions/dev', { cache: 'no-store' })
      if (!response.ok) throw new Error('Could not load plugin developer mode')
      const nextPayload = (await response.json()) as ExtensionDevPayload
      setPayload(nextPayload)
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : 'Could not load plugin developer mode',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDevMode()
  }, [loadDevMode])

  useEffect(() => {
    if (!payload?.enabled) return
    const timer = setInterval(() => {
      void loadDevMode()
    }, 2500)
    return () => clearInterval(timer)
  }, [loadDevMode, payload?.enabled])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [message])

  const templates = payload?.templates ?? []
  const scaffolds = payload?.scaffolds ?? []
  const logs = payload?.logs ?? []

  const currentTemplate = useMemo(
    () => templates.find((item) => item.id === template) ?? templates[0],
    [template, templates],
  )

  async function runAction(action: 'toggle' | 'scaffold' | 'validate' | 'clearLogs', body?: Record<string, unknown>) {
    setBusyAction(action)
    setMessage(null)

    try {
      const response = await apiFetch('/api/extensions/dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      })
      const result = await response.json()

      if (!response.ok) {
        setMessage({ ok: false, text: result.error || 'Developer mode action failed' })
        return
      }

      if (result.payload) {
        setPayload(result.payload as ExtensionDevPayload)
      }
      if (result.validation) {
        setValidation(result.validation as ManifestValidationResult)
      }
      setMessage({ ok: !!result.ok, text: result.message || 'Developer mode updated' })
    } catch {
      setMessage({ ok: false, text: 'Developer mode action failed' })
    } finally {
      setBusyAction(null)
    }
  }

  if (loading && !payload) {
    return (
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading plugin developer mode...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-accent-primary" />
              <h2 className="text-sm font-medium text-text-primary">Plugin Developer Mode</h2>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                  payload?.enabled
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                    : 'border-white/[0.08] bg-white/[0.04] text-text-muted'
                }`}
              >
                {payload?.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Scaffold local extensions, validate manifests, and watch file changes without leaving Mission Control.
            </p>
          </div>
          <button
            onClick={() => void runAction('toggle', { enabled: !payload?.enabled })}
            disabled={busyAction === 'toggle'}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              payload?.enabled
                ? 'border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                : 'bg-accent-primary text-white hover:bg-accent-primary/80'
            } disabled:opacity-50`}
          >
            {busyAction === 'toggle' ? 'Updating...' : payload?.enabled ? 'Disable Developer Mode' : 'Enable Developer Mode'}
          </button>
        </div>
      </div>

      {message ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.ok
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
              : 'border-red-500/20 bg-red-500/10 text-red-400'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {payload?.enabled ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="glass rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2">
                <Radio className="h-4 w-4 text-text-muted" />
                <h3 className="text-sm font-medium text-text-primary">Hot-Reload Watcher</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Status</p>
                  <p className="mt-1 text-sm font-medium text-text-primary">
                    {payload.watcher.active ? 'Watching for changes' : 'Idle'}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Scaffolds</p>
                  <p className="mt-1 text-sm font-medium text-text-primary">{payload.watcher.watchedPlugins}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Last Event</p>
                  <p className="mt-1 text-sm font-medium text-text-primary">{relativeTime(payload.watcher.lastEventAt)}</p>
                </div>
              </div>
              <p className="mt-3 break-all rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 font-mono text-[11px] text-text-muted">
                {payload.watcher.rootPath}
              </p>
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="mb-4 flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-text-muted" />
                <h3 className="text-sm font-medium text-text-primary">Plugin Scaffold Generator</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_auto]">
                <input
                  type="text"
                  value={scaffoldName}
                  onChange={(event) => setScaffoldName(event.target.value)}
                  placeholder="Plugin name, e.g. Discord Event Relay"
                  className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/40 focus:border-accent-primary/50 focus:outline-none"
                />
                <select
                  value={template}
                  onChange={(event) => setTemplate(event.target.value as DevTemplateId)}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-text-primary focus:border-accent-primary/50 focus:outline-none"
                >
                  {templates.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => void runAction('scaffold', { name: scaffoldName, template })}
                  disabled={!scaffoldName.trim() || busyAction === 'scaffold'}
                  className="rounded-xl bg-accent-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-primary/80 disabled:opacity-50"
                >
                  {busyAction === 'scaffold' ? 'Generating...' : 'Generate'}
                </button>
              </div>
              {currentTemplate ? (
                <p className="mt-3 text-xs text-text-muted">{currentTemplate.description}</p>
              ) : null}
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="mb-4 flex items-center gap-2">
                <FolderCode className="h-4 w-4 text-text-muted" />
                <h3 className="text-sm font-medium text-text-primary">Generated Scaffolds</h3>
              </div>

              {scaffolds.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.03] px-4 py-6 text-center text-sm text-text-secondary">
                  Generate a scaffold to start watching plugin files and validating manifests.
                </div>
              ) : (
                <div className="space-y-3">
                  {scaffolds.map((scaffold) => (
                    <div key={scaffold.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-semibold text-text-primary">{scaffold.name}</h4>
                            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-text-muted">
                              {scaffold.template}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                scaffold.manifestValid
                                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                  : 'border-red-500/20 bg-red-500/10 text-red-400'
                              }`}
                            >
                              {scaffold.manifestValid ? 'Manifest valid' : 'Manifest issues'}
                            </span>
                          </div>
                          <div className="space-y-1 text-xs text-text-muted">
                            <p>{scaffold.fileCount} files · updated {relativeTime(scaffold.updatedAt)}</p>
                            <p className="break-all font-mono">{scaffold.rootPath}</p>
                          </div>
                          {scaffold.manifestWarnings.length > 0 ? (
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                              {scaffold.manifestWarnings[0]}
                            </div>
                          ) : null}
                          {scaffold.manifestErrors.length > 0 ? (
                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                              {scaffold.manifestErrors[0]}
                            </div>
                          ) : null}
                        </div>
                        <button
                          onClick={() => void runAction('validate', { pluginId: scaffold.slug })}
                          disabled={busyAction === 'validate'}
                          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.08] disabled:opacity-50"
                        >
                          Validate Manifest
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass rounded-2xl p-5">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-text-muted" />
                <h3 className="text-sm font-medium text-text-primary">Manifest Validator</h3>
              </div>
              <textarea
                value={manifestText}
                onChange={(event) => setManifestText(event.target.value)}
                rows={12}
                className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 font-mono text-xs text-text-primary focus:border-accent-primary/50 focus:outline-none"
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => void runAction('validate', { manifestText })}
                  disabled={!manifestText.trim() || busyAction === 'validate'}
                  className="rounded-xl bg-accent-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-primary/80 disabled:opacity-50"
                >
                  {busyAction === 'validate' ? 'Validating...' : 'Validate JSON'}
                </button>
                {validation ? (
                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                      validation.valid
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                        : 'border-red-500/20 bg-red-500/10 text-red-400'
                    }`}
                  >
                    {validation.valid ? <BadgeCheck className="h-3.5 w-3.5" /> : <ShieldX className="h-3.5 w-3.5" />}
                    {validation.valid ? 'Manifest ready' : 'Manifest issues found'}
                  </div>
                ) : null}
              </div>
              {validation ? (
                <div className="mt-4 space-y-3">
                  {validation.errors.length > 0 ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-red-300">
                        <ShieldX className="h-4 w-4" />
                        Errors
                      </div>
                      <ul className="space-y-1 text-xs text-red-200">
                        {validation.errors.map((error) => (
                          <li key={error}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {validation.warnings.length > 0 ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-300">
                        <AlertTriangle className="h-4 w-4" />
                        Warnings
                      </div>
                      <ul className="space-y-1 text-xs text-amber-200">
                        {validation.warnings.map((warning) => (
                          <li key={warning}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <TerminalSquare className="h-4 w-4 text-text-muted" />
                  <h3 className="text-sm font-medium text-text-primary">Dev Console</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void loadDevMode()}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-text-muted hover:bg-white/[0.08] hover:text-text-primary"
                    title="Refresh logs"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => void runAction('clearLogs')}
                    disabled={busyAction === 'clearLogs'}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {logs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.08] bg-black/20 px-4 py-6 text-center text-sm text-text-secondary">
                    No dev logs yet. Generate a scaffold or change a file to see reload events here.
                  </div>
                ) : (
                  logs.slice(0, 18).map((log) => (
                    <div key={log.id} className={`rounded-xl border px-3 py-3 ${logStyles(log.level)}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-medium uppercase tracking-[0.18em]">{log.level}</div>
                        <div className="text-[11px] opacity-80">{new Date(log.timestamp).toLocaleString()}</div>
                      </div>
                      <p className="mt-2 text-sm">{log.message}</p>
                      {log.pluginId || log.filePath ? (
                        <p className="mt-2 break-all font-mono text-[11px] opacity-80">
                          {[log.pluginId, log.filePath].filter(Boolean).join(' · ')}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}


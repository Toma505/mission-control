"use client"

import { type ReactNode, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FolderOpen,
  Info,
  Laptop,
  Loader2,
  Package,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react'

type ModeInfo = {
  connected: boolean
  mode: string
  currentModel?: string
}

type ConnectionInfo = {
  configured: boolean
  openclawUrl?: string | null
}

type LicenseInfo = {
  valid: boolean
  email: string | null
}

type UpdateStatus = {
  status: string
  info?: { version?: string } | null
  error?: string | null
  progress?: { percent?: number } | null
}

type DesktopDiagnostics = {
  appName: string
  appVersion: string
  electronVersion: string
  chromiumVersion: string
  nodeVersion: string
  platform: string
  arch: string
  isPackaged: boolean
  port: number
  paths: {
    appPath: string
    execPath: string
    userData: string
    data: string
    logs: string
    settingsFile: string
    licenseFile: string
  }
  features: {
    autoLaunchEnabled: boolean
    closeToTrayEnabled: boolean
  }
  updateStatus: UpdateStatus
}

type ElectronAPI = {
  getDesktopDiagnostics?: () => Promise<DesktopDiagnostics>
  openDataDirectory?: () => Promise<{ ok: boolean; error?: string }>
  openLogsDirectory?: () => Promise<{ ok: boolean; error?: string }>
  copyText?: (text: string) => Promise<{ ok: boolean; error?: string }>
  onUpdateStatus?: (callback: (status: UpdateStatus) => void) => (() => void) | void
}

type Props = {
  open: boolean
  onClose: () => void
  modeInfo: ModeInfo
  connectionInfo: ConnectionInfo
  licenseInfo: LicenseInfo
  autoLaunchEnabled: boolean
  closeToTrayEnabled: boolean
}

function getElectronAPI() {
  return typeof window !== 'undefined'
    ? (window as Window & { electronAPI?: ElectronAPI }).electronAPI
    : undefined
}

function formatHost(url?: string | null) {
  if (!url) return 'Not connected'

  try {
    return new URL(url).host
  } catch {
    return url.replace(/^https?:\/\//, '')
  }
}

function formatUpdateLabel(updateStatus?: UpdateStatus | null) {
  switch (updateStatus?.status) {
    case 'checking':
      return 'Checking for updates'
    case 'available':
      return updateStatus.info?.version ? `Update ${updateStatus.info.version} available` : 'Update available'
    case 'downloading':
      return updateStatus.progress?.percent
        ? `Downloading update (${Math.round(updateStatus.progress.percent)}%)`
        : 'Downloading update'
    case 'downloaded':
      return 'Update ready to install'
    case 'up-to-date':
      return 'Up to date'
    case 'dev':
      return 'Updates disabled in development'
    case 'error':
      return updateStatus.error || 'Update check failed'
    default:
      return 'No update check yet'
  }
}

function formatMode(modeInfo: ModeInfo) {
  return modeInfo.connected ? `${modeInfo.mode} mode` : 'Offline'
}

function formatModel(model?: string) {
  if (!model) return 'No active model'
  const parts = model.split('/')
  return parts[parts.length - 1]
}

function formatYesNo(value: boolean) {
  return value ? 'Enabled' : 'Disabled'
}

function buildDiagnosticsReport({
  diagnostics,
  modeInfo,
  connectionInfo,
  licenseInfo,
  autoLaunchEnabled,
  closeToTrayEnabled,
  updateStatus,
}: {
  diagnostics: DesktopDiagnostics | null
  modeInfo: ModeInfo
  connectionInfo: ConnectionInfo
  licenseInfo: LicenseInfo
  autoLaunchEnabled: boolean
  closeToTrayEnabled: boolean
  updateStatus: UpdateStatus | null
}) {
  const lines = [
    `Mission Control Diagnostics`,
    `Generated At: ${new Date().toISOString()}`,
    '',
    `Release`,
    `- Version: ${diagnostics?.appVersion || 'unknown'}`,
    `- Packaged: ${diagnostics?.isPackaged ? 'yes' : 'no'}`,
    `- Platform: ${diagnostics ? `${diagnostics.platform} (${diagnostics.arch})` : 'unknown'}`,
    `- Electron: ${diagnostics?.electronVersion || 'unknown'}`,
    `- Chromium: ${diagnostics?.chromiumVersion || 'unknown'}`,
    `- Node: ${diagnostics?.nodeVersion || 'unknown'}`,
    `- Local Port: ${diagnostics?.port || 'unknown'}`,
    '',
    `Runtime`,
    `- OpenClaw Configured: ${connectionInfo.configured ? 'yes' : 'no'}`,
    `- OpenClaw Host: ${formatHost(connectionInfo.openclawUrl)}`,
    `- Connection State: ${modeInfo.connected ? 'connected' : 'disconnected'}`,
    `- Mode: ${formatMode(modeInfo)}`,
    `- Model: ${formatModel(modeInfo.currentModel)}`,
    `- License: ${licenseInfo.valid ? 'active' : 'inactive'}`,
    `- License Email: ${licenseInfo.email || 'not provided'}`,
    `- Start On Login: ${autoLaunchEnabled ? 'enabled' : 'disabled'}`,
    `- Close To Tray: ${closeToTrayEnabled ? 'enabled' : 'disabled'}`,
    `- Update Status: ${formatUpdateLabel(updateStatus || diagnostics?.updateStatus || null)}`,
  ]

  if (updateStatus?.error) lines.push(`- Update Error: ${updateStatus.error}`)

  if (diagnostics) {
    lines.push(
      '',
      'Paths',
      `- Executable: ${diagnostics.paths.execPath}`,
      `- App Path: ${diagnostics.paths.appPath}`,
      `- User Data: ${diagnostics.paths.userData}`,
      `- Data: ${diagnostics.paths.data}`,
      `- Logs: ${diagnostics.paths.logs}`,
      `- Desktop Settings: ${diagnostics.paths.settingsFile}`,
      `- License File: ${diagnostics.paths.licenseFile}`,
    )
  }

  return lines.join('\n')
}

export function AboutDiagnosticsModal({
  open,
  onClose,
  modeInfo,
  connectionInfo,
  licenseInfo,
  autoLaunchEnabled,
  closeToTrayEnabled,
}: Props) {
  const [diagnostics, setDiagnostics] = useState<DesktopDiagnostics | null>(null)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<'refresh' | 'copy' | 'data' | 'logs' | null>(null)

  useEffect(() => {
    if (!open) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    const electronAPI = getElectronAPI()
    const unsubscribe = electronAPI?.onUpdateStatus?.((status) => {
      if (!cancelled) setUpdateStatus(status)
    })

    async function loadDiagnostics() {
      if (!electronAPI?.getDesktopDiagnostics) {
        setDiagnostics(null)
        setUpdateStatus(null)
        setError('Desktop diagnostics are only available in the installed app.')
        return
      }

      setLoading(true)
      setError(null)

      try {
        const result = await electronAPI.getDesktopDiagnostics()
        if (cancelled) return
        setDiagnostics(result)
        setUpdateStatus(result.updateStatus || null)
      } catch {
        if (!cancelled) setError('Could not load desktop diagnostics.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadDiagnostics().catch(() => {})

    return () => {
      cancelled = true
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [open])

  if (!open) return null

  async function refreshDiagnostics() {
    const electronAPI = getElectronAPI()
    if (!electronAPI?.getDesktopDiagnostics) {
      setActionMessage('Desktop diagnostics are only available in the installed app.')
      return
    }

    setBusyAction('refresh')
    setActionMessage(null)

    try {
      const result = await electronAPI.getDesktopDiagnostics()
      setDiagnostics(result)
      setUpdateStatus(result.updateStatus || null)
      setError(null)
      setActionMessage('Diagnostics refreshed.')
    } catch {
      setError('Could not refresh desktop diagnostics.')
    } finally {
      setBusyAction(null)
    }
  }

  async function copyDiagnostics() {
    const electronAPI = getElectronAPI()
    const report = buildDiagnosticsReport({
      diagnostics,
      modeInfo,
      connectionInfo,
      licenseInfo,
      autoLaunchEnabled,
      closeToTrayEnabled,
      updateStatus,
    })

    setBusyAction('copy')
    setActionMessage(null)

    try {
      if (electronAPI?.copyText) {
        const result = await electronAPI.copyText(report)
        if (!result.ok) throw new Error(result.error || 'Copy failed')
      } else {
        await navigator.clipboard.writeText(report)
      }
      setActionMessage('Diagnostics copied to clipboard.')
    } catch {
      setActionMessage('Could not copy diagnostics. Try again.')
    } finally {
      setBusyAction(null)
    }
  }

  async function openDirectory(kind: 'data' | 'logs') {
    const electronAPI = getElectronAPI()
    const handler = kind === 'data' ? electronAPI?.openDataDirectory : electronAPI?.openLogsDirectory

    if (!handler) {
      setActionMessage('Folder access is only available in the desktop app.')
      return
    }

    setBusyAction(kind)
    setActionMessage(null)

    try {
      const result = await handler()
      if (!result.ok) throw new Error(result.error || 'Open failed')
      setActionMessage(kind === 'data' ? 'Opened Mission Control data folder.' : 'Opened Mission Control logs folder.')
    } catch {
      setActionMessage(kind === 'data' ? 'Could not open the data folder.' : 'Could not open the logs folder.')
    } finally {
      setBusyAction(null)
    }
  }

  const effectiveUpdateStatus = updateStatus || diagnostics?.updateStatus || null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-diagnostics-title"
        className="relative mx-4 w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/[0.08] bg-[var(--background-card)] shadow-2xl shadow-black/50"
      >
        <div className="border-b border-white/[0.06] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                <Laptop className="h-3.5 w-3.5" />
                Desktop Support
              </div>
              <h2 id="about-diagnostics-title" className="text-xl font-semibold text-[var(--text-primary)]">
                About Mission Control
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Version details, runtime health, and a clean diagnostics snapshot for support.
              </p>
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-[var(--text-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <SummaryCard
              icon={<Package className="h-4 w-4 text-sky-300" />}
              label="Version"
              value={diagnostics?.appVersion || 'Loading'}
              detail={diagnostics?.isPackaged ? 'Installed build' : 'Development build'}
            />
            <SummaryCard
              icon={<Info className="h-4 w-4 text-violet-300" />}
              label="Platform"
              value={diagnostics ? `${diagnostics.platform} / ${diagnostics.arch}` : 'Loading'}
              detail={diagnostics ? `Electron ${diagnostics.electronVersion}` : 'Collecting system info'}
            />
            <SummaryCard
              icon={modeInfo.connected ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <AlertTriangle className="h-4 w-4 text-amber-300" />}
              label="Connection"
              value={connectionInfo.configured ? formatHost(connectionInfo.openclawUrl) : 'Not configured'}
              detail={modeInfo.connected ? formatMode(modeInfo) : 'Offline or unreachable'}
            />
            <SummaryCard
              icon={<ShieldCheck className="h-4 w-4 text-emerald-300" />}
              label="Updates"
              value={formatUpdateLabel(effectiveUpdateStatus)}
              detail={effectiveUpdateStatus?.error || 'Release checks available from the desktop menu'}
            />
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading desktop diagnostics...
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="space-y-5">
                <Panel title="Runtime" description="What the customer-facing app is doing right now.">
                  <KeyValueRow label="OpenClaw" value={connectionInfo.configured ? formatHost(connectionInfo.openclawUrl) : 'Not configured'} />
                  <KeyValueRow label="Connection State" value={modeInfo.connected ? 'Connected' : 'Disconnected'} />
                  <KeyValueRow label="Mode" value={formatMode(modeInfo)} />
                  <KeyValueRow label="Model" value={formatModel(modeInfo.currentModel)} />
                  <KeyValueRow label="License" value={licenseInfo.valid ? (licenseInfo.email || 'Active') : 'Not activated'} />
                  <KeyValueRow label="Start On Login" value={formatYesNo(autoLaunchEnabled)} />
                  <KeyValueRow label="Close To Tray" value={formatYesNo(closeToTrayEnabled)} />
                  <KeyValueRow label="Update Status" value={formatUpdateLabel(effectiveUpdateStatus)} />
                </Panel>

                <Panel title="Paths" description="These folders matter when support needs exported data or logs.">
                  <PathRow label="Executable" value={diagnostics?.paths.execPath || 'Unavailable'} />
                  <PathRow label="User Data" value={diagnostics?.paths.userData || 'Unavailable'} />
                  <PathRow label="App Data" value={diagnostics?.paths.data || 'Unavailable'} />
                  <PathRow label="Logs" value={diagnostics?.paths.logs || 'Unavailable'} />
                  <PathRow label="Desktop Settings" value={diagnostics?.paths.settingsFile || 'Unavailable'} />
                  <PathRow label="License File" value={diagnostics?.paths.licenseFile || 'Unavailable'} />
                </Panel>
              </section>

              <section className="space-y-5">
                <Panel title="Build Details" description="Release metadata for support and packaging checks.">
                  <KeyValueRow label="Mission Control" value={diagnostics?.appVersion || 'Unavailable'} />
                  <KeyValueRow label="Electron" value={diagnostics?.electronVersion || 'Unavailable'} />
                  <KeyValueRow label="Chromium" value={diagnostics?.chromiumVersion || 'Unavailable'} />
                  <KeyValueRow label="Node" value={diagnostics?.nodeVersion || 'Unavailable'} />
                  <KeyValueRow label="Platform" value={diagnostics ? `${diagnostics.platform} (${diagnostics.arch})` : 'Unavailable'} />
                  <KeyValueRow label="Local Port" value={diagnostics ? String(diagnostics.port) : 'Unavailable'} />
                </Panel>

                <Panel title="Support Actions" description="Fast ways to gather info before a bug report or install issue.">
                  <ActionButton
                    label="Copy Diagnostics"
                    description="Copies version, runtime state, and file paths."
                    icon={<Copy className="h-4 w-4" />}
                    busy={busyAction === 'copy'}
                    onClick={copyDiagnostics}
                  />
                  <ActionButton
                    label="Open Data Folder"
                    description="Shows connection, budget, subscription, and local app files."
                    icon={<FolderOpen className="h-4 w-4" />}
                    busy={busyAction === 'data'}
                    onClick={() => openDirectory('data')}
                  />
                  <ActionButton
                    label="Open Logs Folder"
                    description="Opens the desktop logs location used by the installed app."
                    icon={<FolderOpen className="h-4 w-4" />}
                    busy={busyAction === 'logs'}
                    onClick={() => openDirectory('logs')}
                  />
                  <ActionButton
                    label="Refresh Snapshot"
                    description="Reloads current runtime data from Electron."
                    icon={<RefreshCw className="h-4 w-4" />}
                    busy={busyAction === 'refresh'}
                    onClick={refreshDiagnostics}
                  />
                </Panel>
              </section>
            </div>
          )}

          {error ? (
            <div className="mt-5 flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>{error}</span>
            </div>
          ) : null}

          {actionMessage ? (
            <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-[var(--text-secondary)]">
              {actionMessage}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        {icon}
        <span className="text-[11px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]">{detail}</p>
    </div>
  )
}

function Panel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] pb-3 last:border-b-0 last:pb-0">
      <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</span>
      <span className="text-right text-sm text-[var(--text-primary)]">{value}</span>
    </div>
  )
}

function PathRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-black/10 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 break-all font-mono text-[12px] text-[var(--text-secondary)]">{value}</p>
    </div>
  )
}

function ActionButton({
  label,
  description,
  icon,
  busy,
  onClick,
}: {
  label: string
  description: string
  icon: ReactNode
  busy?: boolean
  onClick: () => void | Promise<void>
}) {
  return (
    <button
      onClick={() => onClick()}
      disabled={busy}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 text-left transition-colors hover:bg-white/[0.05] disabled:cursor-wait disabled:opacity-70"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-black/10 text-[var(--text-secondary)]">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-[11px] text-[var(--text-muted)]">{description}</p>
      </div>
    </button>
  )
}

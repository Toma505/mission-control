"use client"

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Info,
  KeyRound,
  Loader2,
  LogOut,
  Plug,
  Rocket,
  ShieldCheck,
} from 'lucide-react'
import { formatUpdaterMessage } from '@/lib/updater-status'
import { AboutDiagnosticsModal } from './about-diagnostics-modal'
import { OPEN_DIAGNOSTICS_EVENT } from './desktop-events'

type ElectronAPI = {
  checkLicense?: () => Promise<{ valid: boolean; email: string | null }>
  getAutoLaunch?: () => Promise<boolean>
  setAutoLaunch?: (enabled: boolean) => Promise<{ ok: boolean; error?: string }>
  getCloseToTray?: () => Promise<boolean>
  setCloseToTray?: (enabled: boolean) => Promise<{ ok: boolean; error?: string }>
  updaterCheck?: () => Promise<{ status: string; info?: { version?: string } | null; error?: string | null }>
  quit?: () => Promise<{ ok: boolean }>
}

type ModeInfo = {
  connected: boolean
  mode: string
  currentModel?: string
}

type ConnectionInfo = {
  configured: boolean
  openclawUrl?: string | null
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

function formatModelName(model?: string) {
  if (!model) return 'No model detected'
  const parts = model.split('/')
  return parts[parts.length - 1]
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.json()
}

export function ProfileMenu() {
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [modeInfo, setModeInfo] = useState<ModeInfo>({ connected: false, mode: 'offline' })
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({ configured: false })
  const [licenseInfo, setLicenseInfo] = useState<{ valid: boolean; email: string | null }>({ valid: false, email: null })
  const [autoLaunchEnabled, setAutoLaunchEnabled] = useState(false)
  const [closeToTrayEnabled, setCloseToTrayEnabled] = useState(true)
  const [busyToggle, setBusyToggle] = useState<'autoLaunch' | 'closeToTray' | null>(null)
  const [updateBusy, setUpdateBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  useEffect(() => {
    const openDiagnostics = () => {
      setOpen(false)
      setAboutOpen(true)
    }

    window.addEventListener(OPEN_DIAGNOSTICS_EVENT, openDiagnostics)
    return () => window.removeEventListener(OPEN_DIAGNOSTICS_EVENT, openDiagnostics)
  }, [])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    const electronAPI = getElectronAPI()

    async function loadMenuState() {
      const [modeResult, connectionResult, licenseResult, autoLaunchResult, closeToTrayResult] = await Promise.allSettled([
        readJson<ModeInfo>('/api/mode'),
        readJson<ConnectionInfo>('/api/connection'),
        electronAPI?.checkLicense?.() ?? Promise.resolve({ valid: false, email: null }),
        electronAPI?.getAutoLaunch?.() ?? Promise.resolve(false),
        electronAPI?.getCloseToTray?.() ?? Promise.resolve(true),
      ])

      if (cancelled) return

      if (modeResult.status === 'fulfilled') setModeInfo(modeResult.value)
      if (connectionResult.status === 'fulfilled') setConnectionInfo(connectionResult.value)
      if (licenseResult.status === 'fulfilled') setLicenseInfo(licenseResult.value)
      if (autoLaunchResult.status === 'fulfilled') setAutoLaunchEnabled(autoLaunchResult.value)
      if (closeToTrayResult.status === 'fulfilled') setCloseToTrayEnabled(closeToTrayResult.value)
    }

    loadMenuState().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open])

  async function setAutoLaunch(nextValue: boolean) {
    const electronAPI = getElectronAPI()
    if (!electronAPI?.setAutoLaunch) {
      setMessage('Start on Login is only available in the desktop app.')
      return
    }

    setBusyToggle('autoLaunch')
    const result = await electronAPI.setAutoLaunch(nextValue)
    setBusyToggle(null)

    if (result.ok) {
      setAutoLaunchEnabled(nextValue)
      setMessage(nextValue ? 'Mission Control will launch when you sign in.' : 'Start on Login disabled.')
      return
    }

    setMessage(result.error || 'Could not update Start on Login.')
  }

  async function setCloseToTray(nextValue: boolean) {
    const electronAPI = getElectronAPI()
    if (!electronAPI?.setCloseToTray) {
      setMessage('Close to Tray is only available in the desktop app.')
      return
    }

    setBusyToggle('closeToTray')
    const result = await electronAPI.setCloseToTray(nextValue)
    setBusyToggle(null)

    if (result.ok) {
      setCloseToTrayEnabled(nextValue)
      setMessage(nextValue ? 'Closing the window will keep Mission Control running in the tray.' : 'Closing the window will fully quit Mission Control.')
      return
    }

    setMessage(result.error || 'Could not update Close to Tray.')
  }

  async function checkForUpdates() {
    const electronAPI = getElectronAPI()
    if (!electronAPI?.updaterCheck) {
      setMessage('Update checks are only available in the desktop app.')
      return
    }

    setUpdateBusy(true)
    const result = await electronAPI.updaterCheck()
    setUpdateBusy(false)
    setMessage(formatUpdaterMessage(result) || 'Update check started.')
  }

  async function quitMissionControl() {
    const electronAPI = getElectronAPI()
    setOpen(false)
    await electronAPI?.quit?.()
  }

  function openRoute(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <AboutDiagnosticsModal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        modeInfo={modeInfo}
        connectionInfo={connectionInfo}
        licenseInfo={licenseInfo}
        autoLaunchEnabled={autoLaunchEnabled}
        closeToTrayEnabled={closeToTrayEnabled}
      />

      <div className="relative electron-no-drag" ref={menuRef}>
        <button
          onClick={() => setOpen(prev => !prev)}
          className={`flex items-center gap-1 rounded-full pl-0 pr-1 h-7 transition-all duration-200 ${
            open ? 'bg-white/[0.08]' : 'hover:bg-white/[0.06]'
          }`}
          title="Mission Control menu"
          aria-label="Mission Control menu"
          aria-expanded={open}
        >
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-zinc-500 to-zinc-600 flex items-center justify-center text-white font-medium text-[10px] shadow-md shadow-black/15">
            T
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute right-0 top-10 z-50 w-[320px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[var(--background-card)] shadow-2xl shadow-black/40">
            <div className="border-b border-white/[0.06] px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-500 to-zinc-700 flex items-center justify-center text-white font-semibold text-xs shadow-md shadow-black/20">
                  T
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Mission Control Desktop</p>
                  <p className="truncate text-[11px] text-[var(--text-muted)]">{formatHost(connectionInfo.openclawUrl)}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <InfoCard
                  label="Mode"
                  value={modeInfo.connected ? `${modeInfo.mode} mode` : 'Offline'}
                  tone={modeInfo.connected ? 'success' : 'muted'}
                />
                <InfoCard
                  label="License"
                  value={licenseInfo.valid ? 'Active' : 'Not activated'}
                  tone={licenseInfo.valid ? 'success' : 'muted'}
                />
              </div>

              <p className="mt-3 truncate text-[11px] text-[var(--text-muted)]">
                {modeInfo.connected ? formatModelName(modeInfo.currentModel) : 'Connect your OpenClaw instance to unlock live features.'}
              </p>
            </div>

            <div className="p-2">
              <MenuButton
                icon={<Plug className="w-4 h-4" />}
                label="Connection Settings"
                description="Reconfigure your OpenClaw URL and credentials"
                onClick={() => openRoute('/setup?reconfigure=true')}
              />
              <MenuButton
                icon={<KeyRound className="w-4 h-4" />}
                label="License"
                description={licenseInfo.valid && licenseInfo.email ? licenseInfo.email : 'View or activate your desktop license'}
                onClick={() => openRoute('/activate')}
              />
              <MenuButton
                icon={<Info className="w-4 h-4" />}
                label="About & Diagnostics"
                description="Version details, local paths, and support tools"
                onClick={() => {
                  setOpen(false)
                  setAboutOpen(true)
                }}
              />
              <MenuButton
                icon={updateBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                label="Check for Updates"
                description="Look for the latest Mission Control desktop build"
                onClick={checkForUpdates}
              />
            </div>

            <div className="border-y border-white/[0.06] px-4 py-3 space-y-3">
              <ToggleRow
                label="Start on Login"
                description="Launch Mission Control when you sign in"
                checked={autoLaunchEnabled}
                busy={busyToggle === 'autoLaunch'}
                onChange={setAutoLaunch}
              />
              <ToggleRow
                label="Close to Tray"
                description={closeToTrayEnabled ? 'Closing the window keeps Mission Control running in the tray' : 'Closing the window fully quits Mission Control'}
                checked={closeToTrayEnabled}
                busy={busyToggle === 'closeToTray'}
                onChange={setCloseToTray}
              />
            </div>

            <div className="p-2">
              <MenuButton
                icon={<LogOut className="w-4 h-4" />}
                label="Quit Mission Control"
                description="Fully close the desktop app"
                danger
                onClick={quitMissionControl}
              />
            </div>

            <div className="border-t border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {message || 'Desktop behavior changes are saved for this device.'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function InfoCard({ label, value, tone = 'muted' }: { label: string; value: string; tone?: 'muted' | 'success' }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]/80">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        {tone === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : null}
        <span className="text-xs font-medium text-[var(--text-primary)]">{value}</span>
      </div>
    </div>
  )
}

function MenuButton({
  icon,
  label,
  description,
  onClick,
  danger = false,
}: {
  icon: ReactNode
  label: string
  description: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
        danger
          ? 'hover:bg-red-500/10'
          : 'hover:bg-white/[0.04]'
      }`}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
        danger
          ? 'border-red-500/20 bg-red-500/10 text-red-300'
          : 'border-white/[0.08] bg-white/[0.04] text-[var(--text-secondary)]'
      }`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${danger ? 'text-red-200' : 'text-[var(--text-primary)]'}`}>{label}</p>
        <p className="truncate text-[11px] text-[var(--text-muted)]">{description}</p>
      </div>
      <ArrowUpRight className={`w-3.5 h-3.5 shrink-0 ${danger ? 'text-red-300/70' : 'text-[var(--text-muted)]/70'}`} />
    </button>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  busy,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  busy?: boolean
  onChange: (value: boolean) => void | Promise<void>
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-[var(--text-primary)]">{label}</p>
        <p className="text-[11px] text-[var(--text-muted)]">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-[22px] w-10 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[var(--accent-primary,#3b82f6)]' : 'bg-white/[0.1]'
        } ${busy ? 'opacity-60' : ''}`}
        disabled={busy}
        aria-label={label}
        aria-pressed={checked}
      >
        <div
          className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'left-[22px]' : 'left-[3px]'
          }`}
        />
        {busy ? (
          <Loader2 className="absolute inset-0 m-auto w-3 h-3 animate-spin text-[var(--background)]" />
        ) : null}
      </button>
    </div>
  )
}

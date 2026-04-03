import Link from 'next/link'

import { OnboardingChecklist } from '@/components/dashboard/onboarding-checklist'
import { RefreshControl } from '@/components/dashboard/refresh-control'
import { WidgetGrid } from '@/components/dashboard/widget-grid'
import { getAppBaseUrl } from '@/lib/app-url'
import { DEFAULT_SETTINGS, type Settings } from '@/lib/app-settings'

type DashboardMode = {
  mode: string
  currentModel: string
  connected: boolean
}

type DashboardStatus = {
  value?: string
  subtitle?: string
  online?: boolean
  heartbeat?: string
  memory?: string
  version?: string
}

type DashboardSession = {
  key: string
  model: string
  tokens: string
  age: string
}

type DashboardChannel = {
  name: string
  state: string
}

type DashboardActivity = {
  id: string
  type: string
  title: string
  description?: string
  status: string
  timestamp: string
}

async function getDashboardData() {
  const baseUrl = getAppBaseUrl()

  try {
    const [activitiesRes, modeRes, settingsRes] = await Promise.all([
      fetch(`${baseUrl}/api/activities`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/mode`, { cache: 'no-store' }).catch(() => null),
      fetch(`${baseUrl}/api/settings`, { cache: 'no-store' }).catch(() => null),
    ])

    if (!activitiesRes.ok) throw new Error('Failed to fetch dashboard data')

    const data = await activitiesRes.json()
    const activities: DashboardActivity[] = (data.activities || []).map((activity: any) => ({
      ...activity,
      timestamp: activity.timestamp,
    }))

    const mode: DashboardMode =
      modeRes && modeRes.ok
        ? await modeRes.json()
        : { mode: 'unknown', currentModel: '', connected: false }
    const settingsPayload =
      settingsRes && settingsRes.ok ? await settingsRes.json().catch(() => null) : null
    const settings: Settings = settingsPayload?.settings ?? DEFAULT_SETTINGS

    return {
      connected: data.connected,
      status: (data.status ?? null) as DashboardStatus | null,
      sessions: (data.sessions || []) as DashboardSession[],
      channels: (data.channels || []) as DashboardChannel[],
      activities,
      mode,
      settings,
    }
  } catch {
    return {
      connected: false,
      status: null,
      sessions: [] as DashboardSession[],
      channels: [] as DashboardChannel[],
      activities: [] as DashboardActivity[],
      mode: { mode: 'unknown', currentModel: '', connected: false } as DashboardMode,
      settings: DEFAULT_SETTINGS,
    }
  }
}

export default async function Home() {
  const { connected, status, sessions, channels, activities, mode, settings } =
    await getDashboardData()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Mission Control</h1>
          <p className="text-sm text-text-secondary">
            Real-time overview of all systems
            {connected && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-status-active">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-active" />
                Live
              </span>
            )}
          </p>
        </div>
        <RefreshControl />
      </div>

      {!connected && (
        <div className="glass flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
          <div className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
          <p className="flex-1 text-sm text-text-secondary">
            Not connected to OpenClaw. Live data is unavailable.
          </p>
          <Link
            href="/setup?reconfigure=true"
            className="whitespace-nowrap rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-white/[0.1]"
          >
            Check Connection
          </Link>
        </div>
      )}

      <OnboardingChecklist />

      <WidgetGrid
        connected={connected}
        status={status}
        sessions={sessions}
        channels={channels}
        activities={activities}
        mode={mode}
        initialSettings={settings}
      />
    </div>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { StatusCard } from '@/components/dashboard/status-card'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { QuickLinks } from '@/components/dashboard/quick-links'
import { CostWidget } from '@/components/dashboard/bandwidth-widget'
import { RefreshControl } from '@/components/dashboard/refresh-control'
import { OnboardingChecklist } from '@/components/dashboard/onboarding-checklist'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { getAppBaseUrl } from '@/lib/app-url'
import { readSettings } from '@/lib/settings-store'

async function getDashboardData() {
  const baseUrl = getAppBaseUrl()

  try {
    const res = await fetch(`${baseUrl}/api/activities`, { cache: 'no-store' })

    if (!res.ok) throw new Error('Failed to fetch dashboard data')

    const data = await res.json()

    const activities = (data.activities || []).map((a: any) => ({
      ...a,
      timestamp: new Date(a.timestamp),
    }))

    // Get mode info
    let mode = { mode: 'unknown', currentModel: '', connected: false }
    try {
      const modeRes = await fetch(`${baseUrl}/api/mode`, { cache: 'no-store' })
      if (modeRes.ok) mode = await modeRes.json()
    } catch {}

    return {
      connected: data.connected,
      status: data.status,
      sessions: data.sessions || [],
      channels: data.channels || [],
      agent: data.agent,
      activities,
      mode,
    }
  } catch {
    return {
      connected: false,
      status: null,
      sessions: [],
      channels: [],
      agent: null,
      activities: [],
      mode: { mode: 'unknown', currentModel: '', connected: false },
    }
  }
}

const modeLabels: Record<string, { label: string; color: string; dot: string }> = {
  best: { label: 'Best', color: 'text-amber-400', dot: 'bg-amber-400' },
  standard: { label: 'Standard', color: 'text-sky-400', dot: 'bg-sky-400' },
  budget: { label: 'Budget', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  auto: { label: 'Auto', color: 'text-violet-400', dot: 'bg-violet-400' },
}

export default async function Home() {
  const settings = await readSettings()
  if (!settings.onboardingComplete) {
    redirect('/onboarding')
  }

  const { connected, status, sessions, channels, agent, activities, mode } =
    await getDashboardData()

  const modeInfo = modeLabels[mode.mode] || { label: 'Unknown', color: 'text-text-muted', dot: 'bg-text-muted' }

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Mission Control</h1>
          <p className="text-sm text-text-secondary">
            Real-time overview of all systems
            {connected && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-status-active">
                <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-pulse" />
                Live
              </span>
            )}
          </p>
        </div>
        <RefreshControl />
      </div>

      {/* Disconnected banner */}
      {!connected && (
        <div className="glass rounded-xl p-4 flex items-center gap-3 border border-amber-400/20 bg-amber-400/5">
          <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <p className="text-sm text-text-secondary flex-1">
            Not connected to OpenClaw. Live data is unavailable.
          </p>
          <Link
            href="/setup?reconfigure=true"
            className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-xs font-medium text-text-primary hover:bg-white/[0.1] transition-colors whitespace-nowrap"
          >
            Check Connection
          </Link>
        </div>
      )}

      {/* Onboarding checklist (auto-hides when complete or dismissed) */}
      <OnboardingChecklist />

      {/* Status cards row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          title="Status"
          value={status?.value || 'Unknown'}
          subtitle={status?.subtitle || ''}
          dotColor={status?.online ? 'bg-status-active' : 'bg-status-error'}
          href="/"
        />
        <StatusCard
          title="AI Mode"
          value={modeInfo.label}
          subtitle={mode.currentModel?.split('/').pop() || 'Not configured'}
          dotColor={mode.connected ? modeInfo.dot : 'bg-text-muted'}
          href="/costs"
        />
        <StatusCard
          title="Channels"
          value={channels.length > 0 ? channels.map((c: any) => c.name).join(', ') : 'None'}
          subtitle={channels.length > 0
            ? channels.map((c: any) => `${c.name}: ${c.state}`).join(' · ')
            : 'No channels configured'}
          dotColor={channels.some((c: any) => c.state === 'OK') ? 'bg-status-active' : 'bg-text-muted'}
          href="/clients"
        />
        <StatusCard
          title="Sessions"
          value={String(sessions.length)}
          subtitle={sessions.length > 0 ? `Active agent sessions` : 'No active sessions'}
          dotColor={sessions.length > 0 ? 'bg-accent-primary' : 'bg-text-muted'}
          href="/agents"
        />
      </div>

      {/* Live connection info bar */}
      {connected && status?.online && (
        <div className="glass rounded-xl p-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-status-active" />
            {status.subtitle}
          </span>
          <span>Heartbeat: {status.heartbeat}</span>
          <span>Memory: {status.memory?.split('·')[0]?.trim() || 'N/A'}</span>
          {status.version && <span>{status.version}</span>}
          {mode.connected && (
            <span className={modeInfo.color}>
              {modeInfo.label} Mode · {mode.currentModel?.split('/').pop()}
            </span>
          )}
        </div>
      )}

      {/* Main content: 2-column with right sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column (~60%) */}
        <div className="lg:col-span-3 space-y-6">
          {activities.length > 0 ? (
            <ActivityFeed activities={activities} />
          ) : (
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-2">Live Activity</h2>
              <p className="text-sm text-text-secondary">
                {connected
                  ? 'No recent activity. Sessions will appear here as your agent works.'
                  : 'Connect to OpenClaw to see live activity.'}
              </p>
            </div>
          )}
        </div>

        {/* Right column (~40%) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Sessions detail widget */}
          {sessions.length > 0 && (
            <div className="glass rounded-2xl p-4">
              <h3 className="text-sm font-medium text-text-secondary mb-3">Active Sessions</h3>
              <div className="space-y-3">
                {sessions.map((s: any, i: number) => (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate">
                        {s.key.includes('channel:') ? 'Discord Channel' :
                         s.key === 'agent:main:main' ? 'Main Agent' :
                         s.key.includes('subagent:') ? `Sub-agent: ${s.key.split(':').pop()}` :
                         'Discord DM'}
                      </p>
                      <p className="text-xs text-text-muted">{s.model} · {s.tokens}</p>
                    </div>
                    <span className="text-xs text-text-muted whitespace-nowrap">{s.age}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <QuickActions />
          <CostWidget />
          <QuickLinks />
        </div>
      </div>
    </div>
  )
}

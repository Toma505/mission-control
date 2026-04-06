import { Activity, Wrench } from 'lucide-react'

import { PageEmptyState } from '@/components/layout/page-empty-state'
import { getAppBaseUrl } from '@/lib/app-url'

interface Session {
  key: string
  age: string
}

async function getWorkshop(): Promise<{ connected: boolean; sessions: Session[]; agentInfo: string }> {
  const baseUrl = getAppBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/api/agents`, { cache: 'no-store' })
    if (!res.ok) return { connected: false, sessions: [], agentInfo: '' }
    const data = await res.json()
    return { connected: data.connected, sessions: data.sessions || [], agentInfo: data.agentInfo || '' }
  } catch {
    return { connected: false, sessions: [], agentInfo: '' }
  }
}

export default async function WorkshopPage() {
  const { connected, sessions, agentInfo } = await getWorkshop()

  if (!connected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Workshop</h1>
          <p className="text-sm text-text-secondary">Active tasks and sessions</p>
        </div>

        <PageEmptyState
          icon={<Wrench className="w-8 h-8 text-text-muted" />}
          title="Connect your workspace"
          description="Finish setup to load live sessions, running tasks, and agent work queues from OpenClaw. We do not show placeholder work here."
          primaryAction={{ label: 'Open Connection Settings', href: '/setup?reconfigure=true' }}
          secondaryAction={{ label: 'Go to Dashboard', href: '/' }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Workshop</h1>
        <p className="text-sm text-text-secondary">
          Active tasks and sessions
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-status-active">
            <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-pulse" />
            OpenClaw connected
          </span>
        </p>
      </div>

      {sessions.length === 0 ? (
        <PageEmptyState
          icon={<Wrench className="w-8 h-8 text-text-muted" />}
          title="No active tasks"
          description="Nothing is running right now. Active sessions will appear here when your agents start processing work."
          secondaryAction={{ label: 'Open Operations', href: '/operations' }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="glass rounded-2xl p-5">
              <p className="text-xs text-text-muted mb-1">Active Sessions</p>
              <p className="text-2xl font-bold text-text-primary">{sessions.length}</p>
            </div>
            {agentInfo && (
              <div className="glass rounded-2xl p-5">
                <p className="text-xs text-text-muted mb-1">Agent Status</p>
                <p className="text-sm font-medium text-text-primary mt-1">{agentInfo}</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-text-primary">Running Sessions</h2>
            {sessions.map((session) => (
              <div key={session.key} className="glass rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-status-active/10">
                    <Activity className="w-4 h-4 text-status-active" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{session.key}</p>
                    <p className="text-xs text-text-muted">{session.age}</p>
                  </div>
                  <div className="ml-auto">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-status-active/10 text-status-active border border-status-active/20">
                      Running
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

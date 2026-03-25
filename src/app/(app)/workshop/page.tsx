import { Wrench, Activity } from 'lucide-react'
import { getAppBaseUrl } from '@/lib/app-url'
import { PageEmptyState } from '@/components/layout/page-empty-state'

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
    const previewTasks = [
      {
        title: 'Content Pipeline',
        detail: 'Scout phase',
        status: 'Running demo task',
      },
      {
        title: 'Discord DM',
        detail: 'responding',
        status: 'Waiting on reply',
      },
      {
        title: 'Scheduled backup',
        detail: 'waiting',
        status: 'Queued for next window',
      },
    ]

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Workshop</h1>
          <p className="text-sm text-text-secondary">Active tasks and sessions</p>
        </div>

        <div className="glass rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
              <Wrench className="w-6 h-6 text-text-muted" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-text-primary">Connect your workspace</h2>
              <p className="text-sm text-text-secondary max-w-2xl">
                Finish setup to load live sessions, running tasks, and agent work queues from OpenClaw. Until then,
                this preview shows how active work appears in the workshop.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 opacity-65">
            {previewTasks.map(task => (
              <div
                key={`${task.title}-${task.detail}`}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/[0.05]">
                    <Activity className="w-4 h-4 text-text-muted" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {task.title} — {task.detail}
                    </p>
                    <p className="text-xs text-text-muted mt-1">{task.status}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.04] text-text-muted border border-white/[0.08]">
                    Preview
                  </span>
                  <span className="text-[10px] text-text-muted">Waiting for connection</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href="/setup?reconfigure=true"
              className="inline-flex items-center justify-center rounded-xl bg-accent-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-primary/90 transition-colors"
            >
              Open Connection Settings
            </a>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Workshop</h1>
        <p className="text-sm text-text-secondary">
          Active tasks and sessions
          {connected && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-status-active">
              <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-pulse" />
              OpenClaw connected
            </span>
          )}
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

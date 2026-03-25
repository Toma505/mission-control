import { Users, Bot, Activity } from 'lucide-react'
import { getAppBaseUrl } from '@/lib/app-url'
import { PageEmptyState } from '@/components/layout/page-empty-state'
import { UptimeTimeline } from '@/components/agents/uptime-timeline'
import { AgentHealthScore } from '@/components/agents/agent-health-score'
import { ExportButton } from '@/components/export/export-button'

interface Agent {
  name: string
  model: string
  description: string
  enabled: boolean
}

interface Session {
  key: string
  age: string
}

async function getAgents(): Promise<{ connected: boolean; demo?: boolean; agents: Agent[]; sessions: Session[]; agentInfo: string; memory: string }> {
  const baseUrl = getAppBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/api/agents`, { cache: 'no-store' })
    if (!res.ok) return { connected: false, demo: false, agents: [], sessions: [], agentInfo: '', memory: '' }
    return await res.json()
  } catch {
    return { connected: false, demo: false, agents: [], sessions: [], agentInfo: '', memory: '' }
  }
}

export default async function AgentsPage() {
  const { connected, demo, agents, sessions, agentInfo, memory } = await getAgents()

  const hasData = agents.length > 0 || sessions.length > 0

  if (!connected && !demo) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">Agents</h1>
            <p className="text-sm text-text-secondary">Manage and monitor your AI agents</p>
          </div>
          <ExportButton type="usage" />
        </div>
        <PageEmptyState
          icon={<Users className="w-8 h-8 text-text-muted" />}
          title="Connect your workspace"
          description="Finish setup to load your OpenClaw agents, active sessions, and model details."
          primaryAction={{ label: 'Open Connection Settings', href: '/setup?reconfigure=true' }}
          secondaryAction={{ label: 'Go to Dashboard', href: '/' }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Agents</h1>
          <p className="text-sm text-text-secondary">
            Manage and monitor your AI agents
            {connected ? (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-status-active">
                <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-pulse" />
                OpenClaw connected
              </span>
            ) : demo ? (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                Demo data
              </span>
            ) : null}
          </p>
        </div>
        <ExportButton type="usage" />
      </div>

      {demo && (
        <div className="glass rounded-2xl p-4 border border-amber-400/20 bg-amber-400/5">
          <p className="text-sm font-medium text-amber-200">Demo data — connect OpenClaw to see live data.</p>
          <p className="text-xs text-amber-100/70 mt-1">
            Agent definitions, sessions, and memory stats below are sample data to preview the workspace.
          </p>
        </div>
      )}

      {!hasData ? (
        <PageEmptyState
          icon={<Users className="w-8 h-8 text-text-muted" />}
          title="No agents configured"
          description="Configure agents in your OpenClaw workspace and they will appear here automatically."
          secondaryAction={{ label: 'Go to Dashboard', href: '/' }}
        />
      ) : (
        <>
          {/* Overview */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-5">
              <p className="text-xs text-text-muted mb-1">Agents</p>
              <p className="text-2xl font-bold text-text-primary">{agents.length}</p>
              <p className="text-xs text-text-muted mt-1">{agentInfo || 'configured'}</p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-xs text-text-muted mb-1">Active Sessions</p>
              <p className="text-2xl font-bold text-text-primary">{sessions.length}</p>
            </div>
            {memory && (
              <div className="glass rounded-2xl p-5">
                <p className="text-xs text-text-muted mb-1">Memory</p>
                <p className="text-2xl font-bold text-text-primary">{memory}</p>
              </div>
            )}
          </div>

          <UptimeTimeline />
          <AgentHealthScore />

          {/* Agent list */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-text-primary">Agent Definitions</h2>
            {agents.map((agent) => (
              <div key={agent.name} className="glass rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-background-elevated">
                    <Bot className="w-5 h-5 text-text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">{agent.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        agent.enabled
                          ? 'bg-status-active/10 text-status-active border border-status-active/20'
                          : 'bg-white/[0.06] text-text-muted border border-white/[0.06]'
                      }`}>
                        {agent.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">{agent.model}</p>
                    {agent.description && (
                      <p className="text-xs text-text-secondary mt-1 truncate">{agent.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Active sessions */}
          {sessions.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-text-primary">Active Sessions</h2>
              {sessions.map((session) => (
                <div key={session.key} className="glass rounded-2xl p-4 flex items-center gap-3">
                  <Activity className="w-4 h-4 text-status-active" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{session.key}</p>
                    <p className="text-xs text-text-muted">{session.age}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

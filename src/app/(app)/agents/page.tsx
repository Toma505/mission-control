import { Users, Bot, Activity } from 'lucide-react'

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

async function getAgents(): Promise<{ connected: boolean; agents: Agent[]; sessions: Session[]; agentInfo: string; memory: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000'
  try {
    const res = await fetch(`${baseUrl}/api/agents`, { cache: 'no-store' })
    if (!res.ok) return { connected: false, agents: [], sessions: [], agentInfo: '', memory: '' }
    return await res.json()
  } catch {
    return { connected: false, agents: [], sessions: [], agentInfo: '', memory: '' }
  }
}

export default async function AgentsPage() {
  const { connected, agents, sessions, agentInfo, memory } = await getAgents()

  const hasData = connected && (agents.length > 0 || sessions.length > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Agents</h1>
        <p className="text-sm text-text-secondary">
          Manage and monitor your AI agents
          {connected && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-status-active">
              <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-pulse" />
              OpenClaw connected
            </span>
          )}
        </p>
      </div>

      {!hasData ? (
        <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="p-4 rounded-2xl bg-background-elevated mb-4">
            <Users className="w-8 h-8 text-text-muted" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">No agents configured</h2>
          <p className="text-sm text-text-secondary max-w-md">
            {connected
              ? 'Configure agents in your OpenClaw instance and they will appear here automatically.'
              : 'Connect OpenClaw by setting OPENCLAW_API_URL and OPENCLAW_SETUP_PASSWORD in .env.local'}
          </p>
        </div>
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

import { Wrench, Activity } from 'lucide-react'

interface Session {
  key: string
  age: string
}

async function getWorkshop(): Promise<{ connected: boolean; sessions: Session[]; agentInfo: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000'
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

      {!connected || sessions.length === 0 ? (
        <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="p-4 rounded-2xl bg-background-elevated mb-4">
            <Wrench className="w-8 h-8 text-text-muted" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">No active tasks</h2>
          <p className="text-sm text-text-secondary max-w-md">
            {connected
              ? 'No active sessions running. Tasks will appear here when your agents are processing work.'
              : 'Connect OpenClaw to see active tasks and sessions here.'}
          </p>
        </div>
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

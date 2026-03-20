import { BookOpen, AlertCircle, Info, AlertTriangle, Bug } from 'lucide-react'
import { getAppBaseUrl } from '@/lib/app-url'
import { PageEmptyState } from '@/components/layout/page-empty-state'

interface LogEntry {
  timestamp: string
  level: string
  message: string
  raw: string
}

async function getLogs(): Promise<{ connected: boolean; logs: LogEntry[] }> {
  const baseUrl = getAppBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/api/logs`, { cache: 'no-store' })
    if (!res.ok) return { connected: false, logs: [] }
    return await res.json()
  } catch {
    return { connected: false, logs: [] }
  }
}

function LevelIcon({ level }: { level: string }) {
  switch (level) {
    case 'error':
      return <AlertCircle className="w-3.5 h-3.5 text-status-error" />
    case 'warn':
      return <AlertTriangle className="w-3.5 h-3.5 text-status-progress" />
    case 'debug':
      return <Bug className="w-3.5 h-3.5 text-text-muted" />
    default:
      return <Info className="w-3.5 h-3.5 text-text-secondary" />
  }
}

function LevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    error: 'bg-status-error/10 text-status-error border-status-error/20',
    warn: 'bg-status-progress/10 text-status-progress border-status-progress/20',
    debug: 'bg-white/[0.04] text-text-muted border-white/[0.06]',
    info: 'bg-white/[0.06] text-text-secondary border-white/[0.06]',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border ${colors[level] || colors.info}`}>
      {level}
    </span>
  )
}

export default async function JournalPage() {
  const { connected, logs } = await getLogs()

  if (!connected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Journal</h1>
          <p className="text-sm text-text-secondary">Live activity log from OpenClaw</p>
        </div>
        <PageEmptyState
          icon={<BookOpen className="w-8 h-8 text-text-muted" />}
          title="Connect your workspace"
          description="Finish setup to load your OpenClaw activity stream, errors, and job history."
          primaryAction={{ label: 'Open Connection Settings', href: '/setup?reconfigure=true' }}
          secondaryAction={{ label: 'Go to Dashboard', href: '/' }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Journal</h1>
        <p className="text-sm text-text-secondary">
          Live activity log from OpenClaw
          {connected && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-status-active">
              <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-pulse" />
              Live
            </span>
          )}
        </p>
      </div>

      {logs.length === 0 ? (
        <PageEmptyState
          icon={<BookOpen className="w-8 h-8 text-text-muted" />}
          title="No journal entries"
          description="No recent activity has been recorded yet. Journal entries will appear here as your agents run."
          secondaryAction={{ label: 'Open Workshop', href: '/workshop' }}
        />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">Recent Activity</span>
              <span className="text-xs text-text-muted">{logs.length} entries</span>
            </div>
          </div>
          <div className="divide-y divide-white/[0.04] max-h-[70vh] overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <LevelIcon level={log.level} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <LevelBadge level={log.level} />
                      {log.timestamp && (
                        <span className="text-[10px] text-text-muted font-mono">{log.timestamp}</span>
                      )}
                    </div>
                    <p className="text-sm text-text-primary font-mono break-all">{log.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

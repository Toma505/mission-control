import { Brain } from 'lucide-react'
import { getAppBaseUrl } from '@/lib/app-url'
import { PageEmptyState } from '@/components/layout/page-empty-state'

interface Memory {
  id: string
  content: string
  createdAt: string
}

async function getIntelligence(): Promise<{ connected: boolean; memories: Memory[] }> {
  const baseUrl = getAppBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/api/intelligence`, { cache: 'no-store' })
    if (!res.ok) return { connected: false, memories: [] }
    return await res.json()
  } catch {
    return { connected: false, memories: [] }
  }
}

export default async function IntelligencePage() {
  const { connected, memories } = await getIntelligence()

  if (!connected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Intelligence</h1>
          <p className="text-sm text-text-secondary">Agent memory and knowledge base</p>
        </div>
        <PageEmptyState
          icon={<Brain className="w-8 h-8 text-text-muted" />}
          title="Connect your workspace"
          description="Finish setup to load saved memory, context, and intelligence from your OpenClaw workspace."
          primaryAction={{ label: 'Open Connection Settings', href: '/setup?reconfigure=true' }}
          secondaryAction={{ label: 'Go to Dashboard', href: '/' }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Intelligence</h1>
        <p className="text-sm text-text-secondary">
          Agent memory and knowledge base
          {connected && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-status-active">
              <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-pulse" />
              OpenClaw connected
            </span>
          )}
        </p>
      </div>

      {memories.length === 0 ? (
        <PageEmptyState
          icon={<Brain className="w-8 h-8 text-text-muted" />}
          title="No intelligence reports"
          description="No memory entries have been recorded yet. As your agents learn and save information, it will appear here."
          secondaryAction={{ label: 'Open Journal', href: '/journal' }}
        />
      ) : (
        <>
          <div className="glass rounded-2xl p-5">
            <p className="text-xs text-text-muted mb-1">Memory Entries</p>
            <p className="text-2xl font-bold text-text-primary">{memories.length}</p>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/[0.06]">
              <span className="text-sm font-medium text-text-primary">Agent Memory</span>
            </div>
            <div className="divide-y divide-white/[0.04] max-h-[70vh] overflow-y-auto">
              {memories.map((memory) => (
                <div key={memory.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <p className="text-sm text-text-primary">{memory.content}</p>
                  {memory.createdAt && (
                    <p className="text-xs text-text-muted mt-1">{memory.createdAt}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

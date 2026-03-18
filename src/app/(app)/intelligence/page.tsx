import { Brain } from 'lucide-react'
import { getAppBaseUrl } from '@/lib/app-url'

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
        <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="p-4 rounded-2xl bg-background-elevated mb-4">
            <Brain className="w-8 h-8 text-text-muted" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">No intelligence reports</h2>
          <p className="text-sm text-text-secondary max-w-md">
            {connected
              ? 'No memory entries found. As your agent learns and stores information, it will appear here automatically.'
              : 'Connect OpenClaw to see agent memory and knowledge here.'}
          </p>
        </div>
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

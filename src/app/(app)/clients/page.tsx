import { Briefcase, MessageSquare } from 'lucide-react'
import { getAppBaseUrl } from '@/lib/app-url'

interface Client {
  name: string
  type: string
  status: string
}

async function getClients(): Promise<{ connected: boolean; clients: Client[] }> {
  const baseUrl = getAppBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/api/clients`, { cache: 'no-store' })
    if (!res.ok) return { connected: false, clients: [] }
    return await res.json()
  } catch {
    return { connected: false, clients: [] }
  }
}

export default async function ClientsPage() {
  const { connected, clients } = await getClients()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Clients</h1>
        <p className="text-sm text-text-secondary">
          Connected integrations and channels
          {connected && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-status-active">
              <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-pulse" />
              OpenClaw connected
            </span>
          )}
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="p-4 rounded-2xl bg-background-elevated mb-4">
            <Briefcase className="w-8 h-8 text-text-muted" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">No clients added</h2>
          <p className="text-sm text-text-secondary max-w-md">
            {connected
              ? 'No additional channels configured. Enable channels in your OpenClaw config and they will appear here.'
              : 'Connect OpenClaw to see integrations and channels here.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="glass rounded-2xl p-5">
              <p className="text-xs text-text-muted mb-1">Integrations</p>
              <p className="text-2xl font-bold text-text-primary">{clients.length}</p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-xs text-text-muted mb-1">Active</p>
              <p className="text-2xl font-bold text-status-active">{clients.filter(c => c.status === 'active').length}</p>
            </div>
          </div>

          <div className="space-y-3">
            {clients.map((client) => (
              <div key={client.name} className="glass rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-background-elevated">
                    <MessageSquare className="w-5 h-5 text-text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">{client.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        client.status === 'active'
                          ? 'bg-status-active/10 text-status-active border border-status-active/20'
                          : 'bg-white/[0.06] text-text-muted border border-white/[0.06]'
                      }`}>
                        {client.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5 capitalize">{client.type}</p>
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

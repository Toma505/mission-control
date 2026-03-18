import { Calendar, Activity } from 'lucide-react'
import { getAppBaseUrl } from '@/lib/app-url'

interface Recap {
  period: string
  summary: string
  stats: Record<string, string>
}

async function getRecaps(): Promise<{ connected: boolean; recaps: Recap[] }> {
  const baseUrl = getAppBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/api/weekly-recaps`, { cache: 'no-store' })
    if (!res.ok) return { connected: false, recaps: [] }
    return await res.json()
  } catch {
    return { connected: false, recaps: [] }
  }
}

export default async function WeeklyRecapsPage() {
  const { connected, recaps } = await getRecaps()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Weekly Recaps</h1>
        <p className="text-sm text-text-secondary">
          Activity summaries and system health
          {connected && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-status-active">
              <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-pulse" />
              OpenClaw connected
            </span>
          )}
        </p>
      </div>

      {recaps.length === 0 ? (
        <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="p-4 rounded-2xl bg-background-elevated mb-4">
            <Calendar className="w-8 h-8 text-text-muted" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">No recaps yet</h2>
          <p className="text-sm text-text-secondary max-w-md">
            {connected
              ? 'Recaps are generated from your agent activity logs. As more activity accumulates, summaries will appear here.'
              : 'Connect OpenClaw to see activity recaps here.'}
          </p>
        </div>
      ) : (
        recaps.map((recap) => (
          <div key={recap.period} className="space-y-4">
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-accent-highlight/10">
                  <Activity className="w-5 h-5 text-accent-highlight" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">{recap.period}</h2>
                  <p className="text-sm text-text-secondary">{recap.summary}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(recap.stats).map(([label, value]) => (
                  <div key={label} className="p-3 rounded-xl bg-background-elevated">
                    <p className="text-xs text-text-muted mb-1">{label}</p>
                    <p className="text-sm font-medium text-text-primary">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

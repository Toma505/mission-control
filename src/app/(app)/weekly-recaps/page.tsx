import { Calendar, Activity } from 'lucide-react'
import { getAppBaseUrl } from '@/lib/app-url'
import { PageEmptyState } from '@/components/layout/page-empty-state'

interface Recap {
  period: string
  summary: string
  stats: Record<string, string>
  highlights?: string[]
}

async function getRecaps(): Promise<{ connected: boolean; recaps: Recap[] }> {
  const baseUrl = getAppBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/api/weekly-recaps`, { cache: 'no-store' })
    if (!res.ok) return { connected: false, recaps: [] }
    const data = await res.json()
    // Map API shape to page shape
    const recaps = (data.recaps || []).map((r: any) => ({
      period: r.period || r.week || 'Unknown',
      summary: r.summary || (r.highlights && r.highlights.length > 0 ? r.highlights.join('. ') : 'No summary available'),
      stats: r.stats || {
        'Total Spend': r.totalSpend != null ? `$${r.totalSpend.toFixed(2)}` : '--',
        'Total Tokens': r.totalTokens != null ? `${(r.totalTokens / 1000000).toFixed(1)}M` : '--',
        'Top Model': r.topModel || '--',
        'Top Agent': r.topAgent || '--',
        'Alerts': r.alertsTriggered != null ? String(r.alertsTriggered) : '--',
        'Pipelines': r.pipelinesRun != null ? String(r.pipelinesRun) : '--',
      },
      highlights: r.highlights || [],
    }))
    return { connected: data.connected ?? false, recaps }
  } catch {
    return { connected: false, recaps: [] }
  }
}

export default async function WeeklyRecapsPage() {
  const { connected, recaps } = await getRecaps()

  if (!connected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Weekly Recaps</h1>
          <p className="text-sm text-text-secondary">Activity summaries and system health</p>
        </div>
        <PageEmptyState
          icon={<Calendar className="w-8 h-8 text-text-muted" />}
          title="Connect your workspace"
          description="Finish setup to load activity summaries and weekly recap data from your OpenClaw workspace."
          primaryAction={{ label: 'Open Connection Settings', href: '/setup?reconfigure=true' }}
          secondaryAction={{ label: 'Go to Dashboard', href: '/' }}
        />
      </div>
    )
  }

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
        <PageEmptyState
          icon={<Calendar className="w-8 h-8 text-text-muted" />}
          title="No recaps yet"
          description="Recaps are generated from recent activity. As your workspace builds history, summaries will appear here."
          secondaryAction={{ label: 'Open Journal', href: '/journal' }}
        />
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

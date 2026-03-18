import { Clock, Play, Pause } from 'lucide-react'

interface CronJob {
  name: string
  schedule: string
  description: string
  enabled: boolean
  lastRun: string | null
}

async function getCronJobs(): Promise<{ connected: boolean; jobs: CronJob[] }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000'
  try {
    const res = await fetch(`${baseUrl}/api/cron-jobs`, { cache: 'no-store' })
    if (!res.ok) return { connected: false, jobs: [] }
    return await res.json()
  } catch {
    return { connected: false, jobs: [] }
  }
}

export default async function CronJobsPage() {
  const { connected, jobs } = await getCronJobs()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Cron Jobs</h1>
        <p className="text-sm text-text-secondary">
          Scheduled tasks and automated workflows
          {connected && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-status-active">
              <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-pulse" />
              OpenClaw connected
            </span>
          )}
        </p>
      </div>

      {jobs.length === 0 ? (
        <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="p-4 rounded-2xl bg-background-elevated mb-4">
            <Clock className="w-8 h-8 text-text-muted" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">No cron jobs scheduled</h2>
          <p className="text-sm text-text-secondary max-w-md">
            {connected
              ? 'No scheduled tasks found in your OpenClaw config. Add cron/schedule definitions and they will appear here automatically.'
              : 'Connect OpenClaw to see scheduled tasks here.'}
          </p>
        </div>
      ) : (
        <>
          <div className="glass rounded-2xl p-5">
            <p className="text-xs text-text-muted mb-1">Scheduled Tasks</p>
            <p className="text-2xl font-bold text-text-primary">{jobs.length}</p>
            <p className="text-xs text-text-muted mt-1">{jobs.filter(j => j.enabled).length} active</p>
          </div>

          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.name} className="glass rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-background-elevated">
                    {job.enabled ? (
                      <Play className="w-4 h-4 text-status-active" />
                    ) : (
                      <Pause className="w-4 h-4 text-text-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">{job.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        job.enabled
                          ? 'bg-status-active/10 text-status-active border border-status-active/20'
                          : 'bg-white/[0.06] text-text-muted border border-white/[0.06]'
                      }`}>
                        {job.enabled ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    {job.schedule && (
                      <p className="text-xs text-text-muted font-mono mt-0.5">{job.schedule}</p>
                    )}
                    {job.description && (
                      <p className="text-xs text-text-secondary mt-1">{job.description}</p>
                    )}
                    {job.lastRun && (
                      <p className="text-xs text-text-muted mt-1">Last run: {job.lastRun}</p>
                    )}
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

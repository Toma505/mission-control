import { Clapperboard, Camera, Film, Mic, Package, Mail, CheckCircle2, XCircle, Circle, Loader2, DollarSign, Activity, Hash, TrendingUp } from 'lucide-react'

const BUDGET_CAP = 20

const PIPELINE_STEPS = [
  { key: 'scout', label: 'Scout', icon: Camera },
  { key: 'editor', label: 'Editor', icon: Film },
  { key: 'narrator', label: 'Narrator', icon: Mic },
  { key: 'assembly', label: 'Assembly', icon: Package },
  { key: 'outreach', label: 'Outreach', icon: Mail },
] as const

interface JobData {
  id: string
  address: string
  costs: {
    scout?: number
    editor?: number
    narrator?: number
    veo?: number
    voiceover?: number
    outreach?: number
    total?: number
  }
  status: {
    step?: string
    status?: string
    startedAt?: string
    completedSteps?: string[]
  }
}

interface OperationsData {
  jobs: JobData[]
  summary: {
    totalJobs: number
    completed: number
    totalSpent: number
    avgCost: number
  }
}

function getStepState(job: JobData, stepKey: string): 'completed' | 'active' | 'failed' | 'pending' {
  const completed = (job.status.completedSteps || []).map(s => s.toLowerCase())
  if (completed.includes(stepKey)) return 'completed'

  const currentStep = (job.status.step || '').toLowerCase()
  if (currentStep === stepKey) {
    if (job.status.status === 'failed' || job.status.status === 'error') return 'failed'
    return 'active'
  }

  return 'pending'
}

function StepIndicator({ state }: { state: 'completed' | 'active' | 'failed' | 'pending' }) {
  switch (state) {
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
    case 'active':
      return <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-red-400" />
    case 'pending':
      return <Circle className="w-3 h-3 text-text-muted/40" />
  }
}

function stepBgClass(state: 'completed' | 'active' | 'failed' | 'pending') {
  switch (state) {
    case 'completed': return 'bg-emerald-400/10 border-emerald-400/20'
    case 'active': return 'bg-blue-400/10 border-blue-400/20 animate-pulse'
    case 'failed': return 'bg-red-400/10 border-red-400/20'
    case 'pending': return 'bg-white/[0.03] border-white/[0.06]'
  }
}

function stepTextClass(state: 'completed' | 'active' | 'failed' | 'pending') {
  switch (state) {
    case 'completed': return 'text-emerald-400'
    case 'active': return 'text-blue-400'
    case 'failed': return 'text-red-400'
    case 'pending': return 'text-text-muted'
  }
}

function statusDot(status?: string) {
  switch (status) {
    case 'completed':
    case 'done':
      return 'bg-emerald-400'
    case 'running':
    case 'in_progress':
    case 'active':
      return 'bg-blue-400 animate-pulse'
    case 'failed':
    case 'error':
      return 'bg-red-400'
    default:
      return 'bg-text-muted'
  }
}

function statusLabel(status?: string) {
  switch (status) {
    case 'completed':
    case 'done':
      return 'Completed'
    case 'running':
    case 'in_progress':
    case 'active':
      return 'Running'
    case 'failed':
    case 'error':
      return 'Failed'
    case 'queued':
      return 'Queued'
    default:
      return status || 'Unknown'
  }
}

function formatCost(n?: number) {
  if (n == null || n === 0) return null
  return `$${n.toFixed(2)}`
}

async function getOperationsData(): Promise<OperationsData> {
  // Import the GET handler directly to avoid self-call deadlock
  // (server component calling its own API route during SSR)
  try {
    const { GET } = await import('@/app/api/operations/route')
    const res = await GET()
    return await res.json()
  } catch {
    return {
      jobs: [],
      summary: { totalJobs: 0, completed: 0, totalSpent: 0, avgCost: 0 },
    }
  }
}

export default async function OperationsPage() {
  const { jobs, summary } = await getOperationsData()

  const inProgress = summary.totalJobs - summary.completed

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Operations</h1>
        <p className="text-sm text-text-secondary">
          Pipeline jobs, cost tracking, and production status
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-[6px] h-[6px] rounded-full bg-accent-primary" />
            <span className="text-[10px] font-medium text-text-muted/80 uppercase tracking-[0.1em]">Total Jobs</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{summary.totalJobs}</p>
          <p className="text-[11px] text-text-secondary mt-0.5">All time</p>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-[6px] h-[6px] rounded-full bg-emerald-400" />
            <span className="text-[10px] font-medium text-text-muted/80 uppercase tracking-[0.1em]">Completed</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{summary.completed}</p>
          <p className="text-[11px] text-text-secondary mt-0.5">Ready to deliver</p>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-[6px] h-[6px] rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[10px] font-medium text-text-muted/80 uppercase tracking-[0.1em]">In Progress</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{inProgress}</p>
          <p className="text-[11px] text-text-secondary mt-0.5">Currently running</p>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-[6px] h-[6px] rounded-full bg-violet-400" />
            <span className="text-[10px] font-medium text-text-muted/80 uppercase tracking-[0.1em]">Total Spent</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">${summary.totalSpent.toFixed(2)}</p>
          <p className="text-[11px] text-text-secondary mt-0.5">
            Avg ${summary.avgCost.toFixed(2)}/job
          </p>
        </div>
      </div>

      {/* Jobs list */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Pipeline Jobs</h2>

        {jobs.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <Clapperboard className="w-8 h-8 text-text-muted mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">No pipeline jobs yet</h3>
            <p className="text-sm text-text-secondary max-w-md mx-auto">
              Start a video project through OpenClaw to see it here.
            </p>
          </div>
        ) : (
          jobs.map((job) => {
            const totalCost = job.costs.total ?? 0
            const budgetPct = Math.min((totalCost / BUDGET_CAP) * 100, 100)
            const budgetColor =
              budgetPct >= 90 ? 'bg-red-400' :
              budgetPct >= 70 ? 'bg-amber-400' :
              'bg-emerald-400'

            return (
              <div key={job.id} className="glass rounded-2xl p-5 space-y-4">
                {/* Job header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary truncate">{job.address}</h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      {job.status.startedAt ? new Date(job.status.startedAt).toLocaleDateString() : ''} · {job.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.04] border border-white/[0.06] shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot(job.status.status)}`} />
                    <span className="text-text-secondary">{statusLabel(job.status.status)}</span>
                  </div>
                </div>

                {/* Pipeline visualization */}
                <div className="flex items-center gap-1">
                  {PIPELINE_STEPS.map((step, i) => {
                    const state = getStepState(job, step.key)
                    const Icon = step.icon
                    return (
                      <div key={step.key} className="flex items-center gap-1 flex-1 min-w-0">
                        <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium flex-1 min-w-0 ${stepBgClass(state)}`}>
                          <StepIndicator state={state} />
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${stepTextClass(state)}`} />
                          <span className={`truncate ${stepTextClass(state)}`}>{step.label}</span>
                        </div>
                        {i < PIPELINE_STEPS.length - 1 && (
                          <span className="text-text-muted/20 shrink-0 text-sm">›</span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Cost breakdown */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {[
                    { label: 'Scout', value: job.costs.scout },
                    { label: 'Editor', value: job.costs.editor },
                    { label: 'Veo', value: job.costs.veo },
                    { label: 'Narrator', value: job.costs.narrator },
                    { label: 'Voiceover', value: job.costs.voiceover },
                    { label: 'Outreach', value: job.costs.outreach },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-2 rounded-lg bg-background-elevated text-center">
                      <p className="text-[10px] text-text-muted">{label}</p>
                      <p className="text-xs font-semibold text-text-primary mt-0.5">
                        {formatCost(value) || '--'}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Budget bar */}
                <div className="pt-2 border-t border-white/[0.04]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-text-muted">Budget</span>
                    <span className="text-[11px] text-text-secondary font-medium">
                      ${totalCost.toFixed(2)} / ${BUDGET_CAP.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${budgetColor}`}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                  {budgetPct >= 90 && (
                    <p className="text-[10px] text-red-400 mt-1">Approaching $20 budget cap</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

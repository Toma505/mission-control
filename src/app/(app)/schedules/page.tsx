'use client'

import { useEffect, useState } from 'react'
import cronstrue from 'cronstrue'
import {
  AlertTriangle,
  Clock,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  Save,
  Terminal,
  Trash2,
} from 'lucide-react'

import { apiFetch } from '@/lib/api-client'

type ScheduleRun = {
  id: string
  taskId: string
  taskName: string
  targetInstanceId: string
  targetInstanceName: string
  status: 'success' | 'error'
  startedAt: string
  finishedAt: string
  durationMs: number
  outputSummary: string
}

type ScheduledTask = {
  id: string
  name: string
  cronExpression: string
  humanReadable: string
  targetInstanceId: string
  command: string
  prompt: string
  enabled: boolean
  createdAt: string
  updatedAt: string
  lastRunAt?: string | null
  lastStatus?: 'success' | 'error' | null
  lastDurationMs?: number | null
  lastOutputSummary?: string | null
  nextRunAt?: string | null
  runs: ScheduleRun[]
}

type ScheduleInstanceOption = {
  id: string
  name: string
  url: string
  enabled: boolean
  source: 'instances' | 'connection'
}

type SchedulesPayload = {
  tasks: ScheduledTask[]
  instances: ScheduleInstanceOption[]
}

type TaskDraft = {
  id: string | null
  name: string
  cronExpression: string
  targetInstanceId: string
  command: string
  prompt: string
  enabled: boolean
}

const EMPTY_DRAFT: TaskDraft = {
  id: null,
  name: '',
  cronExpression: '0 8 * * *',
  targetInstanceId: '',
  command: 'openclaw.prompt.run',
  prompt: '',
  enabled: true,
}

function formatDuration(durationMs: number | null | undefined) {
  if (!durationMs || durationMs <= 0) return 'n/a'
  if (durationMs < 1000) return `${durationMs}ms`
  return `${(durationMs / 1000).toFixed(1)}s`
}

function countdownLabel(nextRunAt: string | null | undefined, now: number) {
  if (!nextRunAt) return 'No upcoming run'
  const diffMs = new Date(nextRunAt).getTime() - now
  if (diffMs <= 0) return 'Due now'

  const totalSeconds = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function cronPreview(expression: string) {
  try {
    return cronstrue.toString(expression, { throwExceptionOnParseError: true })
  } catch {
    return 'Invalid cron expression'
  }
}

function taskDraftFromTask(task: ScheduledTask): TaskDraft {
  return {
    id: task.id,
    name: task.name,
    cronExpression: task.cronExpression,
    targetInstanceId: task.targetInstanceId,
    command: task.command,
    prompt: task.prompt,
    enabled: task.enabled,
  }
}

export default function ScheduledTasksPage() {
  const [payload, setPayload] = useState<SchedulesPayload | null>(null)
  const [draft, setDraft] = useState<TaskDraft>(EMPTY_DRAFT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  async function loadSchedules() {
    try {
      const response = await fetch('/api/schedules', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Could not load scheduled tasks.')
      }
      const nextPayload = (await response.json()) as SchedulesPayload
      setPayload(nextPayload)
      setError(null)
      setDraft((current) => ({
        ...current,
        targetInstanceId: current.targetInstanceId || nextPayload.instances[0]?.id || '',
      }))
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load scheduled tasks.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSchedules()
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  async function submitTask() {
    setSaving(true)
    setError(null)
    try {
      const action = draft.id ? 'update' : 'create'
      const response = await apiFetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...draft,
          id: draft.id || undefined,
        }),
      })

      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not save task.')

      setPayload(body.payload)
      setDraft({
        ...EMPTY_DRAFT,
        targetInstanceId: body.payload.instances[0]?.id || '',
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save task.')
    } finally {
      setSaving(false)
    }
  }

  async function mutateTask(action: 'toggle' | 'delete' | 'runNow', id: string, extra: Record<string, unknown> = {}) {
    if (action === 'runNow') setRunningTaskId(id)
    try {
      const response = await apiFetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id, ...extra }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Request failed.')
      setPayload(body.payload)
      setError(null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Request failed.')
    } finally {
      if (action === 'runNow') setRunningTaskId(null)
    }
  }

  const instances = payload?.instances || []
  const tasks = payload?.tasks || []
  const preview = cronPreview(draft.cronExpression)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Scheduled Tasks</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Create recurring prompts or commands, target an instance, and track every execution in one place.
          </p>
        </div>

        <div className="glass rounded-2xl px-4 py-3 text-sm text-text-secondary">
          <div className="flex items-center gap-2 text-text-primary">
            <Clock className="h-4 w-4 text-[var(--accent-primary,#3b82f6)]" />
            {tasks.filter((task) => task.enabled).length} active tasks
          </div>
          <p className="mt-1 text-xs text-text-muted">{instances.length} available target instances</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                {draft.id ? 'Edit scheduled task' : 'Create scheduled task'}
              </h2>
              <p className="mt-1 text-xs text-text-muted">Cron expression, target instance, and prompt payload.</p>
            </div>
            {draft.id ? (
              <button
                onClick={() => setDraft({ ...EMPTY_DRAFT, targetInstanceId: instances[0]?.id || '' })}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-secondary transition hover:bg-white/[0.08]"
              >
                New task
              </button>
            ) : null}
          </div>

          <div className="mt-5 space-y-4">
            <label className="block text-xs text-text-muted">
              Task name
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-text-primary outline-none transition focus:border-[var(--accent-primary,#3b82f6)]/40"
                placeholder="Morning ops briefing"
              />
            </label>

            <label className="block text-xs text-text-muted">
              Cron expression
              <input
                value={draft.cronExpression}
                onChange={(event) => setDraft((current) => ({ ...current, cronExpression: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 font-mono text-sm text-text-primary outline-none transition focus:border-[var(--accent-primary,#3b82f6)]/40"
                placeholder="0 8 * * *"
              />
              <span className={`mt-2 block text-[11px] ${preview === 'Invalid cron expression' ? 'text-amber-300' : 'text-text-secondary'}`}>
                {preview}
              </span>
            </label>

            <label className="block text-xs text-text-muted">
              Target instance
              <select
                value={draft.targetInstanceId}
                onChange={(event) => setDraft((current) => ({ ...current, targetInstanceId: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-text-primary outline-none transition focus:border-[var(--accent-primary,#3b82f6)]/40"
              >
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.name} {instance.enabled ? '' : '(disabled)'}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-text-muted">
              Command
              <input
                value={draft.command}
                onChange={(event) => setDraft((current) => ({ ...current, command: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 font-mono text-sm text-text-primary outline-none transition focus:border-[var(--accent-primary,#3b82f6)]/40"
                placeholder="openclaw.prompt.run"
              />
            </label>

            <label className="block text-xs text-text-muted">
              Prompt / argument
              <textarea
                value={draft.prompt}
                onChange={(event) => setDraft((current) => ({ ...current, prompt: event.target.value }))}
                className="mt-1 min-h-28 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-text-primary outline-none transition focus:border-[var(--accent-primary,#3b82f6)]/40"
                placeholder="Review open Discord threads and draft follow-up replies."
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
                className="h-4 w-4 rounded border-white/[0.12] bg-transparent"
              />
              Start enabled after save
            </label>

            <button
              onClick={() => void submitTask()}
              disabled={saving}
              className="inline-flex items-center rounded-xl border border-[var(--accent-primary,#3b82f6)]/30 bg-[var(--accent-primary,#3b82f6)]/12 px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-[var(--accent-primary,#3b82f6)]/18 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : draft.id ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {draft.id ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="glass rounded-2xl p-6 text-sm text-text-muted">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Loading scheduled tasks...
            </div>
          ) : tasks.length === 0 ? (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
                <div>
                  <p className="font-medium text-text-primary">No tasks yet</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Create your first recurring task to automate prompts or commands against a target instance.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="glass rounded-2xl p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-text-primary">{task.name}</h2>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${task.enabled ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-white/[0.08] bg-white/[0.04] text-text-muted'}`}>
                        {task.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      {task.lastStatus === 'error' ? (
                        <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-1 text-[11px] font-medium text-red-200">
                          Last run failed
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-mono text-xs text-text-muted">{task.cronExpression}</p>
                    <p className="mt-1 text-sm text-text-secondary">{task.humanReadable}</p>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <InfoPill label="Target" value={instances.find((instance) => instance.id === task.targetInstanceId)?.name || task.targetInstanceId} />
                      <InfoPill label="Next run" value={countdownLabel(task.nextRunAt, now)} />
                      <InfoPill label="Last duration" value={formatDuration(task.lastDurationMs)} />
                    </div>
                    <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Command payload</p>
                      <p className="mt-2 font-mono text-sm text-text-primary">{task.command}</p>
                      {task.prompt ? <p className="mt-2 text-sm text-text-secondary">{task.prompt}</p> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:max-w-[300px] lg:justify-end">
                    <button
                      onClick={() => setDraft(taskDraftFromTask(task))}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary transition hover:bg-white/[0.08]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void mutateTask('toggle', task.id, { enabled: !task.enabled })}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary transition hover:bg-white/[0.08]"
                    >
                      {task.enabled ? <PauseCircle className="mr-1 inline h-3.5 w-3.5" /> : <PlayCircle className="mr-1 inline h-3.5 w-3.5" />}
                      {task.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => void mutateTask('runNow', task.id)}
                      disabled={runningTaskId === task.id}
                      className="rounded-xl border border-[var(--accent-primary,#3b82f6)]/30 bg-[var(--accent-primary,#3b82f6)]/12 px-3 py-2 text-xs font-medium text-text-primary transition hover:bg-[var(--accent-primary,#3b82f6)]/18 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {runningTaskId === task.id ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : <Terminal className="mr-1 inline h-3.5 w-3.5" />}
                      Run now
                    </button>
                    <button
                      onClick={() => void mutateTask('delete', task.id)}
                      className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-100 transition hover:bg-red-500/16"
                    >
                      <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.16em] text-text-muted">Recent runs</p>
                    <p className="text-xs text-text-muted">Last 10 executions</p>
                  </div>

                  {task.runs.length === 0 ? (
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-text-muted">
                      No runs recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {task.runs.map((run) => (
                        <div key={run.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${run.status === 'success' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>
                                  {run.status}
                                </span>
                                <span className="text-xs text-text-muted">{new Date(run.startedAt).toLocaleString()}</span>
                              </div>
                              <p className="mt-2 text-sm text-text-secondary">{run.outputSummary}</p>
                            </div>
                            <div className="text-xs text-text-muted">
                              {run.targetInstanceName} | {formatDuration(run.durationMs)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <p className="mt-1 text-sm text-text-primary">{value}</p>
    </div>
  )
}

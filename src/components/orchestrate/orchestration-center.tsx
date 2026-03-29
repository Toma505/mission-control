'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Loader2,
  Play,
  Server,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react'

import { apiFetch } from '@/lib/api-client'
import type {
  OrchestrationExecutionMode,
  OrchestrationPayload,
  OrchestrationRecord,
  OrchestrationTarget,
  OrchestrationTemplate,
} from '@/lib/orchestrations'

const EMPTY_PAYLOAD: OrchestrationPayload = {
  templates: [],
  instances: [],
  orchestrations: [],
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Pending'
  return new Date(value).toLocaleString()
}

function formatDuration(durationMs?: number | null) {
  if (!durationMs || durationMs < 1000) return durationMs ? `${durationMs} ms` : 'Pending'
  const seconds = Math.round(durationMs / 100) / 10
  return `${seconds}s`
}

function statusClasses(status: OrchestrationRecord['status'] | OrchestrationTarget['status']) {
  switch (status) {
    case 'completed':
    case 'success':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
    case 'partial':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-100'
    case 'failed':
    case 'error':
      return 'border-red-500/20 bg-red-500/10 text-red-100'
    case 'running':
      return 'border-sky-500/20 bg-sky-500/10 text-sky-100'
    default:
      return 'border-white/10 bg-white/[0.06] text-text-secondary'
  }
}

function modeLabel(mode: OrchestrationExecutionMode) {
  return mode === 'custom' ? 'Per-instance tasks' : 'Shared task'
}

function templateAccent(templateId: OrchestrationTemplate['id']) {
  switch (templateId) {
    case 'parallel_code_review':
      return 'from-amber-500/25 to-red-500/10'
    case 'consensus_voting':
      return 'from-violet-500/25 to-sky-500/10'
    default:
      return 'from-emerald-500/25 to-cyan-500/10'
  }
}

export function OrchestrationCenter() {
  const [payload, setPayload] = useState<OrchestrationPayload>(EMPTY_PAYLOAD)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState<OrchestrationTemplate['id']>('fan_out_research')
  const [executionMode, setExecutionMode] = useState<OrchestrationExecutionMode>('same')
  const [sharedTask, setSharedTask] = useState('')
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([])
  const [customTasks, setCustomTasks] = useState<Record<string, string>>({})

  const selectedTemplate = useMemo(
    () => payload.templates.find((template) => template.id === templateId) || payload.templates[0] || null,
    [payload.templates, templateId],
  )

  const focusedOrchestration = useMemo(() => {
    if (focusedId) {
      const match = payload.orchestrations.find((orchestration) => orchestration.id === focusedId)
      if (match) return match
    }
    return payload.orchestrations[0] || null
  }, [focusedId, payload.orchestrations])

  const hasRunning = payload.orchestrations.some((orchestration) => orchestration.status === 'running')

  async function load() {
    try {
      const response = await fetch('/api/orchestrate', { cache: 'no-store' })
      const data = (await response.json()) as OrchestrationPayload & { error?: string }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load orchestration data.')
      }

      setPayload({
        templates: Array.isArray(data.templates) ? data.templates : [],
        instances: Array.isArray(data.instances) ? data.instances : [],
        orchestrations: Array.isArray(data.orchestrations) ? data.orchestrations : [],
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load orchestration data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (payload.templates.length === 0) return

    const template = payload.templates.find((entry) => entry.id === templateId) || payload.templates[0]
    setTemplateId(template.id)
    setExecutionMode((current) => current || template.executionMode)
    setName((current) => current || template.name)
    setSharedTask((current) => current || template.defaultTask)
  }, [payload.templates, templateId])

  useEffect(() => {
    if (payload.instances.length === 0 || selectedInstanceIds.length > 0) return

    const defaults = payload.instances.filter((instance) => instance.enabled).slice(0, 3).map((instance) => instance.id)
    setSelectedInstanceIds(defaults)
    setCustomTasks((current) => {
      const next = { ...current }
      for (const instanceId of defaults) {
        next[instanceId] = next[instanceId] || sharedTask || selectedTemplate?.defaultTask || ''
      }
      return next
    })
  }, [payload.instances, selectedInstanceIds.length, selectedTemplate?.defaultTask, sharedTask])

  useEffect(() => {
    if (payload.orchestrations.length === 0) {
      setFocusedId(null)
      return
    }

    if (focusedId && payload.orchestrations.some((orchestration) => orchestration.id === focusedId)) {
      return
    }

    const preferred =
      payload.orchestrations.find((orchestration) => orchestration.status === 'running') ||
      payload.orchestrations[0]
    setFocusedId(preferred?.id || null)
  }, [focusedId, payload.orchestrations])

  useEffect(() => {
    if (!hasRunning) return

    const interval = setInterval(() => {
      void load()
    }, 2000)

    return () => clearInterval(interval)
  }, [hasRunning])

  function toggleInstance(instanceId: string) {
    setSelectedInstanceIds((current) => {
      if (current.includes(instanceId)) {
        return current.filter((id) => id !== instanceId)
      }
      return [...current, instanceId]
    })

    setCustomTasks((current) => ({
      ...current,
      [instanceId]: current[instanceId] || sharedTask || selectedTemplate?.defaultTask || '',
    }))
  }

  async function launchOrchestration() {
    setSubmitting(true)
    setError(null)

    try {
      const response = await apiFetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          name,
          templateId,
          executionMode,
          sharedTask,
          assignments: selectedInstanceIds.map((instanceId) => ({
            instanceId,
            task: executionMode === 'same' ? sharedTask : customTasks[instanceId] || '',
          })),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to launch orchestration.')
      }

      setPayload(data.payload || EMPTY_PAYLOAD)
      if (data.orchestration?.id) {
        setFocusedId(data.orchestration.id)
      }
    } catch (launchError) {
      setError(launchError instanceof Error ? launchError.message : 'Failed to launch orchestration.')
    } finally {
      setSubmitting(false)
    }
  }

  async function removeOrchestration(orchestrationId: string) {
    setDeletingId(orchestrationId)
    setError(null)

    try {
      const response = await apiFetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', orchestrationId }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete orchestration.')
      }
      setPayload(data.payload || EMPTY_PAYLOAD)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete orchestration.')
    } finally {
      setDeletingId(null)
    }
  }

  const summary = {
    running: payload.orchestrations.filter((orchestration) => orchestration.status === 'running').length,
    completed: payload.orchestrations.filter((orchestration) => orchestration.status === 'completed').length,
    partial: payload.orchestrations.filter((orchestration) => orchestration.status === 'partial').length,
    failed: payload.orchestrations.filter((orchestration) => orchestration.status === 'failed').length,
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">
            <GitBranch className="h-3.5 w-3.5 text-accent-primary" />
            Parallel orchestration
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Orchestrate</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Fan work out across multiple instances, let slow or failed targets fall behind without blocking the rest,
            and compare the final outputs in one place.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: 'Running', value: summary.running },
            { label: 'Completed', value: summary.completed },
            { label: 'Partial', value: summary.partial },
            { label: 'Failed', value: summary.failed },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.04] px-4 py-3 text-center"
            >
              <div className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{item.label}</div>
              <div className="mt-1 text-2xl font-semibold text-text-primary">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-text-primary">Launch a run</h2>
            <p className="text-xs text-text-muted">
              Pick a pattern, choose the instances, and decide whether they all receive the same prompt or their own sub-task.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-text-muted">
                Orchestration name
              </label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent-primary/50"
                placeholder="Research consensus pass"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-text-muted">
                Template
              </label>
              <div className="space-y-2">
                {payload.templates.map((template) => {
                  const active = template.id === templateId
                  return (
                    <button
                      key={template.id}
                      onClick={() => {
                        setTemplateId(template.id)
                        setExecutionMode(template.executionMode)
                        setName(template.name)
                        setSharedTask(template.defaultTask)
                      }}
                      className={`w-full rounded-2xl border bg-gradient-to-br px-4 py-3 text-left transition ${
                        active
                          ? `border-white/15 ${templateAccent(template.id)}`
                          : 'border-[var(--glass-border)] from-white/[0.04] to-white/[0.02] hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-text-primary">{template.name}</div>
                        <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-text-muted">
                          {template.executionMode === 'same' ? 'Shared task' : 'Custom'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-text-secondary">{template.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-text-muted">
                Execution mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['same', 'custom'] as OrchestrationExecutionMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setExecutionMode(mode)}
                    className={`rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                      executionMode === mode
                        ? 'bg-accent-primary text-white'
                        : 'border border-[var(--glass-border)] bg-white/[0.03] text-text-secondary hover:bg-white/[0.08]'
                    }`}
                  >
                    {modeLabel(mode)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {executionMode === 'same' ? 'Shared task' : 'Starter task'}
              </label>
              <textarea
                value={sharedTask}
                onChange={(event) => setSharedTask(event.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent-primary/50"
                placeholder={selectedTemplate?.defaultTask || 'Tell each instance what to do.'}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-text-muted">
                Target instances
              </label>
              <div className="space-y-3 rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-3">
                {payload.instances.map((instance) => {
                  const selected = selectedInstanceIds.includes(instance.id)
                  return (
                    <div
                      key={instance.id}
                      className={`rounded-2xl border px-3 py-3 transition ${
                        selected
                          ? 'border-accent-primary/40 bg-accent-primary/10'
                          : 'border-[var(--glass-border)] bg-white/[0.02]'
                      }`}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleInstance(instance.id)}
                          className="mt-1 h-4 w-4 rounded border-[var(--glass-border)] bg-transparent"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary">{instance.name}</span>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-text-muted">
                              {instance.source}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-text-muted">{instance.url}</p>
                        </div>
                      </label>

                      {selected && executionMode === 'custom' ? (
                        <textarea
                          value={customTasks[instance.id] || ''}
                          onChange={(event) =>
                            setCustomTasks((current) => ({
                              ...current,
                              [instance.id]: event.target.value,
                            }))
                          }
                          rows={3}
                          className="mt-3 w-full rounded-2xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent-primary/50"
                          placeholder={selectedTemplate?.defaultTask || 'Sub-task for this instance'}
                        />
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3 text-xs text-text-secondary">
              If one instance errors out, the rest keep running. The final summary marks the run as partial instead of throwing the whole orchestration away.
            </div>

            <button
              onClick={() => void launchOrchestration()}
              disabled={submitting || selectedInstanceIds.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-primary px-4 py-3 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Launch orchestration
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Active view</h2>
                <p className="text-xs text-text-muted">
                  Inspect the latest run or switch to any history item below.
                </p>
              </div>
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-text-muted" /> : null}
            </div>

            {!focusedOrchestration ? (
              <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-white/[0.02] px-6 py-12 text-center">
                <Sparkles className="mx-auto h-10 w-10 text-text-muted/35" />
                <p className="mt-4 text-sm font-medium text-text-primary">No orchestration runs yet</p>
                <p className="mt-1 text-sm text-text-muted">
                  Launch one from the builder to see the target grid, aggregate summary, and output history here.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold text-text-primary">{focusedOrchestration.name}</h3>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${statusClasses(
                          focusedOrchestration.status,
                        )}`}
                      >
                        {focusedOrchestration.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">
                      {focusedOrchestration.templateName} · {modeLabel(focusedOrchestration.executionMode)}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      Started {formatDateTime(focusedOrchestration.startedAt || focusedOrchestration.createdAt)}
                      {focusedOrchestration.finishedAt ? ` · Finished ${formatDateTime(focusedOrchestration.finishedAt)}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2 text-xs text-text-secondary">
                      Successes: <span className="font-semibold text-text-primary">{focusedOrchestration.successCount}</span>
                    </div>
                    <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2 text-xs text-text-secondary">
                      Failures: <span className="font-semibold text-text-primary">{focusedOrchestration.failureCount}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-text-muted">
                    Aggregate results
                  </div>
                  <p className="text-sm leading-6 text-text-secondary">
                    {focusedOrchestration.aggregateSummary ||
                      (focusedOrchestration.status === 'running'
                        ? 'Targets are still executing. This summary will fill in as soon as the run completes.'
                        : 'No aggregate summary available yet.')}
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {focusedOrchestration.targets.map((target) => (
                    <article
                      key={target.id}
                      className="rounded-3xl border border-[var(--glass-border)] bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-accent-primary" />
                            <h4 className="text-sm font-semibold text-text-primary">{target.instanceName}</h4>
                          </div>
                          <p className="mt-1 text-xs text-text-muted">{target.source}</p>
                        </div>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${statusClasses(
                            target.status,
                          )}`}
                        >
                          {target.status}
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Task</div>
                          <p className="mt-1 text-sm text-text-secondary">{target.task}</p>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-2xl border border-[var(--glass-border)] bg-black/20 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Started</div>
                            <div className="mt-1 text-xs text-text-secondary">{formatDateTime(target.startedAt)}</div>
                          </div>
                          <div className="rounded-2xl border border-[var(--glass-border)] bg-black/20 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Duration</div>
                            <div className="mt-1 text-xs text-text-secondary">{formatDuration(target.durationMs)}</div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[var(--glass-border)] bg-black/20 px-3 py-3">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                            {target.status === 'error' ? 'Error' : 'Output summary'}
                          </div>
                          <p className="mt-1 text-sm text-text-secondary">
                            {target.error || target.outputSummary || 'Waiting for this target to finish.'}
                          </p>
                        </div>

                        {target.rawOutput ? (
                          <details className="rounded-2xl border border-[var(--glass-border)] bg-black/20 px-3 py-3">
                            <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.14em] text-text-muted">
                              Full output
                            </summary>
                            <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-5 text-text-secondary">
                              {target.rawOutput}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">History</h2>
                <p className="text-xs text-text-muted">Recent orchestration runs and saved results.</p>
              </div>
            </div>

            {payload.orchestrations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-white/[0.02] px-4 py-8 text-center text-sm text-text-muted">
                No history yet.
              </div>
            ) : (
              <div className="space-y-3">
                {payload.orchestrations.map((orchestration) => (
                  <button
                    key={orchestration.id}
                    onClick={() => setFocusedId(orchestration.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      focusedOrchestration?.id === orchestration.id
                        ? 'border-accent-primary/40 bg-accent-primary/10'
                        : 'border-[var(--glass-border)] bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-text-primary">{orchestration.name}</div>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${statusClasses(
                              orchestration.status,
                            )}`}
                          >
                            {orchestration.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-text-muted">
                          {orchestration.templateName} · {orchestration.targets.length} target
                          {orchestration.targets.length === 1 ? '' : 's'} · {formatDateTime(orchestration.createdAt)}
                        </p>
                        <p className="mt-2 text-sm text-text-secondary">
                          {orchestration.aggregateSummary || 'Waiting for results.'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-100">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {orchestration.successCount}
                        </div>
                        <div className="inline-flex items-center gap-1 rounded-xl border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-100">
                          <XCircle className="h-3.5 w-3.5" />
                          {orchestration.failureCount}
                        </div>
                        {orchestration.status !== 'running' ? (
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              void removeOrchestration(orchestration.id)
                            }}
                            disabled={deletingId === orchestration.id}
                            className="inline-flex items-center gap-1 rounded-xl border border-[var(--glass-border)] bg-white/[0.03] px-2.5 py-1 text-xs text-text-secondary transition hover:bg-white/[0.08]"
                          >
                            {deletingId === orchestration.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Remove
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-1 rounded-xl border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-100">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Running
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

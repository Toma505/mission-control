'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  ChevronRight,
  Clock3,
  FileCode2,
  Loader2,
  PlayCircle,
  ScanSearch,
  Sparkles,
  TerminalSquare,
  Wrench,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { ReplayFileChange, ReplaySession, ReplayToolCall } from '@/lib/replay-store'

type ReplaySessionSummary = Omit<ReplaySession, 'steps'> & {
  stepCount: number
}

type ReplayListResponse = {
  sessions: ReplaySessionSummary[]
}

type ReplayDetailResponse = {
  session: ReplaySession
}

type DiffRow = {
  type: 'context' | 'add' | 'remove'
  text: string
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

function formatClock(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(date))
}

function statusTone(status: ReplayToolCall['status']) {
  if (status === 'error') return 'text-red-300 border-red-500/30 bg-red-500/10'
  if (status === 'warning') return 'text-amber-200 border-amber-400/30 bg-amber-400/10'
  return 'text-emerald-200 border-emerald-400/30 bg-emerald-400/10'
}

function buildDiffRows(before: string, after: string): DiffRow[] {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  const matrix = Array.from({ length: beforeLines.length + 1 }, () =>
    Array<number>(afterLines.length + 1).fill(0),
  )

  for (let i = beforeLines.length - 1; i >= 0; i -= 1) {
    for (let j = afterLines.length - 1; j >= 0; j -= 1) {
      if (beforeLines[i] === afterLines[j]) {
        matrix[i][j] = matrix[i + 1][j + 1] + 1
      } else {
        matrix[i][j] = Math.max(matrix[i + 1][j], matrix[i][j + 1])
      }
    }
  }

  const rows: DiffRow[] = []
  let i = 0
  let j = 0

  while (i < beforeLines.length && j < afterLines.length) {
    if (beforeLines[i] === afterLines[j]) {
      rows.push({ type: 'context', text: beforeLines[i] })
      i += 1
      j += 1
      continue
    }

    if (matrix[i + 1][j] >= matrix[i][j + 1]) {
      rows.push({ type: 'remove', text: beforeLines[i] })
      i += 1
    } else {
      rows.push({ type: 'add', text: afterLines[j] })
      j += 1
    }
  }

  while (i < beforeLines.length) {
    rows.push({ type: 'remove', text: beforeLines[i] })
    i += 1
  }

  while (j < afterLines.length) {
    rows.push({ type: 'add', text: afterLines[j] })
    j += 1
  }

  return rows
}

function DetailPanel({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string
  subtitle: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden group"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-text-primary">{title}</p>
          <p className="text-xs text-text-muted">{subtitle}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-text-muted transition-transform group-open:rotate-90" />
      </summary>
      <div className="border-t border-white/[0.06] px-4 py-4">{children}</div>
    </details>
  )
}

function FileDiff({ change }: { change: ReplayFileChange }) {
  const rows = useMemo(() => buildDiffRows(change.before, change.after), [change.after, change.before])

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/20 overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="text-sm font-medium text-text-primary">{change.path}</p>
        <p className="text-xs text-text-muted mt-1">{change.summary}</p>
      </div>
      <div className="max-h-72 overflow-auto font-mono text-[11px]">
        {rows.map((row, index) => (
          <div
            key={`${row.type}-${index}-${row.text}`}
            className={cn(
              'grid grid-cols-[34px_1fr] gap-0 border-b border-white/[0.04]',
              row.type === 'add' && 'bg-emerald-500/10',
              row.type === 'remove' && 'bg-red-500/10',
              row.type === 'context' && 'bg-transparent',
            )}
          >
            <div
              className={cn(
                'px-2 py-1 text-center text-[10px] text-text-muted border-r border-white/[0.05]',
                row.type === 'add' && 'text-emerald-200',
                row.type === 'remove' && 'text-red-200',
              )}
            >
              {row.type === 'add' ? '+' : row.type === 'remove' ? '-' : ' '}
            </div>
            <pre className="overflow-x-auto px-3 py-1 whitespace-pre-wrap text-text-primary/90">{row.text || ' '}</pre>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AgentReplay() {
  const [sessions, setSessions] = useState<ReplaySessionSummary[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [sessionDetails, setSessionDetails] = useState<Record<string, ReplaySession>>({})
  const [selectedStepIndex, setSelectedStepIndex] = useState(0)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingSession, setLoadingSession] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadSessions() {
      setLoadingList(true)
      setError('')
      try {
        const response = await apiFetch('/api/replay')
        if (!response.ok) {
          throw new Error('Replay sessions could not be loaded.')
        }
        const data = await response.json() as ReplayListResponse
        if (cancelled) return
        setSessions(data.sessions || [])
        if ((data.sessions || []).length > 0) {
          setSelectedSessionId((current) => current || data.sessions[0].id)
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : 'Replay sessions could not be loaded.'
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setLoadingList(false)
        }
      }
    }

    void loadSessions()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedSessionId || sessionDetails[selectedSessionId]) return

    let cancelled = false

    async function loadSession() {
      setLoadingSession(true)
      setError('')
      try {
        const response = await apiFetch(`/api/replay?session=${encodeURIComponent(selectedSessionId)}`)
        if (!response.ok) {
          throw new Error('Replay details could not be loaded.')
        }
        const data = await response.json() as ReplayDetailResponse
        if (!cancelled) {
          setSessionDetails((current) => ({ ...current, [selectedSessionId]: data.session }))
          setSelectedStepIndex(0)
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : 'Replay details could not be loaded.'
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setLoadingSession(false)
        }
      }
    }

    void loadSession()
    return () => {
      cancelled = true
    }
  }, [selectedSessionId, sessionDetails])

  const activeSession = selectedSessionId ? sessionDetails[selectedSessionId] : null
  const activeStep = activeSession?.steps[selectedStepIndex] ?? null

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="glass rounded-2xl overflow-hidden">
        <div className="border-b border-[var(--glass-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-accent-primary" />
            <div>
              <h2 className="text-base font-semibold text-text-primary">Completed Sessions</h2>
              <p className="text-xs text-text-muted">Pick a finished agent run to inspect every decision.</p>
            </div>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-3 py-3">
          {loadingList ? (
            <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-4 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-4 text-sm text-text-muted">
              No replay sessions have been captured yet.
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    setSelectedSessionId(session.id)
                    setSelectedStepIndex(0)
                  }}
                  className={cn(
                    'w-full rounded-2xl border px-4 py-4 text-left transition-all',
                    selectedSessionId === session.id
                      ? 'border-accent-primary/40 bg-accent-primary/10'
                      : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{session.agentId}</p>
                      <p className="mt-1 text-xs text-text-secondary">{session.taskDescription}</p>
                    </div>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-200">
                      {session.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
                    <span className="rounded-full bg-white/[0.05] px-2 py-1">{session.instanceId}</span>
                    <span className="rounded-full bg-white/[0.05] px-2 py-1">{session.model}</span>
                    <span className="rounded-full bg-white/[0.05] px-2 py-1">{session.stepCount} steps</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-text-muted">
                    <span>{formatDate(session.completedAt)}</span>
                    <span>{formatDuration(session.durationMs)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <section className="glass rounded-2xl overflow-hidden">
        <div className="border-b border-[var(--glass-border)] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Agent Replay</h1>
              <p className="mt-1 text-sm text-text-muted">
                Replay completed sessions step by step, inspect tool calls, and review file changes like a timeline.
              </p>
            </div>
            {activeSession ? (
              <div className="grid grid-cols-2 gap-2 text-xs text-text-muted sm:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted/70">Agent</p>
                  <p className="mt-1 text-text-primary">{activeSession.agentId}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted/70">Instance</p>
                  <p className="mt-1 text-text-primary">{activeSession.instanceId}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted/70">Duration</p>
                  <p className="mt-1 text-text-primary">{formatDuration(activeSession.durationMs)}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted/70">Finished</p>
                  <p className="mt-1 text-text-primary">{formatDate(activeSession.completedAt)}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="px-6 py-6">
          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          {!selectedSessionId && !loadingList ? (
            <div className="rounded-3xl border border-dashed border-white/[0.12] bg-white/[0.02] px-6 py-16 text-center">
              <PlayCircle className="mx-auto h-10 w-10 text-text-muted/50" />
              <p className="mt-4 text-base font-medium text-text-primary">Pick a session to begin replay</p>
              <p className="mt-2 text-sm text-text-muted">We’ll load the full step timeline, prompt details, and file diffs here.</p>
            </div>
          ) : loadingSession && !activeSession ? (
            <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] px-6 py-12 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-text-muted" />
              <p className="mt-3 text-sm text-text-muted">Loading replay timeline...</p>
            </div>
          ) : activeSession && activeStep ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] px-5 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-accent-primary">
                      <Sparkles className="h-4 w-4" />
                      Replay timeline
                    </div>
                    <h2 className="mt-3 text-xl font-semibold text-text-primary">{activeSession.taskDescription}</h2>
                    <p className="mt-2 text-sm text-text-secondary">
                      Session key <span className="font-medium text-text-primary">{activeSession.sessionKey}</span> ran on {activeSession.model}.
                    </p>
                  </div>
                  <div className="min-w-[220px] rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted/70">Scrubber</p>
                    <div className="mt-3">
                      <input
                        type="range"
                        min={0}
                        max={Math.max(activeSession.steps.length - 1, 0)}
                        step={1}
                        value={selectedStepIndex}
                        onChange={(event) => setSelectedStepIndex(Number(event.target.value))}
                        className="w-full accent-[var(--accent-primary,#3b82f6)]"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                      <span>Step {selectedStepIndex + 1}</span>
                      <span>{activeSession.steps.length} total</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {activeSession.steps.map((step, index) => (
                    <button
                      key={step.id}
                      onClick={() => setSelectedStepIndex(index)}
                      className={cn(
                        'rounded-2xl border px-4 py-3 text-left transition-all',
                        index === selectedStepIndex
                          ? 'border-accent-primary/40 bg-accent-primary/10'
                          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-text-primary">Step {index + 1}</span>
                        <span className="text-[10px] text-text-muted">{formatClock(step.timestamp)}</span>
                      </div>
                      <p className="mt-2 text-sm text-text-primary">{step.title}</p>
                      <p className="mt-1 text-xs text-text-muted line-clamp-2">{step.action}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
                <div className="space-y-5">
                  <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] px-5 py-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-text-muted/70">
                      <Clock3 className="h-4 w-4" />
                      Decision point {selectedStepIndex + 1}
                    </div>
                    <h3 className="mt-3 text-xl font-semibold text-text-primary">{activeStep.title}</h3>
                    <p className="mt-1 text-sm text-text-muted">{formatDate(activeStep.timestamp)}</p>

                    <div className="mt-5 grid gap-4 lg:grid-cols-3">
                      <div className="rounded-2xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-4">
                        <div className="flex items-center gap-2 text-sky-300">
                          <ScanSearch className="h-4 w-4" />
                          <p className="text-xs font-semibold uppercase tracking-[0.16em]">Saw</p>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-text-primary/90">{activeStep.input}</p>
                      </div>
                      <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.06] px-4 py-4">
                        <div className="flex items-center gap-2 text-violet-300">
                          <Bot className="h-4 w-4" />
                          <p className="text-xs font-semibold uppercase tracking-[0.16em]">Chose</p>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-text-primary/90">{activeStep.action}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-4">
                        <div className="flex items-center gap-2 text-emerald-300">
                          <Sparkles className="h-4 w-4" />
                          <p className="text-xs font-semibold uppercase tracking-[0.16em]">Result</p>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-text-primary/90">{activeStep.result}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <DetailPanel title="Full prompt" subtitle="Exactly what the agent received" defaultOpen>
                      <pre className="whitespace-pre-wrap text-sm leading-6 text-text-primary/90">{activeStep.prompt}</pre>
                    </DetailPanel>

                    <DetailPanel title="Full response" subtitle="The complete model output for this step">
                      <pre className="whitespace-pre-wrap text-sm leading-6 text-text-primary/90">{activeStep.response}</pre>
                    </DetailPanel>

                    <DetailPanel
                      title="Tool calls"
                      subtitle={`${activeStep.toolCalls.length} call${activeStep.toolCalls.length === 1 ? '' : 's'} issued at this step`}
                    >
                      {activeStep.toolCalls.length === 0 ? (
                        <p className="text-sm text-text-muted">No external tools were used for this step.</p>
                      ) : (
                        <div className="space-y-3">
                          {activeStep.toolCalls.map((call) => (
                            <div key={`${call.name}-${call.input}`} className="rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-2 text-text-primary">
                                  <Wrench className="h-4 w-4 text-accent-primary" />
                                  <span className="text-sm font-medium">{call.name}</span>
                                </div>
                                <span className={cn('rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em]', statusTone(call.status))}>
                                  {call.status}
                                </span>
                                <span className="text-xs text-text-muted">{call.durationMs} ms</span>
                              </div>
                              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                <div className="rounded-xl bg-white/[0.03] px-3 py-3">
                                  <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted/70">Input</p>
                                  <pre className="mt-2 whitespace-pre-wrap text-xs leading-5 text-text-primary/90">{call.input}</pre>
                                </div>
                                <div className="rounded-xl bg-white/[0.03] px-3 py-3">
                                  <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted/70">Output summary</p>
                                  <p className="mt-2 text-xs leading-5 text-text-primary/90">{call.outputSummary}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </DetailPanel>

                    <DetailPanel
                      title="File changes"
                      subtitle={`${activeStep.fileChanges.length} file change${activeStep.fileChanges.length === 1 ? '' : 's'} produced`}
                    >
                      {activeStep.fileChanges.length === 0 ? (
                        <p className="text-sm text-text-muted">This step did not modify any files.</p>
                      ) : (
                        <div className="space-y-4">
                          {activeStep.fileChanges.map((change) => (
                            <FileDiff key={`${change.path}-${change.summary}`} change={change} />
                          ))}
                        </div>
                      )}
                    </DetailPanel>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] px-5 py-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-text-muted/70">
                      <TerminalSquare className="h-4 w-4" />
                      Step timeline
                    </div>
                    <div className="mt-4 space-y-3">
                      {activeSession.steps.map((step, index) => (
                        <button
                          key={step.id}
                          onClick={() => setSelectedStepIndex(index)}
                          className={cn(
                            'relative w-full rounded-2xl border px-4 py-4 text-left transition-all',
                            index === selectedStepIndex
                              ? 'border-accent-primary/40 bg-accent-primary/10'
                              : 'border-white/[0.06] bg-black/20 hover:bg-white/[0.04]',
                          )}
                        >
                          {index < activeSession.steps.length - 1 ? (
                            <span className="absolute left-[21px] top-[52px] h-8 w-px bg-white/[0.08]" />
                          ) : null}
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              'mt-0.5 h-5 w-5 rounded-full border text-[10px] font-semibold flex items-center justify-center',
                              index === selectedStepIndex
                                ? 'border-accent-primary/40 bg-accent-primary text-white'
                                : 'border-white/[0.12] bg-white/[0.04] text-text-muted',
                            )}>
                              {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-text-primary">{step.title}</p>
                                <span className="text-[10px] text-text-muted">{formatClock(step.timestamp)}</span>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-text-secondary">{step.result}</p>
                              <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-muted">
                                <span className="rounded-full bg-white/[0.05] px-2 py-1">{step.toolCalls.length} tools</span>
                                <span className="rounded-full bg-white/[0.05] px-2 py-1">{step.fileChanges.length} file changes</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] px-5 py-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-text-muted/70">
                      <FileCode2 className="h-4 w-4" />
                      Quick notes
                    </div>
                    <ul className="mt-4 space-y-3 text-sm text-text-secondary">
                      <li className="rounded-2xl bg-black/20 px-4 py-3">
                        Scrub the slider above to move through the replay like a video timeline.
                      </li>
                      <li className="rounded-2xl bg-black/20 px-4 py-3">
                        Open the detail panels to inspect the exact prompt, full response, tool calls, and diffs.
                      </li>
                      <li className="rounded-2xl bg-black/20 px-4 py-3">
                        File change diffs highlight additions in green and removals in red for each decision point.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] px-6 py-12 text-center">
              <p className="text-sm text-text-muted">Replay details are unavailable for this session.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import {
  Plus,
  Play,
  Loader2,
  Workflow as WorkflowIcon,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Copy,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { type Workflow, NODE_TYPE_COLORS } from '@/lib/workflow-types'

/** Execution result — supports both frontend and backend field naming */
interface ExecRecord {
  id: string
  workflowId: string
  workflowName: string
  status: string
  startedAt: string
  finishedAt?: string
  duration?: number
  durationMs?: number
  [key: string]: unknown
}

export function WorkflowList({ onEdit }: { onEdit: (id?: string) => void }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [history, setHistory] = useState<ExecRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState<string | null>(null)

  useEffect(() => {
    loadWorkflows()
    loadHistory()
  }, [])

  async function loadWorkflows() {
    setLoading(true)
    try {
      const res = await fetch('/api/workflows')
      if (res.ok) {
        const data = await res.json()
        setWorkflows(data.workflows || [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function loadHistory() {
    try {
      const res = await fetch('/api/workflows/history?limit=10')
      if (res.ok) {
        const data = await res.json()
        setHistory(data.executions || data.entries || [])
      }
    } catch { /* ignore */ }
  }

  async function toggleWorkflow(id: string) {
    try {
      await apiFetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', workflowId: id }),
      })
      loadWorkflows()
    } catch { /* ignore */ }
  }

  async function deleteWorkflow(id: string) {
    try {
      await apiFetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', workflowId: id }),
      })
      loadWorkflows()
    } catch { /* ignore */ }
  }

  async function duplicateWorkflow(id: string) {
    try {
      await apiFetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', workflowId: id }),
      })
      loadWorkflows()
    } catch { /* ignore */ }
  }

  async function runWorkflow(id: string) {
    setExecuting(id)
    try {
      await apiFetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute', workflowId: id }),
      })
      loadHistory()
    } catch { /* ignore */ }
    finally { setExecuting(null) }
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h ago`
    return `${Math.floor(diffH / 24)}d ago`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Workflows</h1>
          <p className="text-sm text-text-muted mt-0.5">Build and automate agent pipelines</p>
        </div>
        <button
          onClick={() => onEdit()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-primary text-white text-sm font-medium hover:bg-accent-primary/80 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Workflow
        </button>
      </div>

      {/* Workflow cards */}
      {workflows.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent-primary/10 flex items-center justify-center mx-auto mb-4">
            <WorkflowIcon className="w-8 h-8 text-accent-primary" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">No workflows yet</h2>
          <p className="text-sm text-text-muted max-w-sm mx-auto mb-4">
            Create your first workflow to automate agent tasks — chain commands, set conditions, and build pipelines visually.
          </p>
          <button
            onClick={() => onEdit()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-primary text-white text-sm font-medium hover:bg-accent-primary/80 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Workflow
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workflows.map(wf => (
            <div
              key={wf.id}
              className="glass rounded-2xl p-4 hover:border-[var(--accent-primary)]/30 transition-all cursor-pointer group"
              onClick={() => onEdit(wf.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                    <WorkflowIcon className="w-4 h-4 text-accent-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{wf.name}</h3>
                    <p className="text-[10px] text-text-muted">{wf.nodes.length} nodes, {wf.edges.length} connections</p>
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); toggleWorkflow(wf.id) }}
                  className="text-text-muted hover:text-text-primary transition-colors"
                  title={wf.enabled ? 'Disable' : 'Enable'}
                >
                  {wf.enabled
                    ? <ToggleRight className="w-5 h-5 text-emerald-400" />
                    : <ToggleLeft className="w-5 h-5" />
                  }
                </button>
              </div>

              {wf.description && (
                <p className="text-xs text-text-secondary mb-3 line-clamp-2">{wf.description}</p>
              )}

              {/* Node type indicators */}
              <div className="flex gap-1 mb-3">
                {Array.from(new Set(wf.nodes.map(n => n.type))).map(type => (
                  <span
                    key={type}
                    className="px-2 py-0.5 rounded-full text-[9px] font-medium"
                    style={{
                      background: `${NODE_TYPE_COLORS[type]}15`,
                      color: NODE_TYPE_COLORS[type],
                    }}
                  >
                    {type}
                  </span>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--glass-border)]">
                <span className="text-[10px] text-text-muted">
                  Updated {formatTime(wf.updatedAt)}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); runWorkflow(wf.id) }}
                    disabled={executing === wf.id}
                    className="p-1.5 rounded-lg hover:bg-emerald-400/10 text-text-muted hover:text-emerald-400 transition-colors"
                    title="Run"
                  >
                    {executing === wf.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Play className="w-3.5 h-3.5" />
                    }
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); duplicateWorkflow(wf.id) }}
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] text-text-muted hover:text-text-primary transition-colors"
                    title="Duplicate"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteWorkflow(wf.id) }}
                    className="p-1.5 rounded-lg hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent executions */}
      {history.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Recent Executions</h2>
          </div>
          <div className="space-y-2">
            {history.map(exec => (
              <div
                key={exec.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]"
              >
                <div className="flex items-center gap-3">
                  {exec.status === 'success'
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : (exec.status === 'failure' || exec.status === 'failed')
                    ? <XCircle className="w-4 h-4 text-red-400" />
                    : exec.status === 'running'
                    ? <Loader2 className="w-4 h-4 text-accent-primary animate-spin" />
                    : <AlertCircle className="w-4 h-4 text-amber-400" />
                  }
                  <div>
                    <p className="text-xs font-medium text-text-primary">{exec.workflowName}</p>
                    <p className="text-[10px] text-text-muted">{formatTime(exec.startedAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    exec.status === 'success' ? 'bg-emerald-400/10 text-emerald-400'
                    : (exec.status === 'failure' || exec.status === 'failed') ? 'bg-red-400/10 text-red-400'
                    : 'bg-amber-400/10 text-amber-400'
                  }`}>
                    {exec.status}
                  </span>
                  {(exec.duration != null || exec.durationMs != null) && (
                    <p className="text-[9px] text-text-muted mt-0.5">{exec.durationMs ?? exec.duration}ms</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

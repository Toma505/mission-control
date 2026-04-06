'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarRange,
  Download,
  Eye,
  FileBarChart,
  FileDown,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import type {
  ReportBuilderInput,
  ReportFilters,
  ReportFormat,
  ReportGranularity,
  ReportKind,
  ReportMetadata,
  ReportPreview,
} from '@/lib/reports-store'

interface ReportsPayload {
  reports: ReportMetadata[]
  filters: ReportFilters
  defaults: ReportBuilderInput
}

const KIND_OPTIONS: Array<{ value: ReportKind; label: string; description: string }> = [
  {
    value: 'agent_session_summary',
    label: 'Agent Session Summary',
    description: 'Summarize completed sessions, decisions, tool calls, and outcomes.',
  },
  {
    value: 'cost_report',
    label: 'Cost Report',
    description: 'Export cost totals, token usage, and per-agent or per-instance breakdowns.',
  },
  {
    value: 'instance_health',
    label: 'Instance Health',
    description: 'Capture instance status, uptime, and health checks in one snapshot.',
  },
]

const GRANULARITY_OPTIONS: Array<{ value: ReportGranularity; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

function summaryValue(key: string, value: string | number) {
  if (typeof value !== 'number') return value
  if (key.toLowerCase().includes('cost')) return `$${value.toFixed(2)}`
  if (Number.isInteger(value)) return value.toLocaleString()
  return value.toFixed(1)
}

function serializeForm(input: ReportBuilderInput) {
  return JSON.stringify(input)
}

function formatReportType(kind: ReportKind) {
  return kind.replace(/_/g, ' ')
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

function allowedFormats(kind: ReportKind): ReportFormat[] {
  if (kind === 'cost_report') return ['pdf', 'csv', 'json']
  return ['pdf', 'json']
}

function SectionTable({ preview }: { preview: ReportPreview }) {
  return (
    <div className="space-y-4">
      {preview.sections.map((section) => {
        const headers = Array.from(
          section.rows.reduce((set, row) => {
            Object.keys(row).forEach((key) => set.add(key))
            return set
          }, new Set<string>()),
        )

        return (
          <div key={section.id} className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{section.title}</h3>
                <p className="text-xs text-text-muted">{section.rows.length} row{section.rows.length === 1 ? '' : 's'}</p>
              </div>
            </div>

            {section.rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--glass-border)] bg-white/[0.02] px-4 py-6 text-center text-sm text-text-muted">
                Nothing matched this section for the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2 text-left text-xs">
                  <thead>
                    <tr>
                      {headers.map((header) => (
                        <th key={header} className="px-3 py-1 font-medium uppercase tracking-[0.12em] text-text-muted/70">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.slice(0, 12).map((row, index) => (
                      <tr key={`${section.id}-${index}`} className="rounded-xl bg-white/[0.04]">
                        {headers.map((header) => (
                          <td key={header} className="px-3 py-2 text-text-secondary">
                            {row[header] === null || row[header] === undefined || row[header] === ''
                              ? '—'
                              : String(row[header])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function ReportCenter() {
  const [reports, setReports] = useState<ReportMetadata[]>([])
  const [filters, setFilters] = useState<ReportFilters>({ instances: [], agents: [] })
  const [form, setForm] = useState<ReportBuilderInput>({
    name: 'Mission Control Report',
    kind: 'cost_report',
    format: 'pdf',
    granularity: 'weekly',
    dateRange: { start: '', end: '' },
    instanceIds: [],
    agentIds: [],
  })
  const [preview, setPreview] = useState<ReportPreview | null>(null)
  const [previewKey, setPreviewKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentFormats = useMemo(() => allowedFormats(form.kind), [form.kind])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch('/api/reports', { cache: 'no-store' })
      const data = (await response.json()) as ReportsPayload
      setReports(Array.isArray(data.reports) ? data.reports : [])
      setFilters(data.filters || { instances: [], agents: [] })
      if (data.defaults) {
        setForm((current) => ({
          ...data.defaults,
          instanceIds: current.instanceIds.length > 0 ? current.instanceIds : data.defaults.instanceIds,
          agentIds: current.agentIds.length > 0 ? current.agentIds : data.defaults.agentIds,
        }))
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  async function downloadReport(reportId: string) {
    setError(null)
    try {
      const response = await apiFetch(`/api/reports?download=${encodeURIComponent(reportId)}`)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Failed to download report',
        )
      }

      const disposition = response.headers.get('content-disposition') || ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      const filename = match?.[1] || `report-${reportId}`
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(downloadUrl)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Failed to download report')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!currentFormats.includes(form.format)) {
      setForm((current) => ({ ...current, format: currentFormats[0] }))
    }
  }, [currentFormats, form.format])

  function updateForm<K extends keyof ReportBuilderInput>(key: K, value: ReportBuilderInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggleSelected(key: 'instanceIds' | 'agentIds', value: string) {
    setForm((current) => {
      const selected = current[key]
      return {
        ...current,
        [key]: selected.includes(value)
          ? selected.filter((item) => item !== value)
          : [...selected, value],
      }
    })
  }

  async function runPreview() {
    setPreviewing(true)
    setError(null)
    try {
      const response = await apiFetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, action: 'preview' }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to preview report')
      }
      setPreview(data.preview)
      setPreviewKey(serializeForm(form))
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Failed to preview report')
    } finally {
      setPreviewing(false)
    }
  }

  async function exportReport() {
    setExporting(true)
    setError(null)
    try {
      const response = await apiFetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, action: 'generate' }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate report')
      }
      setPreview(data.preview)
      setPreviewKey(serializeForm(form))
      await load()
      await downloadReport(data.metadata.id)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Failed to export report')
    } finally {
      setExporting(false)
    }
  }

  async function removeReport(id: string) {
    setDeletingId(id)
    setError(null)
    try {
      const response = await apiFetch('/api/reports', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete report')
      }
      await load()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete report')
    } finally {
      setDeletingId(null)
    }
  }

  const previewReady = preview && previewKey === serializeForm(form)

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">
            <FileBarChart className="h-3.5 w-3.5 text-accent-primary" />
            Report Builder
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Reports</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Build agent session summaries, cost exports, and instance health snapshots with a preview-first workflow.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.04] px-4 py-3 text-xs text-text-muted">
          Saved reports: <span className="font-semibold text-text-primary">{reports.length}</span>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Build a report</h2>
                <p className="text-xs text-text-muted">Choose scope, preview the output, then export.</p>
              </div>
              <button
                onClick={() => void load()}
                className="rounded-xl border border-[var(--glass-border)] bg-white/[0.03] p-2 text-text-muted transition hover:bg-white/[0.08] hover:text-text-primary"
                title="Refresh reports"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-text-muted">Report name</label>
                <input
                  value={form.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                  className="w-full rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent-primary/50"
                  placeholder="Mission Control Weekly Report"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-text-muted">Report type</label>
                <div className="space-y-2">
                  {KIND_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => updateForm('kind', option.value)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        form.kind === option.value
                          ? 'border-accent-primary/40 bg-accent-primary/10'
                          : 'border-[var(--glass-border)] bg-white/[0.03] hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="text-sm font-medium text-text-primary">{option.label}</div>
                      <div className="mt-1 text-xs text-text-muted">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-text-muted">Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    {currentFormats.map((format) => (
                      <button
                        key={format}
                        onClick={() => updateForm('format', format)}
                        className={`rounded-xl px-3 py-2 text-xs font-medium uppercase transition ${
                          form.format === format
                            ? 'bg-accent-primary text-white'
                            : 'border border-[var(--glass-border)] bg-white/[0.03] text-text-secondary hover:bg-white/[0.08]'
                        }`}
                      >
                        {format}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-text-muted">Grouping</label>
                  <div className="grid grid-cols-3 gap-2">
                    {GRANULARITY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => updateForm('granularity', option.value)}
                        className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                          form.granularity === option.value
                            ? 'bg-white/[0.16] text-text-primary'
                            : 'border border-[var(--glass-border)] bg-white/[0.03] text-text-secondary hover:bg-white/[0.08]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-text-muted">Start date</label>
                  <input
                    type="date"
                    value={form.dateRange.start.slice(0, 10)}
                    onChange={(event) =>
                      updateForm('dateRange', {
                        ...form.dateRange,
                        start: `${event.target.value}T00:00:00.000Z`,
                      })
                    }
                    className="w-full rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent-primary/50"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-text-muted">End date</label>
                  <input
                    type="date"
                    value={form.dateRange.end.slice(0, 10)}
                    onChange={(event) =>
                      updateForm('dateRange', {
                        ...form.dateRange,
                        end: `${event.target.value}T23:59:59.999Z`,
                      })
                    }
                    className="w-full rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent-primary/50"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-text-muted">Instances</label>
                  <div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-3">
                    {filters.instances.map((instance) => (
                      <label key={instance.id} className="flex items-center gap-2 text-sm text-text-secondary">
                        <input
                          type="checkbox"
                          checked={form.instanceIds.includes(instance.id)}
                          onChange={() => toggleSelected('instanceIds', instance.id)}
                          className="h-4 w-4 rounded border-[var(--glass-border)] bg-transparent"
                        />
                        <span>{instance.label}</span>
                      </label>
                    ))}
                    {filters.instances.length === 0 ? (
                      <p className="text-xs text-text-muted">No instance data available yet.</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-text-muted">Agents</label>
                  <div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-3">
                    {filters.agents.map((agent) => (
                      <label key={agent.id} className="flex items-center gap-2 text-sm text-text-secondary">
                        <input
                          type="checkbox"
                          checked={form.agentIds.includes(agent.id)}
                          onChange={() => toggleSelected('agentIds', agent.id)}
                          className="h-4 w-4 rounded border-[var(--glass-border)] bg-transparent"
                        />
                        <span>{agent.label}</span>
                      </label>
                    ))}
                    {filters.agents.length === 0 ? (
                      <p className="text-xs text-text-muted">No agent data available yet.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => void runPreview()}
                disabled={previewing || loading}
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-white/[0.1] disabled:opacity-50"
              >
                {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Preview
              </button>
              <button
                onClick={() => void exportReport()}
                disabled={!previewReady || exporting}
                className="inline-flex items-center gap-2 rounded-2xl bg-accent-primary px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                Export {form.format.toUpperCase()}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-accent-primary" />
              <h2 className="text-sm font-semibold text-text-primary">Saved reports</h2>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading report history…
              </div>
            ) : reports.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-white/[0.02] px-4 py-6 text-sm text-text-muted">
                No saved reports yet. Preview a report and export it to start building history.
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div key={report.id} className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">{report.name}</h3>
                        <p className="mt-1 text-xs text-text-muted">
                          {formatReportType(report.kind)} · {report.format.toUpperCase()} · {formatDateTime(report.createdAt)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-text-secondary">
                          <span className="rounded-full border border-[var(--glass-border)] bg-white/[0.04] px-2 py-1">
                            {report.instanceIds.length || 'All'} instance scope
                          </span>
                          <span className="rounded-full border border-[var(--glass-border)] bg-white/[0.04] px-2 py-1">
                            {report.agentIds.length || 'All'} agent scope
                          </span>
                          <span className="rounded-full border border-[var(--glass-border)] bg-white/[0.04] px-2 py-1">
                            {(report.sizeBytes / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => void downloadReport(report.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-white/[0.05] px-3 py-2 text-xs font-medium text-text-primary transition hover:bg-white/[0.1]"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </button>
                        <button
                          onClick={() => void removeReport(report.id)}
                          disabled={deletingId === report.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-xs font-medium text-red-100 transition hover:bg-red-500/[0.14] disabled:opacity-50"
                        >
                          {deletingId === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {Object.entries(report.previewSummary || {}).slice(0, 4).map(([key, value]) => (
                        <div key={key} className="rounded-xl border border-[var(--glass-border)] bg-white/[0.03] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/70">{key}</div>
                          <div className="mt-1 text-sm font-medium text-text-primary">
                            {summaryValue(key, typeof value === 'number' ? value : String(value))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Preview</h2>
              <p className="text-xs text-text-muted">Generate a preview before exporting the final file.</p>
            </div>
            <div className="rounded-full border border-[var(--glass-border)] bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-text-muted">
              {formatReportType(form.kind)}
            </div>
          </div>

          {!preview ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-[var(--glass-border)] bg-white/[0.02] px-6 text-center">
              <div>
                <Eye className="mx-auto h-10 w-10 text-text-muted/30" />
                <p className="mt-4 text-sm font-medium text-text-primary">No preview yet</p>
                <p className="mt-1 text-sm text-text-muted">
                  Choose a report type and filters, then preview it here before export.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Object.entries(preview.summary).map(([key, value]) => (
                  <div key={key} className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/70">{key}</div>
                    <div className="mt-2 text-xl font-semibold text-text-primary">
                      {summaryValue(key, value)}
                    </div>
                  </div>
                ))}
              </div>

              <SectionTable preview={preview} />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}


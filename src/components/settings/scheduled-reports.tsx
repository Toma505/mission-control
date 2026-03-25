'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  FileText,
  Plus,
  Trash2,
  Play,
  ToggleLeft,
  ToggleRight,
  X,
  Clock,
  Calendar,
  Download,
  CheckCircle,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'

interface ScheduledReport {
  id: string
  name: string
  frequency: 'daily' | 'weekly' | 'monthly'
  format: 'csv' | 'json'
  includes: string[]
  enabled: boolean
  lastRun?: string
  nextRun?: string
  createdAt: string
}

interface ReportSection {
  id: string
  label: string
}

export function ScheduledReports() {
  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [sections, setSections] = useState<ReportSection[]>([])
  const [showForm, setShowForm] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [generated, setGenerated] = useState<string | null>(null)

  // Form
  const [formName, setFormName] = useState('')
  const [formFreq, setFormFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [formFormat, setFormFormat] = useState<'csv' | 'json'>('csv')
  const [formIncludes, setFormIncludes] = useState<string[]>([])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduled-reports')
      const data = await res.json()
      setReports(data.reports || [])
      setSections(data.sections || [])
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  async function create() {
    if (!formName || formIncludes.length === 0) return
    await apiFetch('/api/scheduled-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formName,
        frequency: formFreq,
        format: formFormat,
        includes: formIncludes,
      }),
    })
    setFormName('')
    setFormIncludes([])
    setShowForm(false)
    load()
  }

  async function toggle(id: string) {
    await apiFetch('/api/scheduled-reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  async function remove(id: string) {
    await apiFetch('/api/scheduled-reports', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  async function generate(id: string) {
    setGenerating(id)
    setGenerated(null)
    try {
      const res = await apiFetch('/api/scheduled-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', id }),
      })
      const data = await res.json()
      if (data.ok) {
        setGenerated(data.filename)
        load()
      }
    } catch {}
    setGenerating(null)
  }

  function toggleInclude(sectionId: string) {
    setFormIncludes(prev =>
      prev.includes(sectionId) ? prev.filter(s => s !== sectionId) : [...prev, sectionId]
    )
  }

  const freqColors = {
    daily: 'bg-emerald-400/10 text-emerald-400',
    weekly: 'bg-sky-400/10 text-sky-400',
    monthly: 'bg-violet-400/10 text-violet-400',
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          Schedule automatic reports that save to your data directory
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-primary/20 text-accent-primary text-xs font-medium hover:bg-accent-primary/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Report
        </button>
      </div>

      {/* Generated notification */}
      {generated && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <p className="text-xs text-text-primary">Report generated: <span className="font-mono text-emerald-400">{generated}</span></p>
          <button onClick={() => setGenerated(null)} className="ml-auto p-1 rounded hover:bg-white/[0.08]">
            <X className="w-3 h-3 text-text-muted" />
          </button>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="glass rounded-2xl p-5 border border-accent-primary/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">New Scheduled Report</h3>
            <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-white/[0.08]">
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>

          <input
            type="text"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="Report name (e.g., Weekly Cost Summary)"
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none mb-3"
          />

          <div className="flex gap-3 mb-4">
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider mb-1 block">Frequency</label>
              <div className="flex gap-1">
                {(['daily', 'weekly', 'monthly'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFormFreq(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                      formFreq === f
                        ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                        : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider mb-1 block">Format</label>
              <div className="flex gap-1">
                {(['csv', 'json'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFormFormat(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase transition-colors ${
                      formFormat === f
                        ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                        : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-[10px] text-text-muted uppercase tracking-wider mb-2 block">Include sections</label>
            <div className="flex flex-wrap gap-2">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => toggleInclude(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    formIncludes.includes(s.id)
                      ? 'bg-emerald-400/20 text-emerald-400 border border-emerald-400/30'
                      : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08] border border-transparent'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={create}
            disabled={!formName || formIncludes.length === 0}
            className="px-4 py-2 rounded-xl bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/90 disabled:opacity-50"
          >
            Create Report Schedule
          </button>
        </div>
      )}

      {/* Reports List */}
      {reports.length === 0 && !showForm ? (
        <div className="glass rounded-2xl p-12 text-center">
          <FileText className="w-10 h-10 text-text-muted/20 mx-auto mb-3" />
          <p className="text-sm text-text-muted">No scheduled reports</p>
          <p className="text-xs text-text-muted/60 mt-1">
            Set up automatic cost and usage reports in CSV or JSON format
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <div key={r.id} className={`glass rounded-2xl p-4 ${!r.enabled ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-accent-primary/10">
                    <FileText className="w-4 h-4 text-accent-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-text-primary">{r.name}</h4>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${freqColors[r.frequency]}`}>
                        {r.frequency}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/[0.06] text-text-muted uppercase">
                        {r.format}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-text-muted">
                      <span>{r.includes.length} section{r.includes.length !== 1 ? 's' : ''}</span>
                      {r.lastRun && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          Last: {new Date(r.lastRun).toLocaleDateString()}
                        </span>
                      )}
                      {r.nextRun && r.enabled && (
                        <span className="flex items-center gap-0.5">
                          <Calendar className="w-2.5 h-2.5" />
                          Next: {new Date(r.nextRun).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => generate(r.id)}
                    disabled={generating === r.id}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 disabled:opacity-50"
                    title="Generate now"
                  >
                    {generating === r.id ? (
                      <Download className="w-3 h-3 animate-pulse" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    Run Now
                  </button>
                  <button onClick={() => toggle(r.id)} className="p-1.5 rounded-lg hover:bg-white/[0.08]">
                    {r.enabled
                      ? <ToggleRight className="w-4 h-4 text-emerald-400" />
                      : <ToggleLeft className="w-4 h-4 text-text-muted" />}
                  </button>
                  <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg hover:bg-white/[0.08]">
                    <Trash2 className="w-3.5 h-3.5 text-text-muted hover:text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

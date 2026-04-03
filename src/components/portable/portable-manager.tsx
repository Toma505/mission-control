'use client'

import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  FileJson,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react'

import { apiFetch } from '@/lib/api-client'
import type {
  PortableBundle,
  PortableCategory,
  PortableConflict,
  PortableConflictResolution,
  PortableImportPreview,
  PortableImportResult,
} from '@/lib/portable-bundle'

const CATEGORY_LABELS: Record<PortableCategory, string> = {
  settings: 'Settings',
  prompts: 'Prompts',
  templates: 'Templates',
  workflows: 'Workflows',
  schedules: 'Schedules',
  costTags: 'Cost Tags',
  snapshots: 'Snapshots',
  keyVault: 'Key Vault',
  notifications: 'Notifications',
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function totalSelectedItems(
  bundle: PortableBundle | null,
  selectedCategories: PortableCategory[],
) {
  if (!bundle) return 0
  return selectedCategories.reduce(
    (sum, category) => sum + (bundle.manifest.itemCounts[category] || 0),
    0,
  )
}

export function PortableManager() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [bundle, setBundle] = useState<PortableBundle | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<PortableCategory[]>([])
  const [preview, setPreview] = useState<PortableImportPreview | null>(null)
  const [resolutions, setResolutions] = useState<Record<string, PortableConflictResolution>>({})
  const [importResult, setImportResult] = useState<PortableImportResult | null>(null)
  const [exporting, setExporting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const availableCategories = useMemo(() => {
    if (!bundle) return []
    return (Object.keys(bundle.manifest.itemCounts) as PortableCategory[]).filter(
      (category) => bundle.manifest.itemCounts[category] > 0,
    )
  }, [bundle])

  const selectedItemCount = useMemo(
    () => totalSelectedItems(bundle, selectedCategories),
    [bundle, selectedCategories],
  )

  async function handleExport() {
    setExporting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await apiFetch('/api/portable', { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Export failed.' }))
        throw new Error(payload.error || 'Export failed.')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const disposition = response.headers.get('content-disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      link.href = url
      link.download = match?.[1] || `mission-control-${new Date().toISOString().slice(0, 10)}.mcbundle.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setSuccess('Portable bundle exported successfully.')
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Failed to export bundle.')
    } finally {
      setExporting(false)
    }
  }

  function resetImportState(nextBundle: PortableBundle) {
    const categories = (Object.keys(nextBundle.manifest.itemCounts) as PortableCategory[]).filter(
      (category) => nextBundle.manifest.itemCounts[category] > 0,
    )
    setBundle(nextBundle)
    setSelectedCategories(categories)
    setPreview(null)
    setImportResult(null)
    setResolutions({})
    setError(null)
    setSuccess(`Loaded ${categories.length} categories from ${nextBundle.manifest.appVersion || 'bundle'}.`)
  }

  async function handleBundleFile(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as PortableBundle
      if (!parsed || typeof parsed !== 'object' || !parsed.manifest || !parsed.data) {
        throw new Error('This file is not a valid Mission Control bundle.')
      }
      resetImportState(parsed)
    } catch (loadError) {
      setBundle(null)
      setPreview(null)
      setImportResult(null)
      setError(loadError instanceof Error ? loadError.message : 'Failed to read bundle file.')
    }
  }

  async function runPreview() {
    if (!bundle || selectedCategories.length === 0) {
      setError('Choose at least one category to preview.')
      return
    }

    setPreviewing(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await apiFetch('/api/portable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          bundle,
          categories: selectedCategories,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to preview import.')
      }

      const nextPreview = payload as PortableImportPreview
      setPreview(nextPreview)
      setImportResult(null)
      setResolutions((current) => {
        const next = { ...current }
        for (const conflict of nextPreview.conflicts) {
          if (!next[conflict.id]) next[conflict.id] = 'keep'
        }
        return next
      })
      setSuccess(
        nextPreview.conflicts.length > 0
          ? `Preview ready with ${nextPreview.conflicts.length} conflict${nextPreview.conflicts.length === 1 ? '' : 's'}.`
          : 'Preview ready. No conflicts found for the selected categories.',
      )
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Failed to preview import.')
    } finally {
      setPreviewing(false)
    }
  }

  async function applyImport() {
    if (!bundle || selectedCategories.length === 0) {
      setError('Choose at least one category to import.')
      return
    }

    setApplying(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await apiFetch('/api/portable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply',
          bundle,
          categories: selectedCategories,
          resolutions,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to apply import.')
      }

      setImportResult(payload.result as PortableImportResult)
      setSuccess('Portable bundle imported successfully.')
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Failed to apply import.')
    } finally {
      setApplying(false)
    }
  }

  function toggleCategory(category: PortableCategory) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((entry) => entry !== category)
        : [...current, category],
    )
  }

  function setConflictResolution(conflictId: string, resolution: PortableConflictResolution) {
    setResolutions((current) => ({ ...current, [conflictId]: resolution }))
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">
            <Archive className="h-3.5 w-3.5 text-accent-primary" />
            Portable Bundle
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Portable</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Export your local Mission Control setup into one bundle, then preview and selectively import it somewhere else without guessing what will change.
          </p>
        </div>

        <button
          onClick={() => void handleExport()}
          disabled={exporting}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent-primary px-4 py-3 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export .mcbundle.json
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-100">
          {success}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Import bundle</h2>
                <p className="text-xs text-text-muted">Upload a previously exported Mission Control bundle.</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-[var(--glass-border)] bg-white/[0.03] px-3 py-2 text-xs font-medium text-text-primary transition hover:bg-white/[0.08]"
              >
                Choose file
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.mcbundle.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  void handleBundleFile(file)
                }
              }}
            />

            <label
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--glass-border)] bg-white/[0.02] px-6 py-10 text-center transition hover:bg-white/[0.05]"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const file = event.dataTransfer.files?.[0]
                if (file) {
                  void handleBundleFile(file)
                }
              }}
            >
              <Upload className="mb-3 h-8 w-8 text-text-muted" />
              <p className="text-sm font-medium text-text-primary">Drop a .mcbundle.json file here</p>
              <p className="mt-1 text-xs text-text-muted">Or click “Choose file” to browse locally.</p>
            </label>

            {bundle ? (
              <div className="mt-4 rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4">
                <div className="flex items-start gap-3">
                  <FileJson className="mt-0.5 h-4 w-4 text-accent-primary" />
                  <div className="space-y-1 text-sm">
                    <div className="font-medium text-text-primary">
                      Mission Control v{bundle.manifest.appVersion || 'Unknown'}
                    </div>
                    <div className="text-xs text-text-muted">
                      Exported {formatDateTime(bundle.manifest.exportedAt)}
                    </div>
                    <div className="text-xs text-text-muted">
                      {availableCategories.length} categories, {selectedItemCount} selected item{selectedItemCount === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Categories</h2>
                <p className="text-xs text-text-muted">Select exactly what should be imported.</p>
              </div>
              <div className="rounded-full border border-[var(--glass-border)] bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {selectedItemCount} items
              </div>
            </div>

            {bundle ? (
              <div className="space-y-2">
                {availableCategories.map((category) => (
                  <label
                    key={category}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-text-primary">{CATEGORY_LABELS[category]}</div>
                      <div className="text-xs text-text-muted">
                        {bundle.manifest.itemCounts[category]} item{bundle.manifest.itemCounts[category] === 1 ? '' : 's'}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() => toggleCategory(category)}
                      className="h-4 w-4 rounded border-[var(--glass-border)] bg-transparent"
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-white/[0.02] px-4 py-6 text-sm text-text-muted">
                Load a bundle first to choose categories.
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => void runPreview()}
                disabled={!bundle || selectedCategories.length === 0 || previewing}
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-white/[0.1] disabled:opacity-50"
              >
                {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Preview Import
              </button>
              <button
                onClick={() => void applyImport()}
                disabled={!bundle || !preview || applying || selectedCategories.length === 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-accent-primary px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Apply Import
              </button>
            </div>
          </section>

          {importResult ? (
            <section className="rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
              <h2 className="text-sm font-semibold text-text-primary">Import summary</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {importResult.appliedCategories.map((category) => (
                  <div key={category} className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-text-muted">{CATEGORY_LABELS[category]}</div>
                    <div className="mt-2 text-sm text-text-secondary">
                      Imported {importResult.importedCounts[category] || 0}
                    </div>
                    <div className="text-xs text-text-muted">
                      Overwrote {importResult.overwrittenCounts[category] || 0}, skipped {importResult.skippedCounts[category] || 0}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <section className="rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Preview & conflicts</h2>
              <p className="text-xs text-text-muted">Review category counts and resolve clashes before applying.</p>
            </div>
            {preview ? (
              <div className="rounded-full border border-[var(--glass-border)] bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {preview.conflicts.length} conflict{preview.conflicts.length === 1 ? '' : 's'}
              </div>
            ) : null}
          </div>

          {!bundle ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-[var(--glass-border)] bg-white/[0.02] px-6 text-center">
              <div>
                <Archive className="mx-auto h-10 w-10 text-text-muted/30" />
                <p className="mt-4 text-sm font-medium text-text-primary">No bundle loaded</p>
                <p className="mt-1 text-sm text-text-muted">
                  Export from one machine, load the file here, then preview conflicts before importing.
                </p>
              </div>
            </div>
          ) : !preview ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-[var(--glass-border)] bg-white/[0.02] px-6 text-center">
              <div>
                <RefreshCw className="mx-auto h-10 w-10 text-text-muted/30" />
                <p className="mt-4 text-sm font-medium text-text-primary">Preview not generated yet</p>
                <p className="mt-1 text-sm text-text-muted">
                  Choose the categories you want, then run a preview to inspect conflicts and item counts.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {preview.categories.map((category) => (
                  <div key={category.category} className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-text-muted">{CATEGORY_LABELS[category.category]}</div>
                    <div className="mt-2 text-sm font-medium text-text-primary">
                      {category.importCount} incoming / {category.existingCount} existing
                    </div>
                    <div className="text-xs text-text-muted">
                      {category.conflictCount} conflict{category.conflictCount === 1 ? '' : 's'}
                    </div>
                  </div>
                ))}
              </div>

              {preview.conflicts.length === 0 ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-100">
                  No conflicts found in the selected categories. You can apply the import safely.
                </div>
              ) : (
                <div className="space-y-4">
                  {preview.conflicts.map((conflict) => (
                    <ConflictCard
                      key={conflict.id}
                      conflict={conflict}
                      resolution={resolutions[conflict.id] || 'keep'}
                      onResolutionChange={setConflictResolution}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ConflictCard({
  conflict,
  resolution,
  onResolutionChange,
}: {
  conflict: PortableConflict
  resolution: PortableConflictResolution
  onResolutionChange: (conflictId: string, resolution: PortableConflictResolution) => void
}) {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            <h3 className="text-sm font-semibold text-text-primary">{conflict.label}</h3>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            {CATEGORY_LABELS[conflict.category]} conflict · changed fields: {conflict.changedFields.join(', ')}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onResolutionChange(conflict.id, 'keep')}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
              resolution === 'keep'
                ? 'bg-white/[0.16] text-text-primary'
                : 'border border-[var(--glass-border)] bg-white/[0.03] text-text-secondary hover:bg-white/[0.08]'
            }`}
          >
            Keep existing
          </button>
          <button
            onClick={() => onResolutionChange(conflict.id, 'overwrite')}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
              resolution === 'overwrite'
                ? 'bg-accent-primary text-white'
                : 'border border-[var(--glass-border)] bg-white/[0.03] text-text-secondary hover:bg-white/[0.08]'
            }`}
          >
            Overwrite
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <div className="rounded-2xl border border-[var(--glass-border)] bg-black/20 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-text-muted">Existing</div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-text-secondary">
            {prettyJson(conflict.existing)}
          </pre>
        </div>
        <div className="rounded-2xl border border-[var(--glass-border)] bg-black/20 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-text-muted">Imported</div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-text-secondary">
            {prettyJson(conflict.imported)}
          </pre>
        </div>
      </div>
    </div>
  )
}

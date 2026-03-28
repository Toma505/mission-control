'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  FileUp,
  Hash,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { PromptTemplate, PromptVersion } from '@/lib/prompt-library-store'

type PromptResponse = {
  prompts: PromptTemplate[]
  categories: string[]
  tags: string[]
}

type DiffRow = {
  type: 'context' | 'add' | 'remove'
  text: string
}

const DEFAULT_CATEGORIES = ['General', 'System Prompt', 'Agent Task', 'Analysis', 'Code', 'Creative', 'Data']

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
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

function VersionDiff({ from, to }: { from: PromptVersion; to: PromptVersion }) {
  const rows = useMemo(() => buildDiffRows(from.content, to.content), [from.content, to.content])

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/20 overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="text-sm font-medium text-text-primary">
          {formatDate(from.savedAt)} → {formatDate(to.savedAt)}
        </p>
        <p className="text-xs text-text-muted mt-1">Comparing prompt content between these two saved versions.</p>
      </div>
      <div className="max-h-72 overflow-auto font-mono text-[11px]">
        {rows.map((row, index) => (
          <div
            key={`${row.type}-${index}-${row.text}`}
            className={cn(
              'grid grid-cols-[34px_1fr] gap-0 border-b border-white/[0.04]',
              row.type === 'add' && 'bg-emerald-500/10',
              row.type === 'remove' && 'bg-red-500/10',
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

export function PromptLibrary() {
  const router = useRouter()
  const importInputRef = useRef<HTMLInputElement>(null)

  const [prompts, setPrompts] = useState<PromptTemplate[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [selectedPromptId, setSelectedPromptId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PromptTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState('')
  const [copiedId, setCopiedId] = useState('')
  const [notice, setNotice] = useState('')
  const [compareFromId, setCompareFromId] = useState('')
  const [compareToId, setCompareToId] = useState('')

  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formCategory, setFormCategory] = useState('General')
  const [formContent, setFormContent] = useState('')
  const [formTags, setFormTags] = useState('')

  const loadPrompts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (categoryFilter) params.set('category', categoryFilter)
      if (tagFilter) params.set('tag', tagFilter)
      const res = await fetch(`/api/prompts?${params.toString()}`)
      const data = await res.json() as PromptResponse
      setPrompts(data.prompts || [])
      setCategories(data.categories || [])
      setAllTags(data.tags || [])
      if ((data.prompts || []).length > 0) {
        setSelectedPromptId((current) => {
          if (current && data.prompts.some((prompt) => prompt.id === current)) return current
          return data.prompts[0].id
        })
      } else {
        setSelectedPromptId('')
      }
    } catch {
      setPrompts([])
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter, tagFilter])

  useEffect(() => {
    void loadPrompts()
  }, [loadPrompts])

  const selectedPrompt = prompts.find((prompt) => prompt.id === selectedPromptId) || null
  const versionOptions = selectedPrompt?.versions || []
  const compareTo = versionOptions.find((version) => version.id === compareToId) || versionOptions[versionOptions.length - 1] || null
  const compareFrom = versionOptions.find((version) => version.id === compareFromId) || (versionOptions.length > 1 ? versionOptions[versionOptions.length - 2] : null)
  const previewVars = useMemo(() => formContent.match(/\{\{(\w+)\}\}/g) || [], [formContent])

  useEffect(() => {
    if (!selectedPrompt || versionOptions.length === 0) {
      setCompareFromId('')
      setCompareToId('')
      return
    }

    const latest = versionOptions[versionOptions.length - 1]
    const previous = versionOptions.length > 1 ? versionOptions[versionOptions.length - 2] : latest

    setCompareToId((current) => versionOptions.some((version) => version.id === current) ? current : latest.id)
    setCompareFromId((current) => versionOptions.some((version) => version.id === current) ? current : previous.id)
  }, [selectedPrompt, versionOptions])

  function resetForm() {
    setFormName('')
    setFormDesc('')
    setFormCategory('General')
    setFormContent('')
    setFormTags('')
    setEditing(null)
    setShowForm(false)
  }

  function startEdit(prompt: PromptTemplate) {
    setEditing(prompt)
    setFormName(prompt.name)
    setFormDesc(prompt.description)
    setFormCategory(prompt.category)
    setFormContent(prompt.content)
    setFormTags(prompt.tags.join(', '))
    setShowForm(true)
  }

  async function handleSave() {
    setBusyAction('save')
    try {
      const tags = formTags.split(',').map((tag) => tag.trim()).filter(Boolean)
      await apiFetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing?.id,
          name: formName,
          description: formDesc,
          category: formCategory,
          content: formContent,
          tags,
        }),
      })
      resetForm()
      await loadPrompts()
      setNotice(editing ? 'Prompt updated and version saved.' : 'Prompt saved.')
    } finally {
      setBusyAction('')
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this prompt?')) return
    setBusyAction(`delete:${id}`)
    try {
      await apiFetch('/api/prompts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (selectedPromptId === id) {
        setSelectedPromptId('')
      }
      await loadPrompts()
      setNotice('Prompt deleted.')
    } finally {
      setBusyAction('')
    }
  }

  async function handleDuplicate(id: string) {
    setBusyAction(`duplicate:${id}`)
    try {
      await apiFetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', id }),
      })
      await loadPrompts()
      setNotice('Prompt duplicated.')
    } finally {
      setBusyAction('')
    }
  }

  async function handleCopy(prompt: PromptTemplate) {
    await navigator.clipboard.writeText(prompt.content)
    setCopiedId(prompt.id)
    setTimeout(() => setCopiedId(''), 1800)
  }

  async function handleUseWithAgent(prompt: PromptTemplate) {
    await apiFetch('/api/prompts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: prompt.id }),
    }).catch(() => {})

    sessionStorage.setItem('mission-control-chat-prefill', JSON.stringify({
      content: prompt.content,
      promptId: prompt.id,
      promptName: prompt.name,
    }))
    router.push('/chat')
  }

  async function handleExport() {
    const response = await fetch('/api/prompts?format=export')
    const blob = await response.blob()
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = 'mission-control-prompts.json'
    link.click()
    URL.revokeObjectURL(href)
  }

  async function handleImport(file: File) {
    setBusyAction('import')
    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw) as { prompts?: PromptTemplate[] } | PromptTemplate[]
      const promptsToImport = Array.isArray(parsed) ? parsed : parsed.prompts || []
      await apiFetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', prompts: promptsToImport, mode: 'merge' }),
      })
      await loadPrompts()
      setNotice(`Imported ${promptsToImport.length} prompt${promptsToImport.length === 1 ? '' : 's'}.`)
    } catch {
      setNotice('Import failed. Make sure the file contains valid prompt JSON.')
    } finally {
      setBusyAction('')
      if (importInputRef.current) {
        importInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search prompts..."
              className="w-72 rounded-xl border border-[var(--glass-border)] bg-white/[0.04] py-2 pl-9 pr-3 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/30"
            />
          </div>

          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="appearance-none rounded-xl border border-[var(--glass-border)] bg-white/[0.04] py-2 pl-3 pr-8 text-xs text-text-primary focus:outline-none"
            >
              <option value="">All categories</option>
              {[...new Set([...DEFAULT_CATEGORIES, ...categories])].map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted" />
          </div>

          <div className="relative">
            <select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              className="appearance-none rounded-xl border border-[var(--glass-border)] bg-white/[0.04] py-2 pl-3 pr-8 text-xs text-text-primary focus:outline-none"
            >
              <option value="">All tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImport(file)
            }}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.07] transition-colors"
          >
            <FileUp className="h-3.5 w-3.5" />
            Import JSON
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.07] transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="flex items-center gap-1.5 rounded-xl bg-accent-primary/20 px-3 py-2 text-xs font-medium text-accent-primary hover:bg-accent-primary/30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Prompt
          </button>
        </div>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      ) : null}

      {showForm ? (
        <div className="glass rounded-2xl border border-accent-primary/20 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text-primary">{editing ? 'Edit Prompt' : 'New Prompt'}</h3>
              <p className="text-xs text-text-muted mt-1">
                Saving edits automatically appends a new version snapshot.
              </p>
            </div>
            <button onClick={resetForm} className="rounded-lg p-1 hover:bg-white/[0.08]">
              <X className="h-4 w-4 text-text-muted" />
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              value={formName}
              onChange={(event) => setFormName(event.target.value)}
              placeholder="Prompt name"
              className="rounded-xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none"
            />
            <select
              value={formCategory}
              onChange={(event) => setFormCategory(event.target.value)}
              className="rounded-xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2 text-xs text-text-primary focus:outline-none"
            >
              {[...new Set([...DEFAULT_CATEGORIES, ...categories])].map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <input
            type="text"
            value={formDesc}
            onChange={(event) => setFormDesc(event.target.value)}
            placeholder="Description"
            className="mt-3 w-full rounded-xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none"
          />

          <textarea
            value={formContent}
            onChange={(event) => setFormContent(event.target.value)}
            placeholder="Prompt content... use {{variable}} placeholders as needed"
            rows={10}
            className="mt-3 w-full rounded-xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none resize-none"
          />

          {previewVars.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[11px] text-text-muted">Variables detected:</span>
              {previewVars.map((variable) => (
                <span key={variable} className="rounded-full bg-amber-400/10 px-2 py-1 text-[10px] font-mono text-amber-300">
                  {variable}
                </span>
              ))}
            </div>
          ) : null}

          <input
            type="text"
            value={formTags}
            onChange={(event) => setFormTags(event.target.value)}
            placeholder="Tags (comma separated)"
            className="mt-3 w-full rounded-xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none"
          />

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => void handleSave()}
              disabled={!formName.trim() || !formContent.trim() || busyAction === 'save'}
              className="rounded-xl bg-accent-primary px-4 py-2 text-xs font-medium text-white hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busyAction === 'save' ? 'Saving...' : editing ? 'Save New Version' : 'Save Prompt'}
            </button>
            <button
              onClick={resetForm}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.07] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="glass rounded-2xl overflow-hidden">
          <div className="border-b border-[var(--glass-border)] px-5 py-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-accent-primary" />
              <div>
                <h2 className="text-base font-semibold text-text-primary">Saved Prompts</h2>
                <p className="text-xs text-text-muted">Search, tag, duplicate, and hand prompts off to live agent chat.</p>
              </div>
            </div>
          </div>

          <div className="max-h-[75vh] overflow-y-auto px-3 py-3">
            {loading ? (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-4 text-sm text-text-muted">
                Loading prompt library...
              </div>
            ) : prompts.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-6 text-center">
                <BookOpen className="mx-auto h-8 w-8 text-text-muted/40" />
                <p className="mt-3 text-sm text-text-primary">No prompts found</p>
                <p className="mt-1 text-xs text-text-muted">Try clearing filters or create your first prompt.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {prompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    onClick={() => setSelectedPromptId(prompt.id)}
                    className={cn(
                      'w-full rounded-2xl border px-4 py-4 text-left transition-all',
                      selectedPromptId === prompt.id
                        ? 'border-accent-primary/40 bg-accent-primary/10'
                        : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{prompt.name}</p>
                        <p className="mt-1 text-xs text-text-secondary line-clamp-2">{prompt.description || prompt.content}</p>
                      </div>
                      <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] text-text-muted">
                        {prompt.category}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-text-muted">
                      {prompt.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full bg-white/[0.05] px-2 py-1">#{tag}</span>
                      ))}
                      <span className="rounded-full bg-white/[0.05] px-2 py-1">{prompt.versions.length} versions</span>
                      <span className="rounded-full bg-white/[0.05] px-2 py-1">{prompt.usageCount} uses</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="glass rounded-2xl overflow-hidden">
          {selectedPrompt ? (
            <>
              <div className="border-b border-[var(--glass-border)] px-6 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold text-text-primary">{selectedPrompt.name}</h2>
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-text-muted">
                        {selectedPrompt.category}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-text-muted">{selectedPrompt.description || 'No description provided.'}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
                      <span>Updated {formatDate(selectedPrompt.updatedAt)}</span>
                      <span>•</span>
                      <span>{selectedPrompt.versions.length} saved versions</span>
                      <span>•</span>
                      <span>{selectedPrompt.usageCount} uses</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void handleUseWithAgent(selectedPrompt)}
                      className="flex items-center gap-1.5 rounded-xl bg-accent-primary px-3 py-2 text-xs font-medium text-white hover:bg-accent-primary/90 transition-colors"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      Use with Agent
                    </button>
                    <button
                      onClick={() => void handleCopy(selectedPrompt)}
                      className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.07] transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedId === selectedPrompt.id ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => startEdit(selectedPrompt)}
                      className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.07] transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => void handleDuplicate(selectedPrompt.id)}
                      className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.07] transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Duplicate
                    </button>
                    <button
                      onClick={() => void handleDelete(selectedPrompt.id)}
                      className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-100 hover:bg-red-500/15 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 px-6 py-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <div className="space-y-5">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-text-muted/70">
                      <BookOpen className="h-4 w-4" />
                      Prompt content
                    </div>
                    <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-black/20 px-4 py-4 font-mono text-sm leading-6 text-text-primary/90">
                      {selectedPrompt.content}
                    </pre>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-text-muted/70">
                        <Tag className="h-4 w-4" />
                        Tags
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedPrompt.tags.length > 0 ? selectedPrompt.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-text-primary">
                            #{tag}
                          </span>
                        )) : <p className="text-sm text-text-muted">No tags yet.</p>}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-text-muted/70">
                        <Sparkles className="h-4 w-4" />
                        Variables
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedPrompt.variables.length > 0 ? selectedPrompt.variables.map((variable) => (
                          <span key={variable} className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-mono text-amber-300">
                            {variable}
                          </span>
                        )) : <p className="text-sm text-text-muted">No dynamic variables.</p>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-text-muted/70">
                      <Hash className="h-4 w-4" />
                      Version history
                    </div>
                    <div className="mt-4 space-y-2">
                      {versionOptions.map((version, index) => (
                        <div key={version.id} className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-text-primary">
                                Version {versionOptions.length - index}
                              </p>
                              <p className="mt-1 text-xs text-text-muted">{formatDate(version.savedAt)}</p>
                            </div>
                            {index === versionOptions.length - 1 ? (
                              <span className="rounded-full bg-accent-primary/15 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-accent-primary">
                                Current
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-xs text-text-secondary line-clamp-2">{version.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-text-muted/70">
                      <Upload className="h-4 w-4" />
                      Version diff
                    </div>
                    {versionOptions.length > 1 ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="relative">
                          <select
                            value={compareFromId}
                            onChange={(event) => setCompareFromId(event.target.value)}
                            className="w-full appearance-none rounded-xl border border-white/[0.08] bg-black/20 py-2 pl-3 pr-8 text-xs text-text-primary focus:outline-none"
                          >
                            {versionOptions.map((version, index) => (
                              <option key={version.id} value={version.id}>
                                Version {versionOptions.length - index} · {formatDate(version.savedAt)}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted" />
                        </div>
                        <div className="relative">
                          <select
                            value={compareToId}
                            onChange={(event) => setCompareToId(event.target.value)}
                            className="w-full appearance-none rounded-xl border border-white/[0.08] bg-black/20 py-2 pl-3 pr-8 text-xs text-text-primary focus:outline-none"
                          >
                            {versionOptions.map((version, index) => (
                              <option key={version.id} value={version.id}>
                                Version {versionOptions.length - index} · {formatDate(version.savedAt)}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted" />
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4">
                      {compareFrom && compareTo ? (
                        <VersionDiff from={compareFrom} to={compareTo} />
                      ) : (
                        <div className="rounded-xl bg-black/20 px-4 py-4 text-sm text-text-muted">
                          This prompt only has one saved version so far. Save an edit to start comparing changes.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="px-6 py-16 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-text-muted/40" />
              <p className="mt-4 text-base font-medium text-text-primary">Select a prompt to inspect it</p>
              <p className="mt-2 text-sm text-text-muted">
                You’ll be able to review versions, compare diffs, and send it straight to Agent Chat from here.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

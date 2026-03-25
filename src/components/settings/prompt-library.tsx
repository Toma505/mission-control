'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen,
  Plus,
  Search,
  Tag,
  Copy,
  Trash2,
  Edit3,
  X,
  Hash,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'

interface PromptTemplate {
  id: string
  name: string
  description: string
  category: string
  content: string
  variables: string[]
  tags: string[]
  usageCount: number
  createdAt: string
  updatedAt: string
}

const CATEGORIES = ['General', 'System Prompt', 'Agent Task', 'Analysis', 'Code', 'Creative', 'Data']

export function PromptLibrary() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PromptTemplate | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied] = useState('')

  // Form state
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formCategory, setFormCategory] = useState('General')
  const [formContent, setFormContent] = useState('')
  const [formTags, setFormTags] = useState('')

  const loadPrompts = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (categoryFilter) params.set('category', categoryFilter)
      const res = await fetch(`/api/prompts?${params}`)
      const data = await res.json()
      setPrompts(data.prompts || [])
      setCategories(data.categories || [])
    } catch {}
  }, [search, categoryFilter])

  useEffect(() => { loadPrompts() }, [loadPrompts])

  function resetForm() {
    setFormName('')
    setFormDesc('')
    setFormCategory('General')
    setFormContent('')
    setFormTags('')
    setEditing(null)
    setShowForm(false)
  }

  function startEdit(p: PromptTemplate) {
    setEditing(p)
    setFormName(p.name)
    setFormDesc(p.description)
    setFormCategory(p.category)
    setFormContent(p.content)
    setFormTags(p.tags.join(', '))
    setShowForm(true)
  }

  async function handleSave() {
    const tags = formTags.split(',').map(t => t.trim()).filter(Boolean)
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
    loadPrompts()
  }

  async function handleDelete(id: string) {
    await apiFetch('/api/prompts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadPrompts()
  }

  async function handleCopy(p: PromptTemplate) {
    navigator.clipboard.writeText(p.content)
    setCopied(p.id)
    setTimeout(() => setCopied(''), 2000)
    // Track usage
    await apiFetch('/api/prompts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id }),
    }).catch(() => {})
  }

  // Extract variables from content for preview
  const previewVars = formContent.match(/\{\{(\w+)\}\}/g) || []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search prompts..."
              className="pl-9 pr-3 py-2 rounded-xl bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/30 w-64"
            />
          </div>

          {/* Category filter */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary focus:outline-none cursor-pointer"
            >
              <option value="">All categories</option>
              {[...new Set([...CATEGORIES, ...categories])].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
          </div>
        </div>

        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-primary/20 text-accent-primary text-xs font-medium hover:bg-accent-primary/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Prompt
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="glass rounded-2xl p-6 border border-accent-primary/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">
              {editing ? 'Edit Prompt' : 'New Prompt'}
            </h3>
            <button onClick={resetForm} className="p-1 rounded-lg hover:bg-white/[0.08]">
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="Prompt name"
              className="px-3 py-2 rounded-xl bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none"
            />
            <select
              value={formCategory}
              onChange={e => setFormCategory(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary focus:outline-none"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <input
            type="text"
            value={formDesc}
            onChange={e => setFormDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none mb-3"
          />

          <textarea
            value={formContent}
            onChange={e => setFormContent(e.target.value)}
            placeholder="Prompt content... Use {{variable}} for dynamic parts"
            rows={6}
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none font-mono resize-none mb-3"
          />

          {previewVars.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-text-muted">Variables detected:</span>
              {previewVars.map((v, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-400/10 text-amber-400">
                  {v}
                </span>
              ))}
            </div>
          )}

          <input
            type="text"
            value={formTags}
            onChange={e => setFormTags(e.target.value)}
            placeholder="Tags (comma separated)"
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none mb-4"
          />

          <button
            onClick={handleSave}
            disabled={!formName || !formContent}
            className="px-4 py-2 rounded-xl bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editing ? 'Update Prompt' : 'Save Prompt'}
          </button>
        </div>
      )}

      {/* Prompt List */}
      {prompts.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <BookOpen className="w-10 h-10 text-text-muted/20 mx-auto mb-3" />
          <p className="text-sm text-text-muted">No prompts yet</p>
          <p className="text-xs text-text-muted/60 mt-1">
            Save your best system prompts, agent instructions, and templates for quick reuse
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {prompts.map(p => (
            <div key={p.id} className="glass rounded-2xl p-4 hover:border-[var(--glass-border)] transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-text-primary truncate">{p.name}</h4>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/[0.06] text-text-muted shrink-0">
                      {p.category}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-[11px] text-text-muted mt-1 line-clamp-1">{p.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <button onClick={() => handleCopy(p)} className="p-1.5 rounded-lg hover:bg-white/[0.08]" title="Copy">
                    <Copy className={`w-3.5 h-3.5 ${copied === p.id ? 'text-emerald-400' : 'text-text-muted'}`} />
                  </button>
                  <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg hover:bg-white/[0.08]" title="Edit">
                    <Edit3 className="w-3.5 h-3.5 text-text-muted" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-white/[0.08]" title="Delete">
                    <Trash2 className="w-3.5 h-3.5 text-text-muted hover:text-red-400" />
                  </button>
                </div>
              </div>

              {/* Content preview */}
              <button
                onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                className="w-full text-left"
              >
                <pre className={`text-[11px] text-text-muted/80 font-mono bg-white/[0.02] rounded-lg p-2 ${
                  expanded === p.id ? '' : 'line-clamp-3'
                } whitespace-pre-wrap break-words`}>
                  {p.content}
                </pre>
              </button>

              {/* Footer */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  {p.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="flex items-center gap-0.5 text-[10px] text-text-muted/60">
                      <Tag className="w-2.5 h-2.5" /> {tag}
                    </span>
                  ))}
                  {p.variables.length > 0 && (
                    <span className="text-[10px] text-amber-400/60">
                      {p.variables.length} var{p.variables.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-text-muted/40 flex items-center gap-1">
                  <Hash className="w-2.5 h-2.5" /> {p.usageCount} uses
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Tag, Plus, Trash2, X, Palette, FolderOpen } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'

interface CostTag {
  id: string
  name: string
  color: string
  description: string
  createdAt: string
  sessionCount: number
  sessions: { sessionKey: string; assignedAt: string; notes?: string }[]
}

const PRESET_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#f97316', '#ef4444', '#84cc16', '#6366f1',
]

export function CostTags() {
  const [tags, setTags] = useState<CostTag[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formColor, setFormColor] = useState(PRESET_COLORS[0])
  const [expandedTag, setExpandedTag] = useState<string | null>(null)

  // Assign form
  const [assigningTag, setAssigningTag] = useState<string | null>(null)
  const [assignSession, setAssignSession] = useState('')
  const [assignNotes, setAssignNotes] = useState('')

  const loadTags = useCallback(async () => {
    try {
      const res = await fetch('/api/cost-tags')
      const data = await res.json()
      setTags(data.tags || [])
    } catch {}
  }, [])

  useEffect(() => { loadTags() }, [loadTags])

  async function createTag() {
    if (!formName) return
    await apiFetch('/api/cost-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: formName, description: formDesc, color: formColor }),
    })
    setFormName('')
    setFormDesc('')
    setShowForm(false)
    loadTags()
  }

  async function deleteTag(id: string) {
    await apiFetch('/api/cost-tags', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadTags()
  }

  async function assignTag() {
    if (!assigningTag || !assignSession) return
    await apiFetch('/api/cost-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'assign',
        tagId: assigningTag,
        sessionKey: assignSession,
        notes: assignNotes,
      }),
    })
    setAssigningTag(null)
    setAssignSession('')
    setAssignNotes('')
    loadTags()
  }

  async function unassign(tagId: string, sessionKey: string) {
    await apiFetch('/api/cost-tags', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unassign', tagId, sessionKey }),
    })
    loadTags()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          Tag sessions and agents with project or client names to track costs by category
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-primary/20 text-accent-primary text-xs font-medium hover:bg-accent-primary/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Tag
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="glass rounded-2xl p-5 border border-accent-primary/20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Create Tag</h3>
            <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-white/[0.08]">
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>

          <div className="flex gap-3 mb-3">
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="Tag name (e.g., Client: Acme Corp)"
              className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none"
            />
            <input
              type="text"
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder="Description (optional)"
              className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-[10px] text-text-muted">Color:</span>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setFormColor(c)}
                className={`w-5 h-5 rounded-full transition-all ${formColor === c ? 'ring-2 ring-white/40 scale-110' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <button
            onClick={createTag}
            disabled={!formName}
            className="px-4 py-2 rounded-xl bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/90 disabled:opacity-50"
          >
            Create Tag
          </button>
        </div>
      )}

      {/* Tags List */}
      {tags.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Tag className="w-10 h-10 text-text-muted/20 mx-auto mb-3" />
          <p className="text-sm text-text-muted">No cost tags yet</p>
          <p className="text-xs text-text-muted/60 mt-1">
            Create tags like &ldquo;Project Alpha&rdquo; or &ldquo;Client: Acme&rdquo; to categorize agent spending
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tags.map(tag => (
            <div key={tag.id} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  <div>
                    <h4 className="text-sm font-medium text-text-primary">{tag.name}</h4>
                    {tag.description && (
                      <p className="text-[11px] text-text-muted">{tag.description}</p>
                    )}
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.06] text-text-muted">
                    {tag.sessionCount} session{tag.sessionCount !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setAssigningTag(assigningTag === tag.id ? null : tag.id)
                      setAssignSession('')
                      setAssignNotes('')
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-accent-primary bg-accent-primary/10 hover:bg-accent-primary/20"
                  >
                    <Plus className="w-3 h-3" /> Assign
                  </button>
                  <button
                    onClick={() => setExpandedTag(expandedTag === tag.id ? null : tag.id)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.08]"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-text-muted" />
                  </button>
                  <button onClick={() => deleteTag(tag.id)} className="p-1.5 rounded-lg hover:bg-white/[0.08]">
                    <Trash2 className="w-3.5 h-3.5 text-text-muted hover:text-red-400" />
                  </button>
                </div>
              </div>

              {/* Assign form */}
              {assigningTag === tag.id && (
                <div className="mt-3 p-3 rounded-xl bg-white/[0.02] border border-[var(--glass-border)]/50">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={assignSession}
                      onChange={e => setAssignSession(e.target.value)}
                      placeholder="Session key (e.g., agent:main:main)"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={assignNotes}
                      onChange={e => setAssignNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none"
                    />
                    <button
                      onClick={assignTag}
                      disabled={!assignSession}
                      className="px-3 py-1.5 rounded-lg bg-accent-primary text-white text-xs disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Assigned sessions */}
              {expandedTag === tag.id && tag.sessions.length > 0 && (
                <div className="mt-3 space-y-1">
                  {tag.sessions.map(s => (
                    <div key={s.sessionKey} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02]">
                      <div>
                        <span className="text-xs text-text-primary font-mono">{s.sessionKey}</span>
                        {s.notes && <span className="text-[10px] text-text-muted ml-2">{s.notes}</span>}
                      </div>
                      <button
                        onClick={() => unassign(tag.id, s.sessionKey)}
                        className="p-1 rounded hover:bg-white/[0.08]"
                      >
                        <X className="w-3 h-3 text-text-muted" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

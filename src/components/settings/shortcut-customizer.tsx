'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import type { ShortcutBinding } from '@/app/api/shortcuts/route'

function KeyBadge({ keys }: { keys: string }) {
  return (
    <span className="inline-flex gap-1">
      {keys.split('+').map((k, i) => (
        <kbd
          key={i}
          className="px-1.5 py-0.5 bg-white/[0.08] border border-white/[0.1] rounded text-[11px] font-mono text-text-secondary"
        >
          {k}
        </kbd>
      ))}
    </span>
  )
}

export function ShortcutCustomizer() {
  const [shortcuts, setShortcuts] = useState<ShortcutBinding[]>([])
  const [defaults, setDefaults] = useState<ShortcutBinding[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  const fetchShortcuts = useCallback(async () => {
    try {
      const res = await fetch('/api/shortcuts')
      if (res.ok) {
        const data = await res.json()
        setShortcuts(data.shortcuts || [])
        setDefaults(data.defaults || [])
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => { fetchShortcuts() }, [fetchShortcuts])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!recording || !editingId) return
    e.preventDefault()
    e.stopPropagation()

    const parts: string[] = []
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
    if (e.shiftKey) parts.push('Shift')
    if (e.altKey) parts.push('Alt')

    const key = e.key
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return

    parts.push(key.length === 1 ? key.toUpperCase() : key)
    const combo = parts.join('+')

    setShortcuts(prev => prev.map(s => s.id === editingId ? { ...s, keys: combo } : s))
    setEditingId(null)
    setRecording(false)
  }, [recording, editingId])

  useEffect(() => {
    if (recording) {
      window.addEventListener('keydown', handleKeyDown, true)
      return () => window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [recording, handleKeyDown])

  const save = async () => {
    setSaving(true)
    try {
      const res = await apiFetch('/api/shortcuts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortcuts }),
      })
      if (res.ok) {
        setStatus('Saved!')
        setTimeout(() => setStatus(''), 2000)
      }
    } catch {
      setStatus('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const resetAll = async () => {
    const res = await apiFetch('/api/shortcuts', { method: 'DELETE' })
    if (res.ok) {
      const data = await res.json()
      setShortcuts(data.shortcuts || defaults)
      setStatus('Reset to defaults')
      setTimeout(() => setStatus(''), 2000)
    }
  }

  const isModified = (id: string) => {
    const def = defaults.find(d => d.id === id)
    const cur = shortcuts.find(s => s.id === id)
    return def && cur && def.keys !== cur.keys
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-secondary">Click a shortcut to rebind it. Press the new key combination to save.</p>
        </div>
        <div className="flex items-center gap-2">
          {status && <span className="text-xs text-emerald-400">{status}</span>}
          <button
            onClick={resetAll}
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-xs text-text-muted hover:bg-white/[0.08] transition-colors"
          >
            Reset All
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary,#3b82f6)] text-xs text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {shortcuts.map(shortcut => (
          <div
            key={shortcut.id}
            className={`glass rounded-xl p-4 flex items-center gap-4 ${
              editingId === shortcut.id ? 'ring-1 ring-[var(--accent-primary,#3b82f6)]' : ''
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary font-medium">
                {shortcut.label}
                {isModified(shortcut.id) && (
                  <span className="ml-2 text-[10px] text-amber-400 font-normal">modified</span>
                )}
              </p>
              <p className="text-xs text-text-muted">{shortcut.description}</p>
            </div>

            <button
              onClick={() => {
                if (editingId === shortcut.id) {
                  setEditingId(null)
                  setRecording(false)
                } else {
                  setEditingId(shortcut.id)
                  setRecording(true)
                }
              }}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                editingId === shortcut.id
                  ? 'bg-[var(--accent-primary,#3b82f6)]/20 text-[var(--accent-primary,#3b82f6)] animate-pulse'
                  : 'bg-white/[0.06] text-text-secondary hover:bg-white/[0.1]'
              }`}
            >
              {editingId === shortcut.id ? 'Press keys...' : <KeyBadge keys={shortcut.keys} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

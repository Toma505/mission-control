'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Sparkles, X } from 'lucide-react'

import { useSettings } from '@/contexts/settings-context'
import { apiFetch } from '@/lib/api-client'
import type { Settings } from '@/lib/app-settings'

type ChangelogEntry = {
  version: string
  date: string
  title: string
  summary: string
  changes: {
    added: string[]
    improved: string[]
    fixed: string[]
  }
}

function compareVersions(a: string, b: string) {
  const normalize = (value: string) =>
    value
      .replace(/^v/i, '')
      .split('.')
      .map((part) => Number(part) || 0)

  const left = normalize(a)
  const right = normalize(b)
  const maxLength = Math.max(left.length, right.length)

  for (let index = 0; index < maxLength; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }

  return 0
}

export function WhatsNewModal() {
  const pathname = usePathname()
  const { applySettings } = useSettings()

  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [entry, setEntry] = useState<ChangelogEntry | null>(null)
  const [settingsSnapshot, setSettingsSnapshot] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (pathname !== '/') {
      setOpen(false)
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadModalState() {
      setLoading(true)

      try {
        const [changelogResponse, settingsResponse] = await Promise.all([
          fetch('/api/changelog', { cache: 'no-store' }),
          fetch('/api/settings', { cache: 'no-store' }),
        ])

        if (!changelogResponse.ok || !settingsResponse.ok || cancelled) return

        const changelogData = await changelogResponse.json().catch(() => null)
        const settingsData = await settingsResponse.json().catch(() => null)
        const latest = Array.isArray(changelogData?.entries) ? changelogData.entries[0] : null
        const nextSettings = settingsData?.settings ?? null

        if (!latest || !nextSettings || cancelled) return

        setEntry(latest)
        setSettingsSnapshot(nextSettings)

        const lastSeenVersion = typeof nextSettings.lastSeenVersion === 'string' ? nextSettings.lastSeenVersion : null
        setOpen(!lastSeenVersion || compareVersions(latest.version, lastSeenVersion) > 0)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadModalState()
    return () => {
      cancelled = true
    }
  }, [pathname])

  const highlights = useMemo(() => {
    if (!entry) return []
    return [...entry.changes.added, ...entry.changes.improved, ...entry.changes.fixed].slice(0, 4)
  }, [entry])

  async function dismiss(version: string) {
    if (!settingsSnapshot) {
      setOpen(false)
      return
    }

    setSaving(true)
    const nextSettings = { ...settingsSnapshot, lastSeenVersion: version }

    try {
      const response = await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextSettings),
      })

      if (response.ok) {
        applySettings(nextSettings)
      }
    } finally {
      setSaving(false)
      setOpen(false)
    }
  }

  if (loading || !open || !entry) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-6">
      <button
        aria-label="Dismiss what's new"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => void dismiss(entry.version)}
      />

      <div className="relative w-full max-w-2xl overflow-hidden rounded-[28px] border border-[var(--glass-border)] bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_40%),rgba(255,255,255,0.04)] shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(9,9,11,0.22))]" />

        <div className="relative space-y-6 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-white/[0.06] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-text-secondary">
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                What&apos;s New
              </div>
              <div>
                <p className="text-sm text-text-muted">{entry.version} · {entry.date}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">{entry.title}</h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-text-secondary">{entry.summary}</p>
              </div>
            </div>

            <button
              onClick={() => void dismiss(entry.version)}
              className="rounded-xl border border-[var(--glass-border)] bg-white/[0.05] p-2 text-text-muted transition-colors hover:bg-white/[0.08] hover:text-text-primary"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {highlights.map((change) => (
              <div
                key={change}
                className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.04] px-4 py-3 text-sm leading-6 text-text-secondary"
              >
                {change}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--glass-border)] pt-4">
            <Link
              href="/changelog"
              onClick={() => void dismiss(entry.version)}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-primary)] hover:underline"
            >
              View full changelog
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={() => void dismiss(entry.version)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Continue to dashboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

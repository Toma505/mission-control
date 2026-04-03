import { Sparkles } from 'lucide-react'

import { type ChangelogEntry, readChangelogEntries } from '@/lib/changelog-store'

const CHANGE_GROUPS: Array<{
  key: keyof ChangelogEntry['changes']
  label: string
  tone: string
}> = [
  { key: 'added', label: 'Added', tone: 'text-emerald-300' },
  { key: 'improved', label: 'Improved', tone: 'text-sky-300' },
  { key: 'fixed', label: 'Fixed', tone: 'text-amber-300' },
]

export default async function ChangelogPage() {
  const entries = await readChangelogEntries()

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] border border-[var(--glass-border)] bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_35%),rgba(255,255,255,0.04)] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(9,9,11,0.22))]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-white/[0.06] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-text-secondary">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              Changelog
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-text-primary">Release history, without the guesswork.</h1>
              <p className="text-sm leading-7 text-text-secondary">
                Every shipped version lives here with the actual product changes grouped by what was added, improved, and fixed.
              </p>
            </div>
          </div>

          {entries[0] ? (
            <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.05] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Latest public build</p>
              <p className="mt-1 text-2xl font-semibold text-text-primary">{entries[0].version}</p>
              <p className="text-sm text-text-secondary">{entries[0].date}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-6">
        {entries.map((entry, index) => (
          <article
            key={entry.version}
            className="relative overflow-hidden rounded-[26px] border border-[var(--glass-border)] bg-white/[0.04] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.24)]"
          >
            <div className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(59,130,246,0.45),transparent)]" />

            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Release {entries.length - index}</p>
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-text-primary">{entry.version}</h2>
                  <p className="mt-1 text-sm text-text-secondary">{entry.date}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-medium text-text-primary">{entry.title}</p>
                  <p className="text-sm leading-7 text-text-secondary">{entry.summary}</p>
                </div>
              </div>

              <div className="grid gap-4">
                {CHANGE_GROUPS.map((group) => {
                  const items = entry.changes[group.key]
                  if (items.length === 0) return null

                  return (
                    <section
                      key={`${entry.version}-${group.key}`}
                      className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className={`text-sm font-semibold uppercase tracking-[0.16em] ${group.tone}`}>
                          {group.label}
                        </h3>
                        <span className="text-[11px] text-text-muted">{items.length} item{items.length === 1 ? '' : 's'}</span>
                      </div>
                      <ul className="mt-3 space-y-2">
                        {items.map((item) => (
                          <li key={item} className="flex gap-2 text-sm leading-6 text-text-secondary">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-primary)]" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )
                })}
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}

import { readChangelogStore } from '@/lib/changelog-store'

function EntrySection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3 text-sm text-text-secondary">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function ChangelogPage() {
  const { entries } = await readChangelogStore()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Changelog</h1>
        <p className="mt-1 text-sm text-text-muted">
          Version history, release highlights, and shipped improvements.
        </p>
      </div>

      <div className="space-y-5">
        {entries.map((entry) => (
          <section
            key={entry.version}
            className="rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.24)]"
          >
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">{entry.version}</h2>
                <p className="text-sm text-text-muted">{entry.date}</p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <EntrySection title="Added" items={entry.added} />
              <EntrySection title="Improved" items={entry.improved} />
              <EntrySection title="Fixed" items={entry.fixed} />
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

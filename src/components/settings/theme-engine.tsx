'use client'

import Link from 'next/link'
import { CheckCircle2, Eye, Palette, Sparkles } from 'lucide-react'

import { THEME_VARS, type Theme } from '@/lib/app-settings'
import { useSettings } from '@/contexts/settings-context'

const THEMES: Array<{
  value: Theme
  label: string
  description: string
}> = [
  {
    value: 'dark',
    label: 'Dark Glass',
    description: 'The default glass-morphism palette with deep contrast and soft chrome.',
  },
  {
    value: 'midnight',
    label: 'Midnight',
    description: 'A colder, denser blue-black workspace tuned for long night sessions.',
  },
  {
    value: 'light',
    label: 'Light',
    description: 'A bright operator view with softer shadows and lighter reading surfaces.',
  },
]

function ThemePreview({ theme, active }: { theme: Theme; active: boolean }) {
  const vars = THEME_VARS[theme]

  return (
    <div
      className={`rounded-3xl border p-4 transition ${
        active ? 'border-accent-primary/50 shadow-[0_0_0_1px_rgba(59,130,246,0.18)]' : 'border-[var(--glass-border)]'
      }`}
      style={{
        background: vars['--background'],
        color: vars['--text-primary'],
      }}
    >
      <div className="rounded-2xl border px-4 py-4" style={{ borderColor: vars['--glass-border'], background: vars['--glass-bg'] }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.16em]" style={{ color: vars['--text-muted'] }}>
              Mission Control
            </div>
            <div className="mt-1 text-sm font-semibold">{theme === 'dark' ? 'Dark Glass' : theme}</div>
          </div>
          <div className="h-3 w-3 rounded-full" style={{ background: 'var(--accent-primary, #3b82f6)' }} />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border px-3 py-3" style={{ borderColor: vars['--glass-border'], background: vars['--background-card'] }}>
            <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: vars['--text-muted'] }}>
              Status
            </div>
            <div className="mt-2 text-lg font-semibold">Online</div>
            <div className="text-xs" style={{ color: vars['--text-secondary'] }}>
              Scout cluster healthy
            </div>
          </div>
          <div className="rounded-2xl border px-3 py-3" style={{ borderColor: vars['--glass-border'], background: vars['--background-card'] }}>
            <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: vars['--text-muted'] }}>
              Spend
            </div>
            <div className="mt-2 text-lg font-semibold">$14.22</div>
            <div className="text-xs" style={{ color: vars['--text-secondary'] }}>
              Budget pacing on track
            </div>
          </div>
          <div className="rounded-2xl border px-3 py-3" style={{ borderColor: vars['--glass-border'], background: vars['--background-card'] }}>
            <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: vars['--text-muted'] }}>
              Alerts
            </div>
            <div className="mt-2 text-lg font-semibold">2</div>
            <div className="text-xs" style={{ color: vars['--text-secondary'] }}>
              One instance needs attention
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ThemeEngine() {
  const { settings, applySettings } = useSettings()
  const draftTheme = settings.theme

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">
            <Palette className="h-3.5 w-3.5 text-accent-primary" />
            Theme engine
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Themes</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Preview the three built-in skins before applying them to the full app. The chosen theme is persisted locally in Mission Control&apos;s settings store.
          </p>
        </div>
        <Link
          href="/settings/shortcuts"
          className="inline-flex items-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-white/[0.08]"
        >
          <Sparkles className="h-4 w-4" />
          See keyboard shortcuts
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {THEMES.map((theme) => {
          const active = draftTheme === theme.value

          return (
            <article
              key={theme.value}
              className={`rounded-3xl border p-5 transition ${
                active
                  ? 'border-accent-primary/40 bg-accent-primary/10'
                  : 'border-[var(--glass-border)] bg-white/[0.04]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">{theme.label}</h2>
                  <p className="mt-2 text-sm text-text-secondary">{theme.description}</p>
                </div>
                {active ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : null}
              </div>

              <div className="mt-5">
                <ThemePreview theme={theme.value} active={active} />
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={() => applySettings({ ...settings, theme: theme.value })}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-100'
                      : 'bg-accent-primary text-white hover:brightness-110'
                  }`}
                >
                  {active ? <CheckCircle2 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {active ? 'Applied' : 'Apply theme'}
                </button>
                <div className="text-xs text-text-muted">
                  Current accent and typography stay intact when the theme changes.
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

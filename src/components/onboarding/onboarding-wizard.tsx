'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  KeyRound,
  Loader2,
  Plug,
  Rocket,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react'

import { ProgressBar } from '@/components/ui/progress-bar'
import { useSettings } from '@/contexts/settings-context'
import { apiFetch } from '@/lib/api-client'

type PresetId = 'fast' | 'balanced' | 'quality'

type ConnectionResult = {
  openclaw: { ok: boolean; error: string; version: string }
  openrouter: { ok: boolean; error: string; credits: number }
}

type ConnectionInfo = {
  configured?: boolean
  openclawUrl?: string | null
}

type BudgetPayload = {
  budget?: {
    monthlyLimit?: number
  }
}

type ModePayload = {
  mode?: string
  currentModel?: string
}

type VaultPayload = {
  keys?: Array<{ id: string }>
}

const STEPS = [
  { title: 'Welcome', eyebrow: 'First Run', icon: Sparkles },
  { title: 'Connect OpenClaw', eyebrow: 'Step 2', icon: Plug },
  { title: 'Budget & Model', eyebrow: 'Step 3', icon: CircleDollarSign },
  { title: 'Import Keys', eyebrow: 'Step 4', icon: KeyRound },
  { title: 'Ready to Launch', eyebrow: 'Step 5', icon: Rocket },
] as const

const PRESETS: Array<{
  id: PresetId
  label: string
  subtitle: string
  detail: string
  mode: 'budget' | 'standard' | 'best'
}> = [
  {
    id: 'fast',
    label: 'Fast',
    subtitle: 'Lowest latency, lowest cost',
    detail: 'Great for fast routing, lightweight tasks, and frequent iterations.',
    mode: 'budget',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    subtitle: 'Strong quality without overspending',
    detail: 'A steady default for everyday work across editing, research, and ops.',
    mode: 'standard',
  },
  {
    id: 'quality',
    label: 'Quality',
    subtitle: 'Best reasoning and richest output',
    detail: 'Use when depth matters more than cost or raw speed.',
    mode: 'best',
  },
]

function mapModeToPreset(mode: string | undefined): PresetId {
  if (mode === 'best') return 'quality'
  if (mode === 'budget') return 'fast'
  return 'balanced'
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function OnboardingWizard() {
  const router = useRouter()
  const { settings, applySettings } = useSettings()

  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [openclawUrl, setOpenclawUrl] = useState('')
  const [setupPassword, setSetupPassword] = useState('')
  const [openrouterApiKey, setOpenrouterApiKey] = useState('')
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null)
  const [connectionResult, setConnectionResult] = useState<ConnectionResult | null>(null)
  const [connectionState, setConnectionState] = useState<'idle' | 'testing' | 'ready' | 'error'>('idle')
  const [connectionError, setConnectionError] = useState('')
  const [savingConnection, setSavingConnection] = useState(false)

  const [monthlyBudget, setMonthlyBudget] = useState('250')
  const [selectedPreset, setSelectedPreset] = useState<PresetId>('balanced')
  const [budgetError, setBudgetError] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)

  const [vaultKeys, setVaultKeys] = useState({
    openrouter: '',
    anthropic: '',
    openai: '',
  })
  const [existingVaultCount, setExistingVaultCount] = useState(0)
  const [vaultError, setVaultError] = useState('')
  const [savingVault, setSavingVault] = useState(false)

  const [completionError, setCompletionError] = useState('')
  const [finishing, setFinishing] = useState(false)

  const progress = ((step + 1) / STEPS.length) * 100
  const selectedPresetConfig = PRESETS.find((preset) => preset.id === selectedPreset) ?? PRESETS[1]

  const stepCopy = useMemo(
    () => [
      {
        kicker: 'Mission Control, tuned for your first launch',
        title: 'One guided pass and the app is ready for real work.',
        body: 'We’ll connect your OpenClaw instance, set a sane monthly spend ceiling, and optionally import the keys you want Mission Control to manage locally.',
      },
      {
        kicker: 'Live connection check',
        title: 'Connect the control plane to your OpenClaw instance.',
        body: 'Enter the URL and setup password for the OpenClaw instance you want Mission Control to manage. We’ll test it live before saving anything.',
      },
      {
        kicker: 'Budget guardrails',
        title: 'Set the default spend posture for this machine.',
        body: 'Choose a monthly limit and the model preset that should be active when you land in the app. You can change both later.',
      },
      {
        kicker: 'Local key import',
        title: 'Optionally pre-load provider keys into the local vault.',
        body: 'These stay on-device and let Mission Control rotate and reuse the keys without asking you for them again later.',
      },
      {
        kicker: 'Setup complete',
        title: 'You’re ready to start from the dashboard.',
        body: 'We’ll mark onboarding complete and take you straight into the control surface with your current settings preserved.',
      },
    ],
    [],
  )

  useEffect(() => {
    let cancelled = false

    async function loadInitialData() {
      try {
        const [connectionRes, budgetRes, modeRes, vaultRes] = await Promise.all([
          fetch('/api/connection', { cache: 'no-store' }),
          fetch('/api/budget', { cache: 'no-store' }),
          fetch('/api/mode', { cache: 'no-store' }),
          apiFetch('/api/key-vault').catch(() => null),
        ])

        if (cancelled) return

        if (connectionRes.ok) {
          const connectionData = (await connectionRes.json()) as ConnectionInfo
          setConnectionInfo(connectionData)
          if (connectionData.openclawUrl) {
            setOpenclawUrl(connectionData.openclawUrl)
          }
        }

        if (budgetRes.ok) {
          const budgetData = (await budgetRes.json()) as BudgetPayload
          if (typeof budgetData.budget?.monthlyLimit === 'number') {
            setMonthlyBudget(String(budgetData.budget.monthlyLimit))
          }
        }

        if (modeRes.ok) {
          const modeData = (await modeRes.json()) as ModePayload
          setSelectedPreset(mapModeToPreset(modeData.mode))
        }

        if (vaultRes?.ok) {
          const vaultData = (await vaultRes.json()) as VaultPayload
          setExistingVaultCount(vaultData.keys?.length ?? 0)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadInitialData()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (step !== 1) return
    if (!openclawUrl.trim() || !setupPassword.trim()) {
      setConnectionState('idle')
      setConnectionResult(null)
      return
    }

    const timer = window.setTimeout(() => {
      void testConnection(true)
    }, 700)

    return () => window.clearTimeout(timer)
  }, [step, openclawUrl, setupPassword, openrouterApiKey])

  async function testConnection(silent = false) {
    if (!openclawUrl.trim() || !setupPassword.trim()) return false

    setConnectionState('testing')
    if (!silent) setConnectionError('')

    try {
      const response = await apiFetch('/api/connection/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openclawUrl: openclawUrl.trim(),
          setupPassword,
          openrouterApiKey: openrouterApiKey.trim(),
        }),
      })

      const data = (await response.json()) as ConnectionResult
      setConnectionResult(data)

      if (data.openclaw.ok) {
        setConnectionState('ready')
        return true
      }

      setConnectionState('error')
      if (!silent) {
        setConnectionError(data.openclaw.error || 'Connection test failed.')
      }
      return false
    } catch {
      setConnectionState('error')
      if (!silent) {
        setConnectionError('Connection test failed. Check that Mission Control can reach your OpenClaw instance.')
      }
      return false
    }
  }

  async function handleConnectionContinue() {
    setConnectionError('')

    const liveOk = await testConnection(false)
    if (!liveOk) return

    setSavingConnection(true)
    try {
      const response = await apiFetch('/api/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openclawUrl: openclawUrl.trim(),
          setupPassword,
          openrouterApiKey: openrouterApiKey.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Could not save connection settings.' }))
        setConnectionError(data.error || 'Could not save connection settings.')
        return
      }

      setStep(2)
    } catch {
      setConnectionError('Could not save connection settings.')
    } finally {
      setSavingConnection(false)
    }
  }

  async function handleBudgetContinue() {
    const monthlyValue = Number(monthlyBudget)
    if (!Number.isFinite(monthlyValue) || monthlyValue <= 0) {
      setBudgetError('Enter a monthly budget limit greater than zero.')
      return
    }

    setBudgetError('')
    setSavingBudget(true)
    try {
      const [budgetRes, modeRes] = await Promise.all([
        apiFetch('/api/budget', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ monthlyLimit: monthlyValue }),
        }),
        apiFetch('/api/mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: selectedPresetConfig.mode }),
        }),
      ])

      if (!budgetRes.ok) {
        const data = await budgetRes.json().catch(() => ({ error: 'Could not save budget settings.' }))
        setBudgetError(data.error || 'Could not save budget settings.')
        return
      }

      if (!modeRes.ok) {
        const data = await modeRes.json().catch(() => ({ error: 'Could not apply the selected preset.' }))
        setBudgetError(data.error || 'Could not apply the selected preset.')
        return
      }

      setStep(3)
    } catch {
      setBudgetError('Could not save the budget and preset selections.')
    } finally {
      setSavingBudget(false)
    }
  }

  async function handleVaultContinue() {
    const entries = [
      { name: 'OpenRouter Key', key: vaultKeys.openrouter.trim() },
      { name: 'Anthropic Key', key: vaultKeys.anthropic.trim() },
      { name: 'OpenAI Key', key: vaultKeys.openai.trim() },
    ].filter((entry) => entry.key)

    setVaultError('')
    setSavingVault(true)

    try {
      for (const entry of entries) {
        const response = await apiFetch('/api/key-vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        })

        if (response.status === 409) {
          continue
        }

        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: `Could not store ${entry.name}.` }))
          setVaultError(data.error || `Could not store ${entry.name}.`)
          return
        }
      }

      setStep(4)
    } catch {
      setVaultError('Could not store the selected keys.')
    } finally {
      setSavingVault(false)
    }
  }

  async function completeOnboarding() {
    setCompletionError('')
    setFinishing(true)

    try {
      const nextSettings = { ...settings, onboardingComplete: true }
      const response = await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextSettings),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Could not finalize onboarding.' }))
        setCompletionError(data.error || 'Could not finalize onboarding.')
        return
      }

      applySettings(nextSettings)
      router.push('/')
      router.refresh()
    } catch {
      setCompletionError('Could not finalize onboarding.')
    } finally {
      setFinishing(false)
    }
  }

  function skipCurrentStep() {
    setStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  const canContinueConnection = connectionState === 'ready' && !savingConnection
  const currentStep = STEPS[step]
  const CurrentStepIcon = currentStep.icon

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-7rem)] flex items-center justify-center">
        <div className="glass rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] px-6 py-5 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--accent-primary)]" />
          <span className="text-sm text-text-secondary">Loading onboarding...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-7rem)]">
      <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden rounded-[28px] border border-[var(--glass-border)] bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_36%),rgba(255,255,255,0.04)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(9,9,11,0.18))]" />
          <div className="relative space-y-8">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-white/[0.05] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-text-secondary">
                  {stepCopy[step].kicker}
                </div>
                <div className="space-y-3">
                  <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-text-primary">
                    {stepCopy[step].title}
                  </h1>
                  <p className="max-w-xl text-sm leading-7 text-text-secondary">
                    {stepCopy[step].body}
                  </p>
                </div>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-white/[0.07]">
                <CurrentStepIcon className="h-6 w-6 text-[var(--accent-primary)]" />
              </div>
            </div>

            <ProgressBar value={progress} className="max-w-md" showLabel />

            <div className="grid gap-3 md:grid-cols-5">
              {STEPS.map((wizardStep, index) => {
                const Icon = wizardStep.icon
                const isActive = index === step
                const isDone = index < step

                return (
                  <div
                    key={wizardStep.title}
                    className={classNames(
                      'rounded-2xl border p-3 transition-all duration-300',
                      isActive
                        ? 'border-[var(--accent-primary)] bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.05)]'
                        : isDone
                          ? 'border-emerald-400/20 bg-emerald-400/10'
                          : 'border-[var(--glass-border)] bg-white/[0.03]',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={classNames(
                          'flex h-8 w-8 items-center justify-center rounded-xl border',
                          isActive
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                            : isDone
                              ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-300'
                              : 'border-[var(--glass-border)] bg-white/[0.04] text-text-muted',
                        )}
                      >
                        {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                          {wizardStep.eyebrow}
                        </p>
                        <p className="truncate text-sm font-medium text-text-primary">{wizardStep.title}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FeatureTile
                icon={<Plug className="h-4 w-4" />}
                title="Connected by design"
                body="Mission Control tests your OpenClaw URL live before it writes the connection locally."
              />
              <FeatureTile
                icon={<Shield className="h-4 w-4" />}
                title="Budget guardrails"
                body="We start with an explicit monthly limit and a model preset instead of leaving spend undefined."
              />
              <FeatureTile
                icon={<KeyRound className="h-4 w-4" />}
                title="Local vault only"
                body="Provider keys stay on this machine so you can sell privacy as part of the product story."
              />
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--glass-border)] bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
          <div
            key={step}
            className="animate-in fade-in-0 slide-in-from-right-4 duration-300 space-y-6"
          >
            {step === 0 && (
              <>
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold text-text-primary">What this setup covers</h2>
                  <p className="text-sm leading-7 text-text-secondary">
                    In the next few screens we’ll connect OpenClaw, set the starting budget posture, and optionally preload provider keys so the app feels ready from the first dashboard visit.
                  </p>
                </div>

                <div className="grid gap-3">
                  <HighlightRow
                    title="Connect your control plane"
                    description="Save the OpenClaw URL and setup password with an inline health check before continuing."
                  />
                  <HighlightRow
                    title="Pick your default spend profile"
                    description="Set a monthly limit and choose between fast, balanced, or quality-oriented routing."
                  />
                  <HighlightRow
                    title="Optionally preload API keys"
                    description="Import the provider keys you already have so the vault is useful on day one."
                  />
                </div>

                <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4 text-sm text-text-secondary">
                  <p>
                    If you’ve already configured part of the app, we’ll prefill what we can. You can also skip any optional step and come back from settings later.
                  </p>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  >
                    Start setup
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="space-y-4">
                  <Field
                    label="OpenClaw URL"
                    hint="Your Railway or self-hosted OpenClaw base URL."
                    value={openclawUrl}
                    onChange={setOpenclawUrl}
                    placeholder="https://your-openclaw.up.railway.app"
                    type="url"
                  />
                  <Field
                    label="Setup Password"
                    hint="The OPENCLAW_SETUP_PASSWORD value from your deployment."
                    value={setupPassword}
                    onChange={setSetupPassword}
                    placeholder="Paste your setup password"
                    type="password"
                  />
                  <Field
                    label="OpenRouter API Key (optional)"
                    hint="Only needed if you want cost tracking and provider validation right away."
                    value={openrouterApiKey}
                    onChange={setOpenrouterApiKey}
                    placeholder="sk-or-v1-..."
                    type="password"
                  />
                </div>

                <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-text-primary">Connection status</p>
                      <p className="text-xs text-text-muted">
                        {connectionInfo?.configured
                          ? 'An existing connection was found and prefilled.'
                          : 'We’ll keep testing while you type.'}
                      </p>
                    </div>
                    <button
                      onClick={() => void testConnection(false)}
                      disabled={!openclawUrl.trim() || !setupPassword.trim() || connectionState === 'testing'}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {connectionState === 'testing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                      Test now
                    </button>
                  </div>

                  <ConnectionStatus
                    state={connectionState}
                    result={connectionResult}
                    error={connectionError}
                  />
                </div>

                <WizardFooter
                  showBack
                  showSkip
                  onBack={() => setStep(0)}
                  onSkip={skipCurrentStep}
                  primaryLabel={savingConnection ? 'Saving...' : 'Save connection'}
                  primaryIcon={savingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  onPrimary={() => void handleConnectionContinue()}
                  primaryDisabled={!canContinueConnection}
                />
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid gap-4">
                  <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4">
                    <label className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
                      Monthly budget limit
                    </label>
                    <div className="mt-3 flex items-end gap-3">
                      <div className="rounded-xl border border-[var(--glass-border)] bg-white/[0.05] px-3 py-2 text-text-muted">$</div>
                      <input
                        type="number"
                        min="1"
                        value={monthlyBudget}
                        onChange={(event) => setMonthlyBudget(event.target.value)}
                        className="w-full rounded-xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-[var(--accent-primary)]"
                        placeholder="250"
                      />
                    </div>
                    <p className="mt-2 text-xs text-text-muted">
                      This becomes the starting monthly ceiling for alerts and budget controls.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">Model preset</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Pick the default quality posture Mission Control should apply on day one.
                      </p>
                    </div>

                    <div className="grid gap-3">
                      {PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => setSelectedPreset(preset.id)}
                          className={classNames(
                            'rounded-2xl border p-4 text-left transition-all',
                            selectedPreset === preset.id
                              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                              : 'border-[var(--glass-border)] bg-white/[0.03] hover:bg-white/[0.05]',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-text-primary">{preset.label}</p>
                                <span className="rounded-full border border-[var(--glass-border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                                  {preset.mode}
                                </span>
                              </div>
                              <p className="mt-1 text-xs font-medium text-text-secondary">{preset.subtitle}</p>
                              <p className="mt-2 text-sm leading-6 text-text-secondary">{preset.detail}</p>
                            </div>
                            {selectedPreset === preset.id ? (
                              <BadgeCheck className="h-5 w-5 text-[var(--accent-primary)]" />
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {budgetError ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {budgetError}
                  </div>
                ) : null}

                <WizardFooter
                  showBack
                  showSkip
                  onBack={() => setStep(1)}
                  onSkip={skipCurrentStep}
                  primaryLabel={savingBudget ? 'Saving...' : 'Save budget & preset'}
                  primaryIcon={savingBudget ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  onPrimary={() => void handleBudgetContinue()}
                  primaryDisabled={savingBudget}
                />
              </>
            )}

            {step === 3 && (
              <>
                <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-text-primary">
                    {existingVaultCount > 0
                      ? `${existingVaultCount} key${existingVaultCount === 1 ? '' : 's'} already in your vault`
                      : 'Your vault is empty right now'}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Import any keys you want Mission Control to manage locally. Leave fields empty if you’d rather do this later.
                  </p>
                </div>

                <div className="grid gap-4">
                  <Field
                    label="OpenRouter key"
                    hint="Useful if you want cost dashboards and provider validation right away."
                    value={vaultKeys.openrouter}
                    onChange={(value) => setVaultKeys((current) => ({ ...current, openrouter: value }))}
                    placeholder="sk-or-v1-..."
                    type="password"
                  />
                  <Field
                    label="Anthropic key"
                    hint="Optional. Good if you route directly to Anthropic from this machine."
                    value={vaultKeys.anthropic}
                    onChange={(value) => setVaultKeys((current) => ({ ...current, anthropic: value }))}
                    placeholder="sk-ant-..."
                    type="password"
                  />
                  <Field
                    label="OpenAI key"
                    hint="Optional. Add it now if OpenAI-backed workflows are part of your default setup."
                    value={vaultKeys.openai}
                    onChange={(value) => setVaultKeys((current) => ({ ...current, openai: value }))}
                    placeholder="sk-..."
                    type="password"
                  />
                </div>

                {vaultError ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {vaultError}
                  </div>
                ) : null}

                <WizardFooter
                  showBack
                  showSkip
                  onBack={() => setStep(2)}
                  onSkip={skipCurrentStep}
                  primaryLabel={savingVault ? 'Saving...' : 'Import selected keys'}
                  primaryIcon={savingVault ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  onPrimary={() => void handleVaultContinue()}
                  primaryDisabled={savingVault}
                />
              </>
            )}

            {step === 4 && (
              <>
                <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/15">
                      <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-semibold text-text-primary">Mission Control is ready.</h2>
                      <p className="text-sm leading-7 text-text-secondary">
                        Connection, budget posture, and optional vault import are all in place. The only thing left is marking this first-run flow complete.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <SummaryRow label="OpenClaw" value={openclawUrl || 'Skipped for now'} />
                  <SummaryRow label="Budget ceiling" value={`$${monthlyBudget || '0'} / month`} />
                  <SummaryRow label="Preset" value={selectedPresetConfig.label} />
                  <SummaryRow
                    label="Vault import"
                    value={
                      [vaultKeys.openrouter, vaultKeys.anthropic, vaultKeys.openai].filter(Boolean).length > 0
                        ? `${[vaultKeys.openrouter, vaultKeys.anthropic, vaultKeys.openai].filter(Boolean).length} key(s) queued`
                        : existingVaultCount > 0
                          ? `${existingVaultCount} existing key(s)`
                          : 'Skipped for now'
                    }
                  />
                </div>

                {completionError ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {completionError}
                  </div>
                ) : null}

                <WizardFooter
                  showBack
                  onBack={() => setStep(3)}
                  primaryLabel={finishing ? 'Finishing...' : 'Go to Dashboard'}
                  primaryIcon={finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  onPrimary={() => void completeOnboarding()}
                  primaryDisabled={finishing}
                />
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: 'text' | 'url' | 'password' | 'number'
}) {
  return (
    <label className="block space-y-2">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">{label}</p>
        <p className="text-xs text-text-secondary">{hint}</p>
      </div>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted/55 focus:border-[var(--accent-primary)]"
      />
    </label>
  )
}

function FeatureTile({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.04] p-4">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-white/[0.04] text-[var(--accent-primary)]">
        {icon}
      </div>
      <p className="text-sm font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-sm leading-6 text-text-secondary">{body}</p>
    </div>
  )
}

function HighlightRow({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3">
      <p className="text-sm font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
    </div>
  )
}

function ConnectionStatus({
  state,
  result,
  error,
}: {
  state: 'idle' | 'testing' | 'ready' | 'error'
  result: ConnectionResult | null
  error: string
}) {
  if (state === 'testing') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-sm text-sky-100">
        <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
        Testing your OpenClaw connection...
      </div>
    )
  }

  if (state === 'ready' && result?.openclaw.ok) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          Connected to OpenClaw{result.openclaw.version ? ` · ${result.openclaw.version}` : ''}
        </div>
        {result.openrouter.ok ? (
          <div className="flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-sm text-violet-100">
            <Zap className="h-4 w-4 text-violet-300" />
            OpenRouter key verified · ${result.openrouter.credits.toFixed(2)} remaining
          </div>
        ) : null}
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
        {error || result?.openclaw.error || 'The connection test failed.'}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-white/[0.03] px-3 py-2 text-sm text-text-secondary">
      Enter a URL and password to start the live connection test.
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value}</span>
    </div>
  )
}

function WizardFooter({
  showBack = false,
  showSkip = false,
  onBack,
  onSkip,
  primaryLabel,
  primaryIcon,
  onPrimary,
  primaryDisabled = false,
}: {
  showBack?: boolean
  showSkip?: boolean
  onBack?: () => void
  onSkip?: () => void
  primaryLabel: string
  primaryIcon: React.ReactNode
  onPrimary: () => void
  primaryDisabled?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <div className="flex items-center gap-2">
        {showBack ? (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/[0.08]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          <div />
        )}
        {showSkip ? (
          <button
            onClick={onSkip}
            className="text-sm font-medium text-text-muted transition-colors hover:text-text-primary"
          >
            Skip for now
          </button>
        ) : null}
      </div>

      <button
        onClick={onPrimary}
        disabled={primaryDisabled}
        className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {primaryLabel}
        {primaryIcon}
      </button>
    </div>
  )
}

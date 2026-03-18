'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plug, CheckCircle2, XCircle, Loader2, Eye, EyeOff, ArrowRight, Zap, Shield, ExternalLink } from 'lucide-react'
import { FramelessPageChrome } from '@/components/layout/frameless-page-chrome'
import { BackButton } from '@/components/layout/back-button'

interface TestResults {
  openclaw: { ok: boolean; error: string; version: string }
  openrouter: { ok: boolean; error: string; credits: number }
}

export default function SetupPage() {
  const router = useRouter()
  const [openclawUrl, setOpenclawUrl] = useState('')
  const [setupPassword, setSetupPassword] = useState('')
  const [openrouterApiKey, setOpenrouterApiKey] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [testResults, setTestResults] = useState<TestResults | null>(null)
  const [alreadyConfigured, setAlreadyConfigured] = useState(false)
  const [step, setStep] = useState(1) // 1 = welcome, 2 = configure
  const [hasHistory, setHasHistory] = useState(false)
  const [isReconfiguring, setIsReconfiguring] = useState(false)
  const [initError, setInitError] = useState('')

  // Check if already configured
  useEffect(() => {
    const reconfiguring = window.location.search.includes('reconfigure')
    setIsReconfiguring(reconfiguring)
    setHasHistory(window.history.length > 1)

    fetch('/api/connection')
      .then(r => r.json())
      .then(data => {
        if (data.configured && !reconfiguring) {
          setAlreadyConfigured(true)
          router.push('/')
        }
        if (data.openclawUrl) {
          setOpenclawUrl(data.openclawUrl)
          setStep(2) // Skip welcome if reconfiguring
        }
      })
      .catch(() => {
        // App API unreachable — show setup form anyway so user isn't stuck
        // This can happen during first launch while the server is still starting
        setInitError('The app is still starting up. If this persists, restart Mission Control.')
      })
  }, [router])

  async function testConnection() {
    setTesting(true)
    setTestResults(null)
    try {
      const res = await fetch('/api/connection/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openclawUrl, setupPassword, openrouterApiKey }),
      })
      const data = await res.json()
      setTestResults(data)
    } catch {
      setTestResults({
        openclaw: { ok: false, error: 'Request failed', version: '' },
        openrouter: { ok: false, error: 'Request failed', credits: 0 },
      })
    }
    setTesting(false)
  }

  async function saveAndContinue() {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openclawUrl, setupPassword, openrouterApiKey }),
      })
      if (res.ok) {
        router.push('/')
      } else {
        const data = await res.json().catch(() => ({}))
        setSaveError(data.error || 'Could not save settings. Please try again.')
      }
    } catch {
      setSaveError('Could not save settings. Check that the app is running and try again.')
    }
    setSaving(false)
  }

  const canTest = openclawUrl.length > 0 && setupPassword.length > 0
  const canSave = testResults?.openclaw.ok

  function goBack() {
    if (isReconfiguring) {
      if (hasHistory) {
        router.back()
      } else {
        router.push('/')
      }
      return
    }

    if (step > 1) {
      setStep(step - 1)
      return
    }

    if (hasHistory) {
      router.back()
    }
  }

  if (alreadyConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 pt-16" style={{ background: 'var(--background)' }}>
      <FramelessPageChrome />
      <div className="w-full max-w-lg space-y-8">
        <div className="flex justify-start">
          <BackButton
            fallbackHref={isReconfiguring ? '/' : undefined}
            onBack={goBack}
            disabled={!isReconfiguring && step === 1 && !hasHistory}
          />
        </div>

        {/* Init warning */}
        {initError && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-400/10 border border-amber-400/20 text-sm text-amber-400">
            <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            <span>{initError}</span>
          </div>
        )}

        {/* Step 1: Welcome */}
        {step === 1 && (
          <>
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center mx-auto">
                <Zap className="w-10 h-10" style={{ color: 'var(--accent-primary)' }} />
              </div>
              <h1 className="text-3xl font-bold text-text-primary">Welcome to Mission Control</h1>
              <p className="text-text-secondary text-sm leading-relaxed max-w-sm mx-auto">
                Your desktop dashboard for managing OpenClaw AI agents. Monitor pipelines, control costs, and switch modes — all from one place.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="glass rounded-2xl p-5 space-y-3">
              <FeatureRow icon="📡" title="Live Agent Monitoring" desc="Real-time status, heartbeat, and session tracking" />
              <FeatureRow icon="💰" title="Cost Controls" desc="Budget limits, auto-throttle, and per-job cost tracking" />
              <FeatureRow icon="⚡" title="Mode Switching" desc="Switch between performance, standard, and budget modes instantly" />
              <FeatureRow icon="📊" title="Pipeline Operations" desc="Track every step of your content pipeline" />
            </div>

            {/* What you need */}
            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">What you&apos;ll need</h3>
              <div className="space-y-2 text-sm text-text-secondary">
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                  <span>An <strong className="text-text-primary">OpenClaw instance</strong> running on Railway (or any server)</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                  <span>Your <strong className="text-text-primary">Setup Password</strong> from your deployment&apos;s environment variables</span>
                </p>
                <p className="flex items-start gap-2">
                  <Shield className="w-4 h-4 mt-0.5 text-text-muted shrink-0" />
                  <span>Optionally, an <strong className="text-text-primary">OpenRouter API key</strong> for cost tracking</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: 'var(--accent-primary)' }}
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-center text-[11px] text-text-muted">
              Your credentials are stored locally and never sent anywhere except your own OpenClaw instance.
            </p>
          </>
        )}

        {/* Step 2: Configure */}
        {step === 2 && (
          <>
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mx-auto">
                <Plug className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
              </div>
              <h1 className="text-2xl font-bold text-text-primary">Connect Your Instance</h1>
              <p className="text-text-secondary text-sm">Enter your OpenClaw deployment details below</p>
            </div>

            <div className="glass rounded-2xl p-6 space-y-5">
              {/* OpenClaw URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  OpenClaw URL
                </label>
                <input
                  type="url"
                  value={openclawUrl}
                  onChange={e => setOpenclawUrl(e.target.value)}
                  placeholder="https://your-app.up.railway.app"
                  className="w-full px-3 py-2.5 rounded-lg glass-inset text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                />
                <p className="text-[11px] text-text-muted flex items-center gap-1">
                  Your Railway deployment URL
                  <ExternalLink className="w-3 h-3 inline" />
                </p>
              </div>

              {/* Setup Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Setup Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={setupPassword}
                    onChange={e => setSetupPassword(e.target.value)}
                    placeholder="Your OPENCLAW_SETUP_PASSWORD"
                    className="w-full px-3 py-2.5 pr-10 rounded-lg glass-inset text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:ring-1"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-text-muted">Found in your Railway environment variables</p>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-text-muted/20" />
                <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Optional</span>
                <div className="flex-1 h-px bg-text-muted/20" />
              </div>

              {/* OpenRouter API Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  OpenRouter API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={openrouterApiKey}
                    onChange={e => setOpenrouterApiKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="w-full px-3 py-2.5 pr-10 rounded-lg glass-inset text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:ring-1"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-text-muted">Enables cost tracking, budget controls, and spending alerts</p>
              </div>

              {/* Test Results */}
              {testResults && (
                <div className="space-y-2 pt-1">
                  <ConnectionResult
                    label="OpenClaw"
                    ok={testResults.openclaw.ok}
                    detail={testResults.openclaw.ok ? testResults.openclaw.version : testResults.openclaw.error}
                  />
                  {openrouterApiKey && (
                    <ConnectionResult
                      label="OpenRouter"
                      ok={testResults.openrouter.ok}
                      detail={testResults.openrouter.ok ? `$${testResults.openrouter.credits.toFixed(2)} credits` : testResults.openrouter.error}
                    />
                  )}
                </div>
              )}

              {/* Save error */}
              {saveError && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-400/10 border border-red-400/20 text-sm text-red-400">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={testConnection}
                  disabled={!canTest || testing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg glass-inset text-sm font-medium text-text-primary hover:bg-text-muted/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {testing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plug className="w-4 h-4" />
                  )}
                  Test
                </button>

                <button
                  onClick={saveAndContinue}
                  disabled={!canSave || saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{
                    background: canSave ? 'var(--accent-primary)' : undefined,
                    opacity: canSave ? 1 : 0.4,
                  }}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Launch
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-center text-[11px] text-text-muted">
              Your credentials are stored locally on this device and never sent anywhere except your own OpenClaw instance.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function FeatureRow({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-lg mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="text-xs text-text-secondary">{desc}</p>
      </div>
    </div>
  )
}

function ConnectionResult({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
      ok ? 'bg-emerald-400/10 border border-emerald-400/20' : 'bg-red-400/10 border border-red-400/20'
    }`}>
      {ok ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
      )}
      <span className={ok ? 'text-emerald-400' : 'text-red-400'}>{label}</span>
      <span className="text-text-secondary ml-auto text-xs">{detail}</span>
    </div>
  )
}

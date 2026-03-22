'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Key, Loader2, CheckCircle2, AlertCircle, Zap } from 'lucide-react'
import { FramelessPageChrome } from '@/components/layout/frameless-page-chrome'

declare global {
  interface Window {
    electronAPI?: {
      checkLicense: () => Promise<{ valid: boolean; email: string | null }>
      activateLicense: (data: { key: string; email: string }) => Promise<{ ok: boolean; error?: string }>
    }
  }
}

export default function ActivatePage() {
  const router = useRouter()
  const pricingUrl = process.env.NEXT_PUBLIC_MISSION_CONTROL_PRICING_URL || 'https://orqpilot.com/pricing/'
  const [licenseKey, setLicenseKey] = useState('')
  const [email, setEmail] = useState('')
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // If not running in Electron, skip activation
    if (!window.electronAPI?.checkLicense) {
      router.push('/setup')
      return
    }

    // Check if already activated
    window.electronAPI.checkLicense()
      .then(result => {
        if (result.valid) {
          router.push('/setup')
        } else {
          setChecking(false)
        }
      })
      .catch(() => {
        // License check IPC failed — show the form so the user isn't stuck
        setChecking(false)
      })
  }, [router])

  // Auto-format license key: MC-XXXXX-XXXXX-XXXXX-XXXXX
  function handleKeyChange(value: string) {
    const clean = value.toUpperCase().replace(/[^A-Z0-9-]/g, '')
    // Auto-insert dashes in groups of 5
    const parts = clean.replace(/^MC-?/, '').replace(/-/g, '')
    let formatted = 'MC-'
    for (let i = 0; i < Math.min(parts.length, 20); i++) {
      if (i > 0 && i % 5 === 0) formatted += '-'
      formatted += parts[i]
    }
    setLicenseKey(formatted)
  }

  async function activate() {
    if (!window.electronAPI?.activateLicense) return
    setActivating(true)
    setError('')

    try {
      const result = await window.electronAPI.activateLicense({ key: licenseKey, email })
      if (result.ok) {
        router.push('/setup')
      } else {
        const rawError = result.error || 'Activation failed'
        // Provide actionable context for common errors
        if (rawError.toLowerCase().includes('invalid') || rawError.toLowerCase().includes('not found')) {
          setError('Invalid license key. Double-check the key from your purchase confirmation email.')
        } else if (rawError.toLowerCase().includes('expired')) {
          setError('This license has expired. Visit openclaw.dev/mission-control to renew.')
        } else if (rawError.toLowerCase().includes('machine') || rawError.toLowerCase().includes('fingerprint')) {
          setError('This key is already activated on another device. Contact support@orqpilot.com for help.')
        } else {
          setError('Activation could not be completed. Verify your license details and try again.')
        }
      }
    } catch {
      setError('Something went wrong during activation. Please try again.')
    }
    setActivating(false)
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 pt-16" style={{ background: 'var(--background)' }}>
      <FramelessPageChrome />
      <div className="w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mx-auto">
            <Zap className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">Mission Control</h1>
          <p className="text-text-secondary text-sm">Mission Control by OrqPilot · enter your license key to get started</p>
        </div>

        {/* Activation Form */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">License Key</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={licenseKey}
                onChange={e => handleKeyChange(e.target.value)}
                placeholder="MC-XXXXX-XXXXX-XXXXX-XXXXX"
                className="w-full pl-10 pr-3 py-2.5 rounded-lg glass-inset text-text-primary text-sm font-mono placeholder:text-text-muted/50 focus:outline-none focus:ring-1"
                maxLength={24}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 rounded-lg glass-inset text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:ring-1"
            />
            <p className="text-[11px] text-text-muted">For license recovery and updates</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-400/10 border border-red-400/20 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={activate}
            disabled={licenseKey.length < 24 || !email || activating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent-primary)' }}
          >
            {activating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Activate License
          </button>
        </div>

        {/* Purchase link */}
        <p className="text-center text-[11px] text-text-muted">
          Don&apos;t have a license?{' '}
          <a href={pricingUrl} target="_blank" rel="noreferrer" className="text-text-secondary hover:text-text-primary underline">
            Purchase one here
          </a>
        </p>
      </div>
    </div>
  )
}

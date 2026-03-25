'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, CreditCard, Download, Loader2 } from 'lucide-react'

type CheckoutPlan = {
  id: 'personal' | 'pro' | 'team'
  name: string
  priceUsd: number
  machineLimit: number
  updateTerm: string
}

interface CheckoutFormProps {
  plans: CheckoutPlan[]
  initialPlanId: CheckoutPlan['id']
  wasCanceled: boolean
  pricingUrl: string
  downloadUrl: string
}

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

function formatMachineLimit(limit: number) {
  return `${limit} machine${limit === 1 ? '' : 's'}`
}

export function CheckoutForm({
  plans,
  initialPlanId,
  wasCanceled,
  pricingUrl,
  downloadUrl,
}: CheckoutFormProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<CheckoutPlan['id']>(initialPlanId)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || plans[0],
    [plans, selectedPlanId],
  )

  async function startCheckout() {
    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/commerce/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedPlan.id,
          email: email.trim(),
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.url) {
        setError(typeof data.error === 'string' ? data.error : 'Could not start checkout')
        setSubmitting(false)
        return
      }

      window.location.href = data.url as string
    } catch {
      setError('Could not reach the checkout service. Try again in a moment.')
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-text-primary">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-muted">
            Mission Control by OrqPilot
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Choose your Mission Control plan</h1>
          <p className="mx-auto max-w-2xl text-sm text-text-secondary">
            This page is the handoff between OrqPilot&apos;s public website and checkout. Pick a plan,
            confirm the email you want tied to license recovery, and we&apos;ll redirect you to Stripe.
          </p>
        </div>

        {wasCanceled ? (
          <div
            className="mx-auto max-w-3xl rounded-2xl border px-4 py-3 text-sm text-amber-200"
            style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.28)' }}
          >
            Checkout was canceled before payment completed. Your order was not charged. You can pick up where
            you left off below.
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <section className="glass rounded-3xl p-6">
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => {
                const selected = plan.id === selectedPlan.id
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className="rounded-2xl border p-5 text-left electron-no-drag"
                    style={{
                      borderColor: selected ? 'var(--accent-primary)' : 'var(--glass-border)',
                      background: selected ? 'rgba(59, 130, 246, 0.08)' : 'var(--glass-bg)',
                      boxShadow: selected ? '0 0 0 1px rgba(59, 130, 246, 0.2) inset' : 'none',
                    }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">{plan.name}</p>
                    <p className="mt-2 text-3xl font-bold tracking-tight">{usdFormatter.format(plan.priceUsd)}</p>
                    <p className="mt-1 text-sm text-text-secondary">{formatMachineLimit(plan.machineLimit)}</p>
                    <p className="mt-4 text-sm text-text-secondary">{plan.updateTerm}</p>
                  </button>
                )
              })}
            </div>

            <div className="mt-6 rounded-2xl border p-5 glass-inset">
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                Email for license recovery
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-3 w-full rounded-xl border px-4 py-3 text-sm text-text-primary outline-none"
                style={{ borderColor: 'var(--glass-border)', background: 'transparent' }}
              />
              <p className="mt-2 text-xs text-text-muted">
                Recommended. Stripe can still collect an email if you leave this blank, but supplying it here
                makes license recovery cleaner.
              </p>
            </div>

            {error ? (
              <div
                className="mt-4 rounded-2xl border px-4 py-3 text-sm"
                style={{
                  background: 'rgba(248, 113, 113, 0.08)',
                  borderColor: 'rgba(248, 113, 113, 0.25)',
                  color: 'var(--status-error)',
                }}
              >
                {error}
              </div>
            ) : null}
          </section>

          <aside className="glass rounded-3xl p-6">
            <div className="rounded-2xl border p-5 glass-inset">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Selected Plan</p>
              <h2 className="mt-2 text-2xl font-bold">{selectedPlan.name}</h2>
              <p className="mt-1 text-sm text-text-secondary">
                {usdFormatter.format(selectedPlan.priceUsd)} one-time - {formatMachineLimit(selectedPlan.machineLimit)}
              </p>
              <p className="mt-4 text-sm text-text-secondary">{selectedPlan.updateTerm}</p>
            </div>

            <button
              type="button"
              onClick={() => void startCheckout()}
              disabled={submitting}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: 'var(--accent-primary)' }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Continue to Stripe
            </button>

            <div className="mt-4 space-y-3 text-sm text-text-secondary">
              <p>After payment, you&apos;ll be returned here to copy your license key and download the installer.</p>
              <p>Prefer to inspect the installer first? Download it now, then activate with a paid license after checkout.</p>
              <p>Your checkout email is tied to license recovery if you ever lose the key.</p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={downloadUrl}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium text-text-primary"
                style={{ borderColor: 'var(--glass-border)' }}
              >
                <Download className="h-4 w-4" />
                Download first
              </a>
              <a
                href={pricingUrl}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium text-text-primary"
                style={{ borderColor: 'var(--glass-border)' }}
              >
                Back to pricing
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

import { findLicenseOrderBySessionId, getMissionControlDownloadUrl, getMissionControlPricingUrl } from '@/lib/billing'

export default async function PurchaseSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const sessionIdValue = params.session_id
  const sessionId = Array.isArray(sessionIdValue) ? sessionIdValue[0] : sessionIdValue
  const order = sessionId ? await findLicenseOrderBySessionId(sessionId) : null
  const fulfilledOrder = order?.status === 'fulfilled' && order.licenseKey ? order : null
  const pricingUrl = getMissionControlPricingUrl()
  const downloadUrl = getMissionControlDownloadUrl()

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-text-primary">
      <div className="mx-auto max-w-3xl rounded-3xl border p-8 shadow-2xl" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Purchase Complete</p>
          <h1 className="text-4xl font-bold tracking-tight">Your Mission Control license is ready</h1>
          <p className="max-w-2xl text-sm text-text-secondary">
            Keep this page until you activate Mission Control. Once the payment webhook has been received, your license key appears below.
          </p>
        </div>

        {!sessionId ? (
          <div className="mt-8 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-200">
            Missing Stripe session id. Return to the checkout confirmation email or contact support if your payment completed.
          </div>
        ) : !order || !fulfilledOrder ? (
          <div className="mt-8 rounded-2xl border border-blue-400/25 bg-blue-400/10 p-4 text-sm text-blue-200">
            Payment completed, but fulfillment has not finished yet. Refresh this page in a moment. Stripe webhooks can take a few seconds to arrive.
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-[1.6fr_1fr]">
            <section className="rounded-2xl border p-5" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">License Key</p>
              <div className="mt-3 rounded-xl border px-4 py-3 font-mono text-lg" style={{ borderColor: 'var(--glass-border)', background: 'rgba(255,255,255,0.03)' }}>
                {fulfilledOrder.licenseKey}
              </div>
              <p className="mt-3 text-sm text-text-secondary">
                Activate this key inside Mission Control using <span className="font-medium text-text-primary">{fulfilledOrder.email}</span>.
              </p>
            </section>

            <section className="rounded-2xl border p-5" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Order Summary</p>
              <dl className="mt-3 space-y-2 text-sm text-text-secondary">
                <div className="flex justify-between gap-4"><dt>Plan</dt><dd className="text-text-primary">{fulfilledOrder.planName}</dd></div>
                <div className="flex justify-between gap-4"><dt>Email</dt><dd className="text-text-primary">{fulfilledOrder.email}</dd></div>
                <div className="flex justify-between gap-4"><dt>Status</dt><dd className="text-text-primary">{fulfilledOrder.status}</dd></div>
              </dl>
            </section>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={downloadUrl}
            className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium text-white"
            style={{ background: 'var(--accent-primary)' }}
          >
            Download Mission Control
          </a>
          <a
            href={pricingUrl}
            className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium text-text-primary"
            style={{ borderColor: 'var(--glass-border)' }}
          >
            Back to Pricing
          </a>
        </div>
      </div>
    </main>
  )
}

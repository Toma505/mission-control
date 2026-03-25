import { cookies } from 'next/headers'

import {
  findLicenseOrderBySuccessAccess,
  getMissionControlDownloadUrl,
  getMissionControlPricingUrl,
  getPurchaseSuccessCookieName,
} from '@/lib/billing'

export default async function PurchaseSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const cookieStore = await cookies()
  const sessionIdValue = params.session_id
  const sessionId = Array.isArray(sessionIdValue) ? sessionIdValue[0] : sessionIdValue
  const successAccessToken = cookieStore.get(getPurchaseSuccessCookieName())?.value?.trim() || ''
  const order = sessionId && successAccessToken
    ? await findLicenseOrderBySuccessAccess(sessionId, successAccessToken)
    : null
  const fulfilledOrder = order?.status === 'fulfilled' && order.licenseKey ? order : null
  const refundedOrder = order?.status === 'refunded' ? order : null
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
            Missing Stripe session id. Return to the purchase success page or contact support if your payment completed.
          </div>
        ) : !successAccessToken ? (
          <div className="mt-8 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-200">
            For security, license details can only be viewed in the same browser used to complete checkout. Return to the original checkout browser or contact support using the purchase email for recovery.
          </div>
        ) : refundedOrder ? (
          <div className="mt-8 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-200">
            This purchase has been marked as refunded. If you believe this was a mistake, contact support and include the checkout email for review.
          </div>
        ) : !order ? (
          <div className="mt-8 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-200">
            We could not verify access to this purchase in the current browser session. Contact support with the checkout email if you need the license recovered.
          </div>
        ) : !fulfilledOrder ? (
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
              <p className="mt-2 text-sm text-text-secondary">
                Keep the key somewhere safe. Support can recover the purchase using the checkout email above.
              </p>
              {fulfilledOrder.emailDeliveryStatus === 'sent' ? (
                <p className="mt-2 text-sm text-emerald-300">
                  A copy of this license was emailed to {fulfilledOrder.email}.
                </p>
              ) : fulfilledOrder.emailDeliveryStatus === 'failed' ? (
                <p className="mt-2 text-sm text-amber-300">
                  We could not email a copy automatically. Use this page or contact support for recovery.
                </p>
              ) : fulfilledOrder.emailDeliveryStatus === 'disabled' ? (
                <p className="mt-2 text-sm text-text-secondary">
                  Keep this page open until you save the key. Automatic email delivery is not configured yet.
                </p>
              ) : null}
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

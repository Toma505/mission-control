import { NextRequest, NextResponse } from 'next/server'

import {
  fulfillStripeCheckoutSession,
  markStripeSessionStatus,
  getStripeWebhookSecret,
  updateLicenseOrderEmailDelivery,
  type StripeCheckoutSessionLike,
} from '@/lib/billing'
import { isLicenseEmailConfigured, sendLicenseOrderEmail } from '@/lib/license-email'
import { sanitizeError } from '@/lib/sanitize-error'
import { verifyStripeWebhookSignature, type StripeWebhookEnvelope } from '@/lib/stripe-webhooks'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toStripeCheckoutSession(value: unknown): StripeCheckoutSessionLike | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null
  }

  return value as unknown as StripeCheckoutSessionLike
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!verifyStripeWebhookSignature(payload, signature, getStripeWebhookSecret())) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
    }

    const event = JSON.parse(payload) as StripeWebhookEnvelope
    const session = toStripeCheckoutSession(event.data?.object)
    if (!session) {
      return NextResponse.json({ error: 'Invalid checkout session payload' }, { status: 400 })
    }

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const order = await fulfillStripeCheckoutSession(session)

        if (!isLicenseEmailConfigured()) {
          await updateLicenseOrderEmailDelivery(session.id, {
            status: 'disabled',
            error: 'SMTP email delivery is not configured.',
          })
          return NextResponse.json({ ok: true, orderId: order.id, emailDelivery: 'disabled' })
        }

        try {
          await sendLicenseOrderEmail(order)
          await updateLicenseOrderEmailDelivery(session.id, {
            status: 'sent',
            sentAt: new Date().toISOString(),
            error: null,
          })
          return NextResponse.json({ ok: true, orderId: order.id, emailDelivery: 'sent' })
        } catch (error) {
          await updateLicenseOrderEmailDelivery(session.id, {
            status: 'failed',
            error: sanitizeError(error, 'Failed to send purchase email'),
          })
          return NextResponse.json({ ok: true, orderId: order.id, emailDelivery: 'failed' })
        }
      }
      case 'checkout.session.expired': {
        await markStripeSessionStatus(session.id, 'expired')
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ ok: true, ignored: true })
    }
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to process webhook') },
      { status: 500 },
    )
  }
}

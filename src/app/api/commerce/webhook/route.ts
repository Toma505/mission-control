import { NextRequest, NextResponse } from 'next/server'

import { fulfillStripeCheckoutSession, markStripeSessionStatus, getStripeWebhookSecret, type StripeCheckoutSessionLike } from '@/lib/billing'
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
        return NextResponse.json({ ok: true, orderId: order.id })
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

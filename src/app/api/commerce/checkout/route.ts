import { NextRequest, NextResponse } from 'next/server'

import { createPendingStripeOrder, getBillingPlan, getMissionControlSiteUrl, getStripePriceId, getStripeSecretKey, listBillingPlans } from '@/lib/billing'
import { sanitizeError } from '@/lib/sanitize-error'

function buildCheckoutForm(planId: 'personal' | 'pro' | 'team', email: string) {
  const siteUrl = getMissionControlSiteUrl()
  const params = new URLSearchParams()

  params.set('mode', 'payment')
  params.set('success_url', `${siteUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`)
  params.set('cancel_url', `${siteUrl}/purchase/checkout?checkout=canceled&plan=${planId}`)
  params.set('allow_promotion_codes', 'true')
  params.set('line_items[0][price]', getStripePriceId(planId))
  params.set('line_items[0][quantity]', '1')
  params.set('metadata[planId]', planId)
  params.set('metadata[product]', 'mission-control')
  params.set('metadata[fulfillment]', 'offline-hmac-license')

  if (email) {
    params.set('customer_email', email)
  }

  return params
}

export async function GET() {
  return NextResponse.json({
    provider: 'stripe',
    plans: listBillingPlans(),
  })
}

export async function POST(request: NextRequest) {
  try {
    let body: { planId?: string; email?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const plan = getBillingPlan(body.planId || '')
    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getStripeSecretKey()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildCheckoutForm(plan.id, (body.email || '').trim()).toString(),
    })

    const text = await response.text()
    if (!response.ok) {
      return NextResponse.json(
        { error: process.env.NODE_ENV === 'development' ? `Failed to create checkout session: ${text.slice(0, 200)}` : 'Failed to create checkout session' },
        { status: 502 },
      )
    }

    const session = JSON.parse(text) as { id?: string; url?: string }
    if (!session.url || !session.id) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 502 })
    }

    await createPendingStripeOrder({
      sessionId: session.id,
      planId: plan.id,
      email: (body.email || '').trim(),
    })

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      url: session.url,
      provider: 'stripe',
      plan,
    })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to start checkout') },
      { status: 500 },
    )
  }
}

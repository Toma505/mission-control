import { NextRequest, NextResponse } from 'next/server'

import {
  findLicenseOrderByKey,
  findLicenseOrderBySessionId,
  findLicenseOrdersByEmail,
  listRecentLicenseOrders,
  updateLicenseOrderEmailDelivery,
} from '@/lib/billing'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { isLicenseEmailConfigured, sendLicenseOrderEmail } from '@/lib/license-email'
import { sanitizeError } from '@/lib/sanitize-error'

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id')?.trim()

    if (sessionId) {
      const order = await findLicenseOrderBySessionId(sessionId)
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      return NextResponse.json({ order })
    }

    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to read order') },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    let body: {
      action?: 'lookup' | 'resend'
      email?: string
      sessionId?: string
      licenseKey?: string
      limit?: number
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const sessionId = body.sessionId?.trim()
    const email = body.email?.trim()
    const licenseKey = body.licenseKey?.trim()

    if (body?.action === 'resend') {
      if (!isLicenseEmailConfigured()) {
        return NextResponse.json({ error: 'SMTP email delivery is not configured' }, { status: 503 })
      }

      const sessionOrder = sessionId ? await findLicenseOrderBySessionId(sessionId) : null
      const keyOrder = !sessionOrder && licenseKey ? await findLicenseOrderByKey(licenseKey) : null
      const emailOrders = !sessionOrder && !keyOrder && email ? await findLicenseOrdersByEmail(email) : []
      const order = sessionOrder || keyOrder || (emailOrders.length === 1 ? emailOrders[0] : null)

      if (!order) {
        if (emailOrders.length > 1) {
          return NextResponse.json(
            { error: 'Multiple orders matched that email. Use a session id or license key.' },
            { status: 400 },
          )
        }
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      if (!order.licenseKey) {
        return NextResponse.json({ error: 'Order has not been fulfilled yet' }, { status: 409 })
      }

      try {
        await sendLicenseOrderEmail(order)
        const updated = await updateLicenseOrderEmailDelivery(order.stripeSessionId, {
          status: 'sent',
          sentAt: new Date().toISOString(),
          error: null,
        })
        return NextResponse.json({ ok: true, order: updated || order })
      } catch (error) {
        const updated = await updateLicenseOrderEmailDelivery(order.stripeSessionId, {
          status: 'failed',
          error: sanitizeError(error, 'Failed to resend purchase email'),
        })
        return NextResponse.json(
          { error: sanitizeError(error, 'Failed to resend purchase email'), order: updated || order },
          { status: 502 },
        )
      }
    }

    if (body?.action !== 'lookup') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
    }

    if (sessionId) {
      const order = await findLicenseOrderBySessionId(sessionId)
      return NextResponse.json({ orders: order ? [order] : [] })
    }

    if (email) {
      const orders = await findLicenseOrdersByEmail(email)
      return NextResponse.json({ orders })
    }

    if (licenseKey) {
      const order = await findLicenseOrderByKey(licenseKey)
      return NextResponse.json({ orders: order ? [order] : [] })
    }

    const limit = Math.min(Math.max(body.limit || 10, 1), 50)
    const orders = await listRecentLicenseOrders(limit)
    return NextResponse.json({ orders })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to read orders') },
      { status: 500 },
    )
  }
}

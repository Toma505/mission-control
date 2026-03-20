import { NextRequest, NextResponse } from 'next/server'

import {
  findLicenseOrderByKey,
  findLicenseOrderBySessionId,
  findLicenseOrdersByEmail,
  listRecentLicenseOrders,
} from '@/lib/billing'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
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
    let body:
      | {
          action?: 'lookup'
          email?: string
          sessionId?: string
          licenseKey?: string
          limit?: number
        }
      | undefined

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (body?.action !== 'lookup') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
    }

    const sessionId = body.sessionId?.trim()
    if (sessionId) {
      const order = await findLicenseOrderBySessionId(sessionId)
      return NextResponse.json({ orders: order ? [order] : [] })
    }

    const email = body.email?.trim()
    if (email) {
      const orders = await findLicenseOrdersByEmail(email)
      return NextResponse.json({ orders })
    }

    const licenseKey = body.licenseKey?.trim()
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

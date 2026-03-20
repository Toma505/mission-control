import { NextRequest, NextResponse } from 'next/server'

import { findLicenseOrderBySessionId } from '@/lib/billing'
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

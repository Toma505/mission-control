import { NextRequest, NextResponse } from 'next/server'

import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { sanitizeError } from '@/lib/sanitize-error'
import { readSettings, writeSettings } from '@/lib/settings-store'

export async function GET() {
  try {
    return NextResponse.json({ settings: await readSettings() })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to load settings.') },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    await writeSettings(body)
    return NextResponse.json({ ok: true, settings: await readSettings() })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to save settings.') },
      { status: 500 },
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'

import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { appendChangelogEntry, readChangelogEntries } from '@/lib/changelog-store'

export async function GET() {
  const entries = await readChangelogEntries()
  return NextResponse.json({ entries })
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  try {
    const entries = await appendChangelogEntry(body)
    return NextResponse.json({ ok: true, entries })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save changelog entry.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

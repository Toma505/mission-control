import { NextRequest, NextResponse } from 'next/server'

import { sanitizeError } from '@/lib/sanitize-error'
import { buildTeamDashboardPayload } from '@/lib/team-usage-store'

export async function GET(request: NextRequest) {
  try {
    const range = request.nextUrl.searchParams.get('range')
    return NextResponse.json(await buildTeamDashboardPayload(range))
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to load team usage dashboard.') },
      { status: 500 },
    )
  }
}

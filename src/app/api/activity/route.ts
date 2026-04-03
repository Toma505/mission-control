import { NextRequest, NextResponse } from 'next/server'

import { getActivityHeatmap } from '@/lib/activity-store'
import { sanitizeError } from '@/lib/sanitize-error'

export async function GET(request: NextRequest) {
  try {
    const agent = request.nextUrl.searchParams.get('agent')
    const payload = await getActivityHeatmap(agent)
    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to load activity history.') },
      { status: 500 },
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getAgentUptimeTimeline, maybeRecordAgentUptimeSnapshot } from '@/lib/agent-uptime'
import { sanitizeError } from '@/lib/sanitize-error'

export async function GET(request: NextRequest) {
  try {
    const range = request.nextUrl.searchParams.get('range')

    await maybeRecordAgentUptimeSnapshot().catch(() => {})
    const data = await getAgentUptimeTimeline(range)

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Could not load agent uptime') },
      { status: 500 },
    )
  }
}

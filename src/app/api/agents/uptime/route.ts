import { NextRequest, NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/sanitize-error'

export async function GET(request: NextRequest) {
  try {
    const { getAgentUptimeTimeline, maybeRecordAgentUptimeSnapshot } = await import('@/lib/agent-uptime')
    const range = request.nextUrl.searchParams.get('range')

    await maybeRecordAgentUptimeSnapshot().catch(() => {})
    const data = await getAgentUptimeTimeline(range)

    return NextResponse.json(data)
  } catch (error) {
    // Graceful fallback when database/prisma is not available
    return NextResponse.json({
      range: '24h',
      agents: [],
      summary: { totalAgents: 0, onlineNow: 0, uptimePct: 0 },
      buckets: [],
    })
  }
}

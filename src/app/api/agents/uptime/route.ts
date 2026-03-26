import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'

type UptimeStatus = 'online' | 'offline' | 'error'

type AgentBucket = {
  timestamp: string
  status: UptimeStatus
}

type AgentTimeline = {
  name: string
  model: string
  buckets: AgentBucket[]
  uptimePercentage?: number
}

type UptimeResponse = {
  range: string
  bucketMinutes: number
  generatedAt: string
  agents: AgentTimeline[]
  summary?: {
    totalAgents: number
    onlineNow: number
    uptimePct: number
  }
  buckets?: Array<{
    timestamp: string
    online: number
    offline: number
    error: number
  }>
}

const UPTIME_FALLBACK_FILE = path.join(DATA_DIR, 'agent-uptime.json')
const VALID_RANGES = new Set(['24h', '7d', '30d', '90d'])

function normalizeRange(range: string | null) {
  return range && VALID_RANGES.has(range) ? range : '24h'
}

function normalizeTimeline(range: string, data: Omit<UptimeResponse, 'range'>): UptimeResponse {
  const agents = (data.agents || []).map((agent) => {
    const buckets = Array.isArray(agent.buckets) ? agent.buckets : []
    const onlineBuckets = buckets.filter((bucket) => bucket.status === 'online').length
    const uptimePercentage = buckets.length > 0
      ? Math.round((onlineBuckets / buckets.length) * 1000) / 10
      : 0

    return {
      ...agent,
      buckets,
      uptimePercentage,
    }
  })

  const bucketCount = Math.max(...agents.map((agent) => agent.buckets.length), 0)
  const aggregateBuckets = Array.from({ length: bucketCount }, (_, index) => {
    const timestamp = agents.find((agent) => agent.buckets[index])?.buckets[index]?.timestamp || new Date().toISOString()
    const counts = agents.reduce(
      (summary, agent) => {
        const status = agent.buckets[index]?.status
        if (status === 'online') summary.online += 1
        else if (status === 'error') summary.error += 1
        else if (status) summary.offline += 1
        return summary
      },
      { online: 0, offline: 0, error: 0 },
    )

    return {
      timestamp,
      ...counts,
    }
  })

  const onlineNow = agents.filter((agent) => agent.buckets[agent.buckets.length - 1]?.status === 'online').length
  const uptimePct = agents.length > 0
    ? Math.round((agents.reduce((sum, agent) => sum + (agent.uptimePercentage || 0), 0) / agents.length) * 10) / 10
    : 0

  return {
    range,
    bucketMinutes: data.bucketMinutes,
    generatedAt: data.generatedAt,
    agents,
    summary: {
      totalAgents: agents.length,
      onlineNow,
      uptimePct,
    },
    buckets: aggregateBuckets,
  }
}

async function readFallbackTimeline(range: string): Promise<UptimeResponse> {
  try {
    const text = await readFile(UPTIME_FALLBACK_FILE, 'utf-8')
    const parsed = JSON.parse(text) as Record<string, Omit<UptimeResponse, 'range'>>
    const fallback = parsed[range] || parsed['24h']
    if (fallback) {
      return normalizeTimeline(range, fallback)
    }
  } catch {
    // Fall through to empty response below.
  }

  return {
    range,
    bucketMinutes: 60,
    generatedAt: new Date().toISOString(),
    agents: [],
    summary: { totalAgents: 0, onlineNow: 0, uptimePct: 0 },
    buckets: [],
  }
}

export async function GET(request: NextRequest) {
  const range = normalizeRange(request.nextUrl.searchParams.get('range'))

  try {
    const { getAgentUptimeTimeline, maybeRecordAgentUptimeSnapshot } = await import('@/lib/agent-uptime')

    await maybeRecordAgentUptimeSnapshot().catch(() => {})
    const data = await getAgentUptimeTimeline(range)

    if (Array.isArray(data?.agents) && data.agents.length > 0) {
      return NextResponse.json(normalizeTimeline(range, data))
    }
  } catch {
    // Fall back to local demo data below.
  }

  return NextResponse.json(await readFallbackTimeline(range))
}

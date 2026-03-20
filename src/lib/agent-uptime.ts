import { prisma } from '@/lib/prisma'
import {
  getOpenClawConfig,
  getOpenClawHealth,
  getOpenClawSystemStatus,
  isConfigured,
} from '@/lib/openclaw'

export type UptimeRange = '24h' | '7d' | '30d' | '90d'
export type AgentUptimeStatus = 'online' | 'offline' | 'error'

type AgentSnapshot = {
  name: string
  model: string
  status: AgentUptimeStatus
}

type RangeConfig = {
  durationMs: number
  bucketMs: number
}

const FIVE_MINUTES_MS = 5 * 60 * 1000

const RANGE_CONFIG: Record<UptimeRange, RangeConfig> = {
  '24h': { durationMs: 24 * 60 * 60 * 1000, bucketMs: FIVE_MINUTES_MS },
  '7d': { durationMs: 7 * 24 * 60 * 60 * 1000, bucketMs: 60 * 60 * 1000 },
  '30d': { durationMs: 30 * 24 * 60 * 60 * 1000, bucketMs: 6 * 60 * 60 * 1000 },
  '90d': { durationMs: 90 * 24 * 60 * 60 * 1000, bucketMs: 12 * 60 * 60 * 1000 },
}

function getRangeConfig(range: string | null | undefined): RangeConfig {
  const normalized = (range || '24h') as UptimeRange
  return RANGE_CONFIG[normalized] || RANGE_CONFIG['24h']
}

function floorToBucket(date: Date, bucketMs: number) {
  return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs)
}

async function listKnownAgentNames() {
  const rows = await prisma.agentUptimeEvent.findMany({
    orderBy: { bucketStart: 'desc' },
    take: 100,
    select: { agentName: true },
  })

  const names = new Set<string>()
  for (const row of rows) {
    if (!names.has(row.agentName)) names.add(row.agentName)
  }

  return Array.from(names)
}

function parseConfiguredAgents(configData: { content?: string } | null, reachable: boolean): AgentSnapshot[] {
  let config: Record<string, unknown> | null = null

  if (configData?.content) {
    try {
      config = JSON.parse(configData.content) as Record<string, unknown>
    } catch {
      config = null
    }
  }

  const agents: AgentSnapshot[] = []
  const agentSection = config?.agents as Record<string, unknown> | undefined
  const defaults = agentSection?.defaults as Record<string, unknown> | undefined
  const defaultModel = (defaults?.model as Record<string, string> | undefined)?.primary || 'unknown'
  const agentDefs = (agentSection?.agents || agentSection?.list) as Record<string, Record<string, unknown>> | undefined

  if (agentDefs && typeof agentDefs === 'object' && !Array.isArray(agentDefs)) {
    for (const [name, def] of Object.entries(agentDefs)) {
      const model = (def.model as Record<string, string> | undefined)?.primary || defaultModel
      const enabled = def.enabled !== false
      agents.push({
        name,
        model,
        status: !reachable ? 'error' : enabled ? 'online' : 'offline',
      })
    }
  }

  if (agents.length === 0 && defaultModel !== 'unknown') {
    agents.push({
      name: 'default',
      model: defaultModel,
      status: reachable ? 'online' : 'error',
    })
  }

  return agents
}

async function buildAgentSnapshot(): Promise<AgentSnapshot[]> {
  if (!(await isConfigured())) {
    return []
  }

  const [configData, healthRaw, statusRaw] = await Promise.all([
    getOpenClawConfig().catch(() => null),
    getOpenClawHealth().catch(() => ''),
    getOpenClawSystemStatus().catch(() => ''),
  ])

  const reachable = !!(configData || healthRaw || statusRaw)
  const configuredAgents = parseConfiguredAgents(configData, reachable)
  if (configuredAgents.length > 0) return configuredAgents

  const knownAgents = await listKnownAgentNames()
  return knownAgents.map((name) => ({
    name,
    model: 'unknown',
    status: reachable ? 'online' : 'error',
  }))
}

function getStatusPriority(status: AgentUptimeStatus) {
  switch (status) {
    case 'error':
      return 3
    case 'offline':
      return 2
    default:
      return 1
  }
}

function chooseBucketStatus(statuses: AgentUptimeStatus[], fallback: AgentUptimeStatus) {
  if (statuses.length === 0) return fallback
  return statuses.reduce((current, next) => {
    return getStatusPriority(next) > getStatusPriority(current) ? next : current
  }, statuses[0])
}

export async function maybeRecordAgentUptimeSnapshot() {
  const bucketStart = floorToBucket(new Date(), FIVE_MINUTES_MS)
  const agents = await buildAgentSnapshot()
  if (agents.length === 0) return

  await prisma.$transaction(
    agents.map((agent) =>
      prisma.agentUptimeEvent.upsert({
        where: {
          agentName_bucketStart: {
            agentName: agent.name,
            bucketStart,
          },
        },
        update: {
          model: agent.model,
          status: agent.status,
        },
        create: {
          agentName: agent.name,
          model: agent.model,
          status: agent.status,
          bucketStart,
        },
      }),
    ),
  )
}

export async function getAgentUptimeTimeline(range: string | null | undefined) {
  const { durationMs, bucketMs } = getRangeConfig(range)
  const end = floorToBucket(new Date(), bucketMs)
  const start = new Date(end.getTime() - durationMs + bucketMs)

  const events = await prisma.agentUptimeEvent.findMany({
    where: {
      bucketStart: {
        gte: start,
        lte: end,
      },
    },
    orderBy: [{ agentName: 'asc' }, { bucketStart: 'asc' }],
  })

  const latestBeforeStart = await prisma.agentUptimeEvent.findMany({
    where: { bucketStart: { lt: start } },
    orderBy: [{ agentName: 'asc' }, { bucketStart: 'desc' }],
    select: { agentName: true, status: true },
  })

  const latestStatusBeforeStart = new Map<string, AgentUptimeStatus>()
  for (const row of latestBeforeStart) {
    if (!latestStatusBeforeStart.has(row.agentName)) {
      latestStatusBeforeStart.set(row.agentName, row.status as AgentUptimeStatus)
    }
  }

  const snapshotAgents = await buildAgentSnapshot()
  const agentNames = new Set<string>([
    ...events.map((event) => event.agentName),
    ...snapshotAgents.map((agent) => agent.name),
    ...latestStatusBeforeStart.keys(),
  ])

  const timeBuckets: Date[] = []
  for (let time = start.getTime(); time <= end.getTime(); time += bucketMs) {
    timeBuckets.push(new Date(time))
  }

  const agents = Array.from(agentNames)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const agentEvents = events.filter((event) => event.agentName === name)
      const snapshot = snapshotAgents.find((agent) => agent.name === name)
      const grouped = new Map<number, AgentUptimeStatus[]>()

      for (const event of agentEvents) {
        const bucketTime = floorToBucket(event.bucketStart, bucketMs).getTime()
        const list = grouped.get(bucketTime) || []
        list.push(event.status as AgentUptimeStatus)
        grouped.set(bucketTime, list)
      }

      let carryStatus = latestStatusBeforeStart.get(name) || snapshot?.status || 'offline'
      let onlineCount = 0

      const buckets = timeBuckets.map((bucket) => {
        const statuses = grouped.get(bucket.getTime()) || []
        const status = chooseBucketStatus(statuses, carryStatus)
        carryStatus = status
        if (status === 'online') onlineCount += 1

        return {
          timestamp: bucket.toISOString(),
          status,
        }
      })

      return {
        name,
        model: snapshot?.model || agentEvents[agentEvents.length - 1]?.model || 'unknown',
        uptimePercentage: buckets.length > 0 ? Math.round((onlineCount / buckets.length) * 1000) / 10 : 0,
        buckets,
      }
    })

  return {
    range: (range || '24h') as UptimeRange,
    bucketMinutes: Math.round(bucketMs / 60000),
    generatedAt: new Date().toISOString(),
    agents,
  }
}

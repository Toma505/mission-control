/**
 * Server-side Railway API client.
 * Queries the Railway GraphQL API for usage and billing data.
 */

const RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2'
const RAILWAY_TOKEN = process.env.RAILWAY_API_TOKEN || ''
const RAILWAY_PROJECT_ID = process.env.RAILWAY_PROJECT_ID || ''

// Railway pricing (per-minute rates from their docs)
const PRICING = {
  CPU_USAGE: 0.000463,        // per vCPU-minute
  MEMORY_USAGE_GB: 0.000231,  // per GB-minute
  NETWORK_TX_GB: 0.05,        // per GB
  DISK_USAGE_GB: 0.00000347,  // per GB-minute (volume)
}

async function railwayQuery(query: string, variables?: Record<string, unknown>): Promise<any> {
  const res = await fetch(RAILWAY_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RAILWAY_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })

  const data = await res.json()
  if (data.errors) throw new Error(data.errors[0]?.message || 'Railway API error')
  return data.data
}

export interface RailwayUsage {
  current: {
    cpu: number
    memory: number
    network: number
    volume: number
    total: number
  }
  estimated: {
    cpu: number
    memory: number
    network: number
    volume: number
    total: number
  }
  plan: string
  credits: number
}

function calcCost(measurement: string, value: number): number {
  const rate = PRICING[measurement as keyof typeof PRICING] || 0
  return value * rate
}

export async function getRailwayUsage(): Promise<RailwayUsage> {
  const data = await railwayQuery(
    `query($projectId: String!) {
      project(id: $projectId) {
        subscriptionType
      }
      estimatedUsage(
        projectId: $projectId
        measurements: [CPU_USAGE, MEMORY_USAGE_GB, NETWORK_TX_GB, DISK_USAGE_GB]
      ) {
        estimatedValue
        measurement
      }
      usage(
        projectId: $projectId
        measurements: [CPU_USAGE, MEMORY_USAGE_GB, NETWORK_TX_GB, DISK_USAGE_GB]
      ) {
        measurement
        value
      }
    }`,
    { projectId: RAILWAY_PROJECT_ID }
  )

  const plan = data.project?.subscriptionType || 'hobby'
  const credits = plan === 'hobby' ? 5.0 : plan === 'pro' ? 0 : 0

  // Current usage
  const currentMap: Record<string, number> = {}
  for (const u of data.usage || []) {
    currentMap[u.measurement] = u.value
  }

  const currentCpu = calcCost('CPU_USAGE', currentMap.CPU_USAGE || 0)
  const currentMemory = calcCost('MEMORY_USAGE_GB', currentMap.MEMORY_USAGE_GB || 0)
  const currentNetwork = calcCost('NETWORK_TX_GB', currentMap.NETWORK_TX_GB || 0)
  const currentVolume = calcCost('DISK_USAGE_GB', currentMap.DISK_USAGE_GB || 0)

  // Estimated usage
  const estMap: Record<string, number> = {}
  for (const u of data.estimatedUsage || []) {
    estMap[u.measurement] = u.estimatedValue
  }

  const estCpu = calcCost('CPU_USAGE', estMap.CPU_USAGE || 0)
  const estMemory = calcCost('MEMORY_USAGE_GB', estMap.MEMORY_USAGE_GB || 0)
  const estNetwork = calcCost('NETWORK_TX_GB', estMap.NETWORK_TX_GB || 0)
  const estVolume = calcCost('DISK_USAGE_GB', estMap.DISK_USAGE_GB || 0)

  return {
    current: {
      cpu: currentCpu,
      memory: currentMemory,
      network: currentNetwork,
      volume: currentVolume,
      total: currentCpu + currentMemory + currentNetwork + currentVolume,
    },
    estimated: {
      cpu: estCpu,
      memory: estMemory,
      network: estNetwork,
      volume: estVolume,
      total: estCpu + estMemory + estNetwork + estVolume,
    },
    plan,
    credits,
  }
}

export function isRailwayConfigured(): boolean {
  return !!RAILWAY_TOKEN
}

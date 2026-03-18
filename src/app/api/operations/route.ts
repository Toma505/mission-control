import { NextResponse } from 'next/server'

// ─── Types ───────────────────────────────────────────────────

interface JobCosts {
  scout: number
  editor: number
  narrator: number
  veo: number
  voiceover: number
  outreach: number
  total: number
}

interface JobStatus {
  step: string
  status: string
  startedAt: string
  completedSteps: string[]
}

interface Job {
  id: string
  address: string
  costs: JobCosts
  status: JobStatus
}

interface OperationsResponse {
  jobs: Job[]
  summary: {
    totalJobs: number
    completed: number
    totalSpent: number
    avgCost: number
  }
}

// ─── Helpers ─────────────────────────────────────────────────

import { getEffectiveConfig, isAppConfigured } from '@/lib/connection-config'

async function execCommand(command: string): Promise<string> {
  const config = await getEffectiveConfig()
  const auth = 'Basic ' + Buffer.from(':' + config.setupPassword).toString('base64')
  const res = await fetch(`${config.openclawUrl}/setup/api/command`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command }),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Command failed with status ${res.status}`)
  }

  const data = await res.json()
  // The response may return output in different shapes depending on
  // the OpenClaw version — handle the most common ones.
  if (typeof data === 'string') return data
  if (typeof data.output === 'string') return data.output
  if (typeof data.stdout === 'string') return data.stdout
  return JSON.stringify(data)
}

function prettifyAddress(dirName: string): string {
  // Turn directory names like "123-main-st" into "123 Main St"
  return dirName
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function parseJsonSafe<T>(raw: string, fallback: T): T {
  try {
    const trimmed = raw.trim()
    if (!trimmed || trimmed === '{}' || trimmed === '[]') return fallback
    return JSON.parse(trimmed) as T
  } catch {
    return fallback
  }
}

const EMPTY_COSTS: JobCosts = {
  scout: 0,
  editor: 0,
  narrator: 0,
  veo: 0,
  voiceover: 0,
  outreach: 0,
  total: 0,
}

const EMPTY_STATUS: JobStatus = {
  step: '',
  status: '',
  startedAt: '',
  completedSteps: [],
}

const EMPTY_RESPONSE: OperationsResponse = {
  jobs: [],
  summary: { totalJobs: 0, completed: 0, totalSpent: 0, avgCost: 0 },
}

// ─── Route ───────────────────────────────────────────────────

export async function GET() {
  if (!(await isAppConfigured())) {
    return NextResponse.json(EMPTY_RESPONSE)
  }

  try {
    // 1. List job directories
    let lsOutput: string
    try {
      lsOutput = await execCommand(
        "ls /data/workspace/jobs 2>/dev/null || echo '[]'"
      )
    } catch {
      // Directory doesn't exist yet — no jobs have run
      return NextResponse.json(EMPTY_RESPONSE)
    }

    // Parse directory listing — one entry per line, skip empty lines
    const dirNames = lsOutput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && l !== '[]')

    if (dirNames.length === 0) {
      return NextResponse.json(EMPTY_RESPONSE)
    }

    // 2. Fetch cost.json and status.json for every job in parallel
    const jobs: Job[] = await Promise.all(
      dirNames.map(async (dir): Promise<Job> => {
        try {
          const [costRaw, statusRaw] = await Promise.all([
            execCommand(
              `cat /data/workspace/jobs/${dir}/cost.json 2>/dev/null || echo '{}'`
            ).catch(() => '{}'),
            execCommand(
              `cat /data/workspace/jobs/${dir}/status.json 2>/dev/null || echo '{}'`
            ).catch(() => '{}'),
          ])

          const costs: JobCosts = {
            ...EMPTY_COSTS,
            ...parseJsonSafe<Partial<JobCosts>>(costRaw, {}),
          }
          const status: JobStatus = {
            ...EMPTY_STATUS,
            ...parseJsonSafe<Partial<JobStatus>>(statusRaw, {}),
          }

          return {
            id: dir,
            address: prettifyAddress(dir),
            costs,
            status,
          }
        } catch {
          return {
            id: dir,
            address: prettifyAddress(dir),
            costs: { ...EMPTY_COSTS },
            status: { ...EMPTY_STATUS },
          }
        }
      })
    )

    // 3. Build summary
    const totalJobs = jobs.length
    const completed = jobs.filter(
      (j) => j.status.status === 'completed' || j.status.status === 'done'
    ).length
    const totalSpent = jobs.reduce((sum, j) => sum + (j.costs.total || 0), 0)
    const avgCost = totalJobs > 0 ? totalSpent / totalJobs : 0

    const response: OperationsResponse = {
      jobs,
      summary: {
        totalJobs,
        completed,
        totalSpent: Math.round(totalSpent * 100) / 100,
        avgCost: Math.round(avgCost * 100) / 100,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    // If OpenClaw is unreachable or anything else fails, return empty
    console.error(
      '[operations] Failed to fetch jobs:',
      error instanceof Error ? error.message : error
    )
    return NextResponse.json(EMPTY_RESPONSE)
  }
}

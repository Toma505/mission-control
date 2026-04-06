import { NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/sanitize-error'
import { isLegacyDemoOperations } from '@/lib/legacy-demo-data'

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

async function readLocalOps() {
  try {
    const { readFile } = await import('fs/promises')
    const path = await import('path')
    const { DATA_DIR } = await import('@/lib/connection-config')
    const text = await readFile(path.join(DATA_DIR, 'operations.json'), 'utf-8')
    const data = JSON.parse(text)
    if (!Array.isArray(data)) return null
    const jobs = data.map((op: any) => ({
      id: op.id,
      address: op.name,
      costs: { scout: 0, editor: 0, narrator: 0, veo: 0, voiceover: 0, outreach: 0, total: op.cost || 0 },
      status: { step: op.status === 'running' ? 'In Progress' : 'Done', status: op.status, startedAt: op.startedAt, completedSteps: [] },
    }))
    if (isLegacyDemoOperations(jobs)) {
      return EMPTY_RESPONSE
    }
    const totalSpent = jobs.reduce((s: number, j: any) => s + j.costs.total, 0)
    return {
      jobs,
      summary: { totalJobs: jobs.length, completed: jobs.filter((j: any) => j.status.status === 'completed').length, totalSpent: Math.round(totalSpent * 100) / 100, avgCost: jobs.length > 0 ? Math.round(totalSpent / jobs.length * 100) / 100 : 0 },
    }
  } catch { return null }
}

export async function GET() {
  if (!(await isAppConfigured())) {
    const localData = await readLocalOps()
    return NextResponse.json(localData || EMPTY_RESPONSE)
  }

  try {
    // 1. List job directories
    let lsOutput: string
    try {
      lsOutput = await execCommand(
        "ls /data/workspace/jobs 2>/dev/null || echo '[]'"
      )
    } catch {
      // Directory doesn't exist yet — fall back to local data
      const localData = await readLocalOps()
      return NextResponse.json(localData || EMPTY_RESPONSE)
    }

    // Parse directory listing — one entry per line, skip empty lines
    // Sanitize: only allow safe directory names to prevent shell injection
    const SAFE_DIR_NAME = /^[a-zA-Z0-9._\-]+$/
    const dirNames = lsOutput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && l !== '[]' && SAFE_DIR_NAME.test(l))

    if (dirNames.length === 0) {
      const localData = await readLocalOps()
      return NextResponse.json(localData || EMPTY_RESPONSE)
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
    // If OpenClaw is unreachable, fall back to local data
    const localData = await readLocalOps()
    return NextResponse.json(localData || EMPTY_RESPONSE)
  }
}

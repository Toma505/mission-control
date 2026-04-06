import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

import cronstrue from 'cronstrue'
import { CronExpressionParser } from 'cron-parser'

import { DATA_DIR, getEffectiveConfig } from '@/lib/connection-config'
import { isLegacyDemoSchedules } from '@/lib/legacy-demo-data'
import { decryptSecretValue } from '@/lib/secret-encryption'

export const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json')
export const SCHEDULE_RUNS_FILE = path.join(DATA_DIR, 'schedule-runs.json')
const INSTANCES_FILE = path.join(DATA_DIR, 'instances.json')

export type ScheduleRunStatus = 'success' | 'error'

export interface ScheduledTask {
  id: string
  name: string
  cronExpression: string
  targetInstanceId: string
  command: string
  prompt: string
  enabled: boolean
  createdAt: string
  updatedAt: string
  lastRunAt?: string | null
  lastStatus?: ScheduleRunStatus | null
  lastDurationMs?: number | null
  lastOutputSummary?: string | null
  nextRunAt?: string | null
}

export interface ScheduleRun {
  id: string
  taskId: string
  taskName: string
  targetInstanceId: string
  targetInstanceName: string
  status: ScheduleRunStatus
  startedAt: string
  finishedAt: string
  durationMs: number
  outputSummary: string
}

export interface ScheduleExecutionResult {
  task: ScheduledTask
  run: ScheduleRun
}

export interface ScheduleInstanceOption {
  id: string
  name: string
  url: string
  enabled: boolean
  source: 'instances' | 'connection'
}

interface ScheduleStore {
  version: number
  tasks: ScheduledTask[]
}

interface ScheduleRunStore {
  version: number
  runs: ScheduleRun[]
}

type StoredInstance = {
  id?: string
  name?: string
  url?: string
  password?: string
  enabled?: boolean
}

const DEFAULT_TASKS: Omit<ScheduledTask, 'nextRunAt'>[] = []

const DEFAULT_RUNS: ScheduleRun[] = []

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function summarizeOutput(value: unknown) {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  return text.slice(0, 220) || 'No output returned.'
}

export function describeCron(expression: string) {
  try {
    return cronstrue.toString(expression, { throwExceptionOnParseError: true })
  } catch {
    return 'Invalid cron expression'
  }
}

export function computeNextRunAt(expression: string, currentDate = new Date()) {
  try {
    const interval = CronExpressionParser.parse(expression, { currentDate })
    return interval.next().toISOString()
  } catch {
    return null
  }
}

function normalizeTask(task: Partial<ScheduledTask>): ScheduledTask | null {
  const cronExpression = String(task.cronExpression || '').trim()
  const name = String(task.name || '').trim()
  const targetInstanceId = String(task.targetInstanceId || '').trim()
  const command = String(task.command || '').trim()
  const prompt = String(task.prompt || '').trim()
  if (!name || !cronExpression || !targetInstanceId || !command) return null

  return {
    id: String(task.id || randomUUID()),
    name,
    cronExpression,
    targetInstanceId,
    command,
    prompt,
    enabled: task.enabled !== false,
    createdAt: String(task.createdAt || new Date().toISOString()),
    updatedAt: String(task.updatedAt || new Date().toISOString()),
    lastRunAt: task.lastRunAt ? String(task.lastRunAt) : null,
    lastStatus: task.lastStatus === 'error' ? 'error' : task.lastStatus === 'success' ? 'success' : null,
    lastDurationMs: Number.isFinite(Number(task.lastDurationMs)) ? Number(task.lastDurationMs) : null,
    lastOutputSummary: task.lastOutputSummary ? String(task.lastOutputSummary) : null,
      nextRunAt: task.enabled !== false ? computeNextRunAt(cronExpression) : null,
  }
}

function buildDefaultStore(): ScheduleStore {
  return {
    version: 1,
    tasks: DEFAULT_TASKS.map((task) => ({
      ...task,
      nextRunAt: task.enabled ? computeNextRunAt(task.cronExpression) : null,
    })),
  }
}

function buildDefaultRunStore(): ScheduleRunStore {
  return {
    version: 1,
    runs: DEFAULT_RUNS,
  }
}

export async function readSchedules(): Promise<ScheduleStore> {
  try {
    const raw = JSON.parse(await readFile(SCHEDULES_FILE, 'utf-8')) as { tasks?: unknown[] }
    const tasks = Array.isArray(raw.tasks)
      ? raw.tasks
          .map((task) => normalizeTask(task as Partial<ScheduledTask>))
          .filter((task): task is ScheduledTask => task !== null)
      : buildDefaultStore().tasks

    if (isLegacyDemoSchedules(tasks)) {
      return buildDefaultStore()
    }

    return { version: 1, tasks }
  } catch {
    return buildDefaultStore()
  }
}

export async function writeSchedules(store: ScheduleStore) {
  await mkdir(path.dirname(SCHEDULES_FILE), { recursive: true })
  await writeFile(
    SCHEDULES_FILE,
    JSON.stringify(
      {
        version: 1,
        tasks: store.tasks.map((task) => ({
          ...task,
          nextRunAt: task.enabled ? computeNextRunAt(task.cronExpression) : null,
        })),
      },
      null,
      2
    )
  )
}

export async function readScheduleRuns(): Promise<ScheduleRunStore> {
  try {
    const raw = JSON.parse(await readFile(SCHEDULE_RUNS_FILE, 'utf-8')) as { runs?: unknown[] }
    const runs = Array.isArray(raw.runs)
      ? raw.runs.filter((entry): entry is ScheduleRun => isRecord(entry)) as ScheduleRun[]
      : buildDefaultRunStore().runs
    return { version: 1, runs }
  } catch {
    return buildDefaultRunStore()
  }
}

export async function writeScheduleRuns(store: ScheduleRunStore) {
  await mkdir(path.dirname(SCHEDULE_RUNS_FILE), { recursive: true })
  await writeFile(SCHEDULE_RUNS_FILE, JSON.stringify({ version: 1, runs: store.runs }, null, 2))
}

async function readStoredInstances(): Promise<StoredInstance[]> {
  try {
    const raw = JSON.parse(await readFile(INSTANCES_FILE, 'utf-8')) as { instances?: StoredInstance[] }
    return Array.isArray(raw.instances) ? raw.instances : []
  } catch {
    return []
  }
}

export async function getScheduleInstances(): Promise<ScheduleInstanceOption[]> {
  const storedInstances = await readStoredInstances()
  const instances: ScheduleInstanceOption[] = storedInstances
    .filter((instance) => instance.id && instance.name && instance.url)
    .map((instance) => ({
      id: String(instance.id),
      name: String(instance.name),
      url: String(instance.url),
      enabled: instance.enabled !== false,
      source: 'instances' as const,
    }))

  const config = await getEffectiveConfig()
  if (config.openclawUrl) {
    if (!instances.some((instance) => instance.url === config.openclawUrl)) {
      instances.unshift({
        id: 'primary',
        name: 'Primary Workspace',
        url: config.openclawUrl,
        enabled: true,
        source: 'connection',
      })
    }
  }

  if (instances.length > 0) {
    return instances
  }

  return []
}

async function getStoredInstanceCredentials(instanceId: string) {
  const storedInstances = await readStoredInstances()
  const found = storedInstances.find((instance) => instance.id === instanceId)
  if (found?.url) {
    return {
      name: String(found.name || instanceId),
      url: String(found.url),
      enabled: found.enabled !== false,
      password: decryptSecretValue(String(found.password || '')),
    }
  }

  if (instanceId === 'primary') {
    const config = await getEffectiveConfig()
    if (config.openclawUrl) {
      return {
        name: 'Primary Workspace',
        url: config.openclawUrl,
        enabled: true,
        password: config.setupPassword,
      }
    }
  }

  return null
}

export function getRunsForTask(runs: ScheduleRun[], taskId: string) {
  return runs
    .filter((run) => run.taskId === taskId)
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())
    .slice(0, 10)
}

export async function executeScheduleTask(task: ScheduledTask): Promise<ScheduleExecutionResult> {
  const target = await getStoredInstanceCredentials(task.targetInstanceId)
  const startedAt = new Date()

  if (!target) {
    const finishedAt = new Date()
    return {
      task: {
        ...task,
        lastRunAt: finishedAt.toISOString(),
        lastStatus: 'error' as const,
        lastDurationMs: finishedAt.getTime() - startedAt.getTime(),
        lastOutputSummary: 'Target instance not found.',
        nextRunAt: task.enabled ? computeNextRunAt(task.cronExpression, finishedAt) : null,
      },
      run: {
        id: randomUUID(),
        taskId: task.id,
        taskName: task.name,
        targetInstanceId: task.targetInstanceId,
        targetInstanceName: task.targetInstanceId,
        status: 'error' as const,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        outputSummary: 'Target instance not found.',
      },
    }
  }

  if (!target.enabled) {
    const finishedAt = new Date()
    return {
      task: {
        ...task,
        lastRunAt: finishedAt.toISOString(),
        lastStatus: 'error' as const,
        lastDurationMs: finishedAt.getTime() - startedAt.getTime(),
        lastOutputSummary: 'Target instance is disabled.',
        nextRunAt: task.enabled ? computeNextRunAt(task.cronExpression, finishedAt) : null,
      },
      run: {
        id: randomUUID(),
        taskId: task.id,
        taskName: task.name,
        targetInstanceId: task.targetInstanceId,
        targetInstanceName: target.name,
        status: 'error' as const,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        outputSummary: 'Target instance is disabled.',
      },
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const auth = `Basic ${Buffer.from(`:${target.password || ''}`).toString('base64')}`
    const response = await fetch(`${target.url.replace(/\/+$/, '')}/setup/api/console/run`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cmd: task.command,
        arg: task.prompt || '',
      }),
      signal: controller.signal,
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => null)
    const finishedAt = new Date()
    const ok = response.ok && payload?.ok !== false
    const outputSummary = summarizeOutput(payload?.output || payload?.error || `HTTP ${response.status}`)

    return {
      task: {
        ...task,
        lastRunAt: finishedAt.toISOString(),
        lastStatus: ok ? ('success' as const) : ('error' as const),
        lastDurationMs: finishedAt.getTime() - startedAt.getTime(),
        lastOutputSummary: outputSummary,
        nextRunAt: task.enabled ? computeNextRunAt(task.cronExpression, finishedAt) : null,
      },
      run: {
        id: randomUUID(),
        taskId: task.id,
        taskName: task.name,
        targetInstanceId: task.targetInstanceId,
        targetInstanceName: target.name,
        status: ok ? ('success' as const) : ('error' as const),
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        outputSummary,
      },
    }
  } catch (error) {
    const finishedAt = new Date()
    const outputSummary = summarizeOutput(error instanceof Error ? error.message : 'Task execution failed.')

    return {
      task: {
        ...task,
        lastRunAt: finishedAt.toISOString(),
        lastStatus: 'error' as const,
        lastDurationMs: finishedAt.getTime() - startedAt.getTime(),
        lastOutputSummary: outputSummary,
        nextRunAt: task.enabled ? computeNextRunAt(task.cronExpression, finishedAt) : null,
      },
      run: {
        id: randomUUID(),
        taskId: task.id,
        taskName: task.name,
        targetInstanceId: task.targetInstanceId,
        targetInstanceName: target.name,
        status: 'error' as const,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        outputSummary,
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

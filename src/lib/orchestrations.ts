import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { DATA_DIR, getEffectiveConfig } from '@/lib/connection-config'
import { decryptSecretValue } from '@/lib/secret-encryption'

export type OrchestrationTemplateId =
  | 'fan_out_research'
  | 'parallel_code_review'
  | 'consensus_voting'

export type OrchestrationExecutionMode = 'same' | 'custom'
export type OrchestrationAggregateMode = 'merge' | 'compare' | 'vote'
export type OrchestrationStatus = 'running' | 'completed' | 'partial' | 'failed'
export type OrchestrationTargetStatus = 'pending' | 'running' | 'success' | 'error'
export type OrchestrationInstanceSource = 'instances' | 'connection'

export interface OrchestrationTemplate {
  id: OrchestrationTemplateId
  name: string
  description: string
  defaultTask: string
  executionMode: OrchestrationExecutionMode
  aggregateMode: OrchestrationAggregateMode
}

export interface OrchestrationInstanceOption {
  id: string
  name: string
  url: string
  enabled: boolean
  source: OrchestrationInstanceSource
}

export interface OrchestrationTarget {
  id: string
  instanceId: string
  instanceName: string
  task: string
  source: OrchestrationInstanceSource
  status: OrchestrationTargetStatus
  startedAt?: string | null
  finishedAt?: string | null
  durationMs?: number | null
  outputSummary?: string | null
  rawOutput?: string | null
  error?: string | null
}

export interface OrchestrationRecord {
  id: string
  name: string
  templateId: OrchestrationTemplateId
  templateName: string
  executionMode: OrchestrationExecutionMode
  aggregateMode: OrchestrationAggregateMode
  status: OrchestrationStatus
  sharedTask?: string | null
  createdAt: string
  startedAt?: string | null
  finishedAt?: string | null
  successCount: number
  failureCount: number
  aggregateSummary?: string | null
  targets: OrchestrationTarget[]
}

export interface OrchestrationDraftInput {
  name: string
  templateId: OrchestrationTemplateId
  executionMode: OrchestrationExecutionMode
  sharedTask?: string
  assignments: Array<{
    instanceId: string
    task: string
  }>
}

interface StoredInstance {
  id?: string
  name?: string
  url?: string
  password?: string
  enabled?: boolean
}

interface OrchestrationStore {
  version: number
  orchestrations: OrchestrationRecord[]
}

interface InstanceCredentials extends OrchestrationInstanceOption {
  password: string
}

interface QueueGlobals {
  __mcOrchestrationWriteQueue?: Promise<unknown>
  __mcRunningOrchestrations?: Set<string>
}

const ORCHESTRATIONS_FILE = path.join(DATA_DIR, 'orchestrations.json')
const DEFAULT_ORCHESTRATIONS_FILE = path.join(process.cwd(), 'data', 'orchestrations.json')
const INSTANCES_FILE = path.join(DATA_DIR, 'instances.json')
const STORE_LIMIT = 40

const DEFAULT_TEMPLATES: OrchestrationTemplate[] = [
  {
    id: 'fan_out_research',
    name: 'Fan-out Research',
    description: 'Send the same research prompt to multiple instances and combine the strongest findings.',
    defaultTask:
      'Research the topic, surface the best insights, and return a tight bullet summary with recommended next steps.',
    executionMode: 'same',
    aggregateMode: 'merge',
  },
  {
    id: 'parallel_code_review',
    name: 'Parallel Code Review',
    description: 'Assign the same change set to multiple reviewers and compare their findings side by side.',
    defaultTask:
      'Review the supplied change, call out bugs or regressions first, then note any missing tests or risky assumptions.',
    executionMode: 'same',
    aggregateMode: 'compare',
  },
  {
    id: 'consensus_voting',
    name: 'Consensus Voting',
    description: 'Ask multiple instances to choose the best option, then compare where they agree or diverge.',
    defaultTask:
      'Evaluate the candidate options, pick the best one, and explain the decision in a short structured response.',
    executionMode: 'same',
    aggregateMode: 'vote',
  },
]

function getRuntimeGlobals() {
  return globalThis as typeof globalThis & QueueGlobals
}

function nowIso() {
  return new Date().toISOString()
}

function summarizeText(value: unknown) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

function sortOrchestrations(orchestrations: OrchestrationRecord[]) {
  return [...orchestrations].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )
}

function normalizeTarget(input: Partial<OrchestrationTarget>): OrchestrationTarget | null {
  const instanceId = String(input.instanceId || '').trim()
  const instanceName = String(input.instanceName || '').trim()
  const task = String(input.task || '').trim()
  if (!instanceId || !instanceName || !task) return null

  const sourceValue = input.source
  const source: OrchestrationInstanceSource =
    sourceValue === 'instances' || sourceValue === 'connection'
      ? sourceValue
      : 'instances'
  const statusValue = input.status
  const status: OrchestrationTargetStatus =
    statusValue === 'running' || statusValue === 'success' || statusValue === 'error' || statusValue === 'pending'
      ? statusValue
      : 'pending'

  return {
    id: String(input.id || randomUUID()),
    instanceId,
    instanceName,
    task,
    source,
    status,
    startedAt: input.startedAt ? String(input.startedAt) : null,
    finishedAt: input.finishedAt ? String(input.finishedAt) : null,
    durationMs: Number.isFinite(Number(input.durationMs)) ? Number(input.durationMs) : null,
    outputSummary: input.outputSummary ? String(input.outputSummary) : null,
    rawOutput: input.rawOutput ? String(input.rawOutput) : null,
    error: input.error ? String(input.error) : null,
  }
}

function normalizeOrchestration(input: Partial<OrchestrationRecord>): OrchestrationRecord | null {
  const name = String(input.name || '').trim()
  const templateId = input.templateId
  const template = DEFAULT_TEMPLATES.find((entry) => entry.id === templateId)
  const executionMode = input.executionMode === 'custom' ? 'custom' : 'same'
  const aggregateMode =
    input.aggregateMode === 'compare' || input.aggregateMode === 'vote' || input.aggregateMode === 'merge'
      ? input.aggregateMode
      : template?.aggregateMode || 'merge'

  if (!name || !template) return null

  const statusValue = input.status
  const status: OrchestrationStatus =
    statusValue === 'completed' || statusValue === 'partial' || statusValue === 'failed' || statusValue === 'running'
      ? statusValue
      : 'completed'

  const targets = Array.isArray(input.targets)
    ? input.targets
        .map((target) => normalizeTarget(target))
        .filter((target): target is OrchestrationTarget => !!target)
    : []

  return {
    id: String(input.id || randomUUID()),
    name,
    templateId: template.id,
    templateName: String(input.templateName || template.name),
    executionMode,
    aggregateMode,
    status,
    sharedTask: input.sharedTask ? String(input.sharedTask) : null,
    createdAt: input.createdAt ? String(input.createdAt) : nowIso(),
    startedAt: input.startedAt ? String(input.startedAt) : null,
    finishedAt: input.finishedAt ? String(input.finishedAt) : null,
    successCount: Number.isFinite(Number(input.successCount)) ? Number(input.successCount) : 0,
    failureCount: Number.isFinite(Number(input.failureCount)) ? Number(input.failureCount) : 0,
    aggregateSummary: input.aggregateSummary ? String(input.aggregateSummary) : null,
    targets,
  }
}

function normalizeStore(input: unknown): OrchestrationStore {
  const value = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  return {
    version: 1,
    orchestrations: Array.isArray(value.orchestrations)
      ? value.orchestrations
          .map((entry) => normalizeOrchestration(entry as Partial<OrchestrationRecord>))
          .filter((entry): entry is OrchestrationRecord => !!entry)
          .slice(0, STORE_LIMIT)
      : [],
  }
}

async function readSeedStore() {
  try {
    const raw = await readFile(DEFAULT_ORCHESTRATIONS_FILE, 'utf-8')
    return normalizeStore(JSON.parse(raw))
  } catch {
    return normalizeStore(null)
  }
}

export async function readOrchestrationStore(): Promise<OrchestrationStore> {
  try {
    const raw = await readFile(ORCHESTRATIONS_FILE, 'utf-8')
    return normalizeStore(JSON.parse(raw))
  } catch {
    return readSeedStore()
  }
}

async function writeOrchestrationStore(store: OrchestrationStore) {
  await mkdir(path.dirname(ORCHESTRATIONS_FILE), { recursive: true })
  await writeFile(
    ORCHESTRATIONS_FILE,
    JSON.stringify(
      {
        version: 1,
        orchestrations: sortOrchestrations(store.orchestrations).slice(0, STORE_LIMIT),
      },
      null,
      2,
    ),
  )
}

async function mutateStore<T>(mutator: (store: OrchestrationStore) => Promise<T> | T): Promise<T> {
  const globals = getRuntimeGlobals()
  const previous = globals.__mcOrchestrationWriteQueue || Promise.resolve()
  const next = previous.then(async () => {
    const store = await readOrchestrationStore()
    const result = await mutator(store)
    await writeOrchestrationStore(store)
    return result
  })
  globals.__mcOrchestrationWriteQueue = next.catch(() => undefined)
  return next
}

async function readStoredInstances(): Promise<StoredInstance[]> {
  try {
    const raw = JSON.parse(await readFile(INSTANCES_FILE, 'utf-8')) as { instances?: StoredInstance[] }
    return Array.isArray(raw.instances) ? raw.instances : []
  } catch {
    return []
  }
}

export async function getOrchestrationInstances(): Promise<OrchestrationInstanceOption[]> {
  const storedInstances = await readStoredInstances()
  const instances: OrchestrationInstanceOption[] = storedInstances
    .filter((instance) => instance.id && instance.name && instance.url)
    .map((instance) => ({
      id: String(instance.id),
      name: String(instance.name),
      url: String(instance.url),
      enabled: instance.enabled !== false,
      source: 'instances' as const,
    }))

  const config = await getEffectiveConfig()
  if (config.openclawUrl && !instances.some((instance) => instance.url === config.openclawUrl)) {
    instances.unshift({
      id: 'primary',
      name: 'Primary Workspace',
      url: config.openclawUrl,
      enabled: true,
      source: 'connection',
    })
  }

  return instances
}

async function getInstanceCredentials(instanceId: string): Promise<InstanceCredentials | null> {
  const instances = await readStoredInstances()
  const found = instances.find((instance) => instance.id === instanceId)

  if (found?.url) {
    return {
      id: String(found.id),
      name: String(found.name || found.id),
      url: String(found.url),
      enabled: found.enabled !== false,
      source: 'instances',
      password: decryptSecretValue(String(found.password || '')),
    }
  }

  if (instanceId === 'primary') {
    const config = await getEffectiveConfig()
    if (config.openclawUrl) {
      return {
        id: 'primary',
        name: 'Primary Workspace',
        url: config.openclawUrl,
        enabled: true,
        source: 'connection',
        password: config.setupPassword,
      }
    }
  }
  return null
}

async function runInstanceTask(target: OrchestrationTarget) {
  const instance = await getInstanceCredentials(target.instanceId)
  if (!instance) {
    throw new Error('Target instance could not be found.')
  }

  if (!instance.enabled) {
    throw new Error('Target instance is disabled.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)

  try {
    const response = await fetch(`${instance.url.replace(/\/+$/, '')}/setup/api/console/run`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`:${instance.password || ''}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cmd: 'openclaw.prompt.run',
        arg: target.task,
      }),
      cache: 'no-store',
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null)
    const rawOutput = String(payload?.output || payload?.result || payload?.error || `HTTP ${response.status}`).trim()

    if (!response.ok || payload?.ok === false) {
      throw new Error(rawOutput || `Remote command failed with HTTP ${response.status}`)
    }

    return {
      rawOutput,
      outputSummary: summarizeText(rawOutput || 'Completed without text output.'),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function extractLeadingDecision(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return 'No clear vote'

  const decisionMatch = trimmed.match(/(?:decision|pick|vote)\s*:\s*(.+)/i)
  if (decisionMatch?.[1]) {
    return decisionMatch[1].split('\n')[0].trim().slice(0, 120)
  }

  const firstBullet = trimmed
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('-') || /^\d+\./.test(line))

  if (firstBullet) {
    return firstBullet.replace(/^[-\d.\s]+/, '').trim().slice(0, 120)
  }

  return trimmed.split(/[.!?]/)[0].trim().slice(0, 120) || 'No clear vote'
}

function buildAggregateSummary(orchestration: OrchestrationRecord) {
  const successes = orchestration.targets.filter((target) => target.status === 'success')
  const failures = orchestration.targets.filter((target) => target.status === 'error')

  if (successes.length === 0) {
    return failures.length > 0
      ? `All ${failures.length} targets failed. Review the target cards for the first actionable error.`
      : 'No completed target output is available yet.'
  }

  if (orchestration.aggregateMode === 'vote') {
    const votes = successes.reduce<Map<string, number>>((map, target) => {
      const key = extractLeadingDecision(target.rawOutput || target.outputSummary || '')
      map.set(key, (map.get(key) || 0) + 1)
      return map
    }, new Map())

    const ranked = [...votes.entries()].sort((left, right) => right[1] - left[1])
    const winner = ranked[0]

    return [
      `Consensus result: ${winner?.[0] || 'No majority decision'} (${winner?.[1] || 0}/${successes.length} votes).`,
      ...ranked.slice(1, 3).map(([decision, count]) => `${decision} (${count} vote${count === 1 ? '' : 's'})`),
      failures.length > 0 ? `${failures.length} instance${failures.length === 1 ? '' : 's'} failed but the vote still completed.` : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  const lines = successes.slice(0, 4).map((target) => `${target.instanceName}: ${target.outputSummary || 'Completed.'}`)

  if (orchestration.aggregateMode === 'compare') {
    return [
      `Completed ${successes.length} parallel reviews${failures.length > 0 ? ` with ${failures.length} failure${failures.length === 1 ? '' : 's'}` : ''}.`,
      ...lines,
    ].join(' ')
  }

  return [
    `Merged output from ${successes.length} instance${successes.length === 1 ? '' : 's'}${failures.length > 0 ? ` while ${failures.length} failed` : ''}.`,
    ...lines,
  ].join(' ')
}

async function setTargetStatus(
  orchestrationId: string,
  targetId: string,
  patch: Partial<OrchestrationTarget>,
) {
  await mutateStore(async (store) => {
    const orchestration = store.orchestrations.find((entry) => entry.id === orchestrationId)
    const target = orchestration?.targets.find((entry) => entry.id === targetId)
    if (!orchestration || !target) return

    Object.assign(target, patch)
    if (patch.startedAt && !orchestration.startedAt) {
      orchestration.startedAt = patch.startedAt
    }
  })
}

async function finalizeOrchestration(orchestrationId: string) {
  await mutateStore(async (store) => {
    const orchestration = store.orchestrations.find((entry) => entry.id === orchestrationId)
    if (!orchestration) return

    const successCount = orchestration.targets.filter((target) => target.status === 'success').length
    const failureCount = orchestration.targets.filter((target) => target.status === 'error').length
    const unfinishedCount = orchestration.targets.filter(
      (target) => target.status === 'pending' || target.status === 'running',
    ).length

    orchestration.successCount = successCount
    orchestration.failureCount = failureCount
    orchestration.finishedAt = unfinishedCount === 0 ? nowIso() : null
    orchestration.aggregateSummary = buildAggregateSummary(orchestration)

    if (unfinishedCount > 0) {
      orchestration.status = 'running'
      return
    }

    if (successCount === 0 && failureCount > 0) {
      orchestration.status = 'failed'
    } else if (failureCount > 0) {
      orchestration.status = 'partial'
    } else {
      orchestration.status = 'completed'
    }
  })
}

async function executeOrchestration(orchestrationId: string) {
  const globals = getRuntimeGlobals()
  const running = globals.__mcRunningOrchestrations || new Set<string>()
  globals.__mcRunningOrchestrations = running

  if (running.has(orchestrationId)) {
    return
  }

  running.add(orchestrationId)

  try {
    const store = await readOrchestrationStore()
    const orchestration = store.orchestrations.find((entry) => entry.id === orchestrationId)
    if (!orchestration) return

    const targets = orchestration.targets.filter(
      (target) => target.status === 'pending' || target.status === 'running',
    )

    await Promise.allSettled(
      targets.map(async (target) => {
        const startedAt = nowIso()
        await setTargetStatus(orchestrationId, target.id, {
          status: 'running',
          startedAt,
          finishedAt: null,
          durationMs: null,
          error: null,
        })

        try {
          const result = await runInstanceTask(target)
          const finishedAt = nowIso()
          await setTargetStatus(orchestrationId, target.id, {
            status: 'success',
            finishedAt,
            durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
            outputSummary: result.outputSummary,
            rawOutput: result.rawOutput,
            error: null,
          })
        } catch (error) {
          const finishedAt = nowIso()
          const message = sanitizeTextError(error)
          await setTargetStatus(orchestrationId, target.id, {
            status: 'error',
            finishedAt,
            durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
            outputSummary: summarizeText(message),
            rawOutput: null,
            error: message,
          })
        }
      }),
    )

    await finalizeOrchestration(orchestrationId)
  } finally {
    running.delete(orchestrationId)
  }
}

function sanitizeTextError(error: unknown) {
  return error instanceof Error ? error.message : 'Task execution failed.'
}

function assertDraftInput(
  input: unknown,
  instances: OrchestrationInstanceOption[],
) {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const templateId = body.templateId
  const template = DEFAULT_TEMPLATES.find((entry) => entry.id === templateId)
  if (!template) {
    throw new Error('Template is required.')
  }

  const executionMode: OrchestrationExecutionMode = body.executionMode === 'custom' ? 'custom' : 'same'
  const sharedTask = String(body.sharedTask || '').trim() || template.defaultTask
  const name = String(body.name || '').trim() || template.name
  const assignments = Array.isArray(body.assignments) ? body.assignments : []
  if (assignments.length === 0) {
    throw new Error('Select at least one target instance.')
  }

  const availableInstances = new Map(instances.map((instance) => [instance.id, instance]))
  const seen = new Set<string>()
  const normalizedAssignments = assignments.map((assignment) => {
    const value = (assignment && typeof assignment === 'object' ? assignment : {}) as Record<string, unknown>
    const instanceId = String(value.instanceId || '').trim()
    const task =
      executionMode === 'same'
        ? sharedTask
        : String(value.task || '').trim() || template.defaultTask

    if (!instanceId) {
      throw new Error('Each assignment needs a target instance.')
    }
    if (seen.has(instanceId)) {
      throw new Error('Each instance can only be selected once per orchestration.')
    }

    const instance = availableInstances.get(instanceId)
    if (!instance || !instance.enabled) {
      throw new Error(`Target instance "${instanceId}" is unavailable.`)
    }
    if (!task) {
      throw new Error('Each target needs a task to run.')
    }

    seen.add(instanceId)
    return {
      instance,
      task,
    }
  })

  return {
    name,
    template,
    executionMode,
    sharedTask: executionMode === 'same' ? sharedTask : null,
    assignments: normalizedAssignments,
  }
}

export async function startOrchestration(input: unknown) {
  const instances = await getOrchestrationInstances()
  const draft = assertDraftInput(input, instances)
  const createdAt = nowIso()
  const record: OrchestrationRecord = {
    id: randomUUID(),
    name: draft.name,
    templateId: draft.template.id,
    templateName: draft.template.name,
    executionMode: draft.executionMode,
    aggregateMode: draft.template.aggregateMode,
    status: 'running',
    sharedTask: draft.sharedTask,
    createdAt,
    startedAt: null,
    finishedAt: null,
    successCount: 0,
    failureCount: 0,
    aggregateSummary: null,
    targets: draft.assignments.map(({ instance, task }) => ({
      id: randomUUID(),
      instanceId: instance.id,
      instanceName: instance.name,
      task,
      source: instance.source,
      status: 'pending',
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      outputSummary: null,
      rawOutput: null,
      error: null,
    })),
  }

  await mutateStore(async (store) => {
    store.orchestrations = [record, ...store.orchestrations.filter((entry) => entry.id !== record.id)].slice(
      0,
      STORE_LIMIT,
    )
  })

  void executeOrchestration(record.id)
  return record
}

export async function deleteOrchestration(orchestrationId: string) {
  let result: 'deleted' | 'running' | 'missing' = 'missing'

  await mutateStore(async (store) => {
    const current = store.orchestrations.find((entry) => entry.id === orchestrationId)
    if (!current) {
      result = 'missing'
      return
    }
    if (current.status === 'running') {
      result = 'running'
      return
    }

    store.orchestrations = store.orchestrations.filter((entry) => entry.id !== orchestrationId)
    result = 'deleted'
  })

  return result
}

export interface OrchestrationPayload {
  templates: OrchestrationTemplate[]
  instances: OrchestrationInstanceOption[]
  orchestrations: OrchestrationRecord[]
}

export async function getOrchestrationPayload(): Promise<OrchestrationPayload> {
  const [store, instances] = await Promise.all([readOrchestrationStore(), getOrchestrationInstances()])

  store.orchestrations
    .filter(
      (orchestration) =>
        orchestration.status === 'running' &&
        orchestration.targets.some((target) => target.status === 'pending' || target.status === 'running'),
    )
    .forEach((orchestration) => {
      void executeOrchestration(orchestration.id)
    })

  return {
    templates: DEFAULT_TEMPLATES,
    instances,
    orchestrations: sortOrchestrations(store.orchestrations),
  }
}

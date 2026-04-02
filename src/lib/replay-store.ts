import { mkdir, readFile, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'

export type ReplayToolCall = {
  name: string
  status: 'ok' | 'warning' | 'error'
  durationMs: number
  input: string
  outputSummary: string
}

export type ReplayFileChange = {
  path: string
  summary: string
  before: string
  after: string
}

export type ReplayStep = {
  id: string
  title: string
  timestamp: string
  input: string
  action: string
  result: string
  prompt: string
  response: string
  toolCalls: ReplayToolCall[]
  fileChanges: ReplayFileChange[]
}

export type ReplaySession = {
  id: string
  sessionKey: string
  agentId: string
  instanceId: string
  model: string
  taskDescription: string
  startedAt: string
  completedAt: string
  durationMs: number
  status: 'completed' | 'failed' | 'running'
  steps: ReplayStep[]
}

type ReplayStore = {
  sessions: ReplaySession[]
}

const REPLAYS_FILE = path.join(DATA_DIR, 'replays.json')

function fallbackStore(): ReplayStore {
  return {
    sessions: [],
  }
}

export async function readReplayStore(): Promise<ReplayStore> {
  try {
    const raw = await readFile(REPLAYS_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as ReplayStore
    if (!Array.isArray(parsed.sessions)) {
      return fallbackStore()
    }
    return parsed
  } catch {
    return fallbackStore()
  }
}

async function writeReplayStore(store: ReplayStore) {
  await mkdir(path.dirname(REPLAYS_FILE), { recursive: true })
  await writeFile(REPLAYS_FILE, JSON.stringify(store, null, 2))
}

export async function listReplaySessions() {
  const store = await readReplayStore()
  return [...store.sessions]
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .map((session) => ({
      id: session.id,
      sessionKey: session.sessionKey,
      agentId: session.agentId,
      instanceId: session.instanceId,
      model: session.model,
      taskDescription: session.taskDescription,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      durationMs: session.durationMs,
      status: session.status,
      stepCount: session.steps.length,
    }))
}

export async function getReplaySession(sessionId: string) {
  const store = await readReplayStore()
  return store.sessions.find((session) => session.id === sessionId) || null
}

function normalizeReplaySession(session: ReplaySession): ReplaySession {
  const now = new Date().toISOString()
  return {
    ...session,
    id: session.id || `replay-${randomUUID().slice(0, 8)}`,
    sessionKey: session.sessionKey || `shared:${randomUUID().slice(0, 8)}`,
    agentId: session.agentId || 'shared-agent',
    instanceId: session.instanceId || 'shared',
    model: session.model || 'shared-session',
    taskDescription: session.taskDescription || 'Imported shared session',
    startedAt: session.startedAt || now,
    completedAt: session.completedAt || now,
    durationMs: Number.isFinite(session.durationMs) ? session.durationMs : 0,
    status: session.status || 'completed',
    steps: Array.isArray(session.steps) ? session.steps : [],
  }
}

export async function importReplaySession(session: ReplaySession) {
  const store = await readReplayStore()
  const normalized = normalizeReplaySession(session)

  let nextId = normalized.id
  let counter = 2
  while (store.sessions.some((existing) => existing.id === nextId)) {
    nextId = `${normalized.id}-${counter}`
    counter += 1
  }

  const imported = {
    ...normalized,
    id: nextId,
  }

  store.sessions = [imported, ...store.sessions]
  await writeReplayStore(store)
  return imported
}

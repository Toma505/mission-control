import { readFile } from 'fs/promises'
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

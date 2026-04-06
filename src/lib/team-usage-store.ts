import { readFile } from 'fs/promises'
import path from 'path'

import { DATA_DIR } from '@/lib/connection-config'
import { isLegacyDemoTeamUsageStore } from '@/lib/legacy-demo-data'

export type TeamUsageRange = 'today' | 'week' | 'month' | 'all'

export interface TeamUsageUser {
  id: string
  name: string
  role: string
}

export interface TeamUsageAgent {
  id: string
  name: string
  ownerId: string
  instanceId: string
  model: string
}

export interface TeamUsageSession {
  id: string
  userId: string
  agentId: string
  instanceId: string
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
  completionRate: number
  timestamp: string
  taskDescription: string
  outcome: 'completed' | 'partial' | 'blocked'
}

export interface LeaderboardEntry {
  id: string
  name: string
  subtitle: string
  totalTokens: number
  totalCost: number
  sessionsCount: number
  avgCostPerSession: number
  avgCompletionRate: number
}

export interface WasteSession {
  id: string
  userName: string
  agentName: string
  instanceId: string
  taskDescription: string
  totalTokens: number
  totalCost: number
  completionRate: number
  wastedTokens: number
  outcome: TeamUsageSession['outcome']
  timestamp: string
}

export interface TeamDashboardPayload {
  range: TeamUsageRange
  generatedAt: string
  summary: {
    totalTokens: number
    totalCost: number
    sessionsCount: number
    activeUsers: number
    activeAgents: number
  }
  userLeaderboard: LeaderboardEntry[]
  agentLeaderboard: LeaderboardEntry[]
  wasteSessions: WasteSession[]
}

interface TeamUsageStore {
  version: number
  users: TeamUsageUser[]
  agents: TeamUsageAgent[]
  sessions: TeamUsageSession[]
}

const DATA_FILE = path.join(DATA_DIR, 'team-usage.json')
const SEED_FILE = path.join(process.cwd(), 'data', 'team-usage.json')

function normalizeRange(value: string | null): TeamUsageRange {
  if (value === 'today' || value === 'week' || value === 'month' || value === 'all') return value
  return 'week'
}

async function readStore(): Promise<TeamUsageStore> {
  for (const file of [DATA_FILE, SEED_FILE]) {
    try {
      const raw = await readFile(file, 'utf-8')
      const store = JSON.parse(raw) as TeamUsageStore
      if (isLegacyDemoTeamUsageStore(store)) {
        return { version: 1, users: [], agents: [], sessions: [] }
      }
      return {
        version: 1,
        users: Array.isArray(store.users) ? store.users : [],
        agents: Array.isArray(store.agents) ? store.agents : [],
        sessions: Array.isArray(store.sessions) ? store.sessions : [],
      }
    } catch {
      // Try next file.
    }
  }

  return { version: 1, users: [], agents: [], sessions: [] }
}

function filterSessionsByRange(sessions: TeamUsageSession[], range: TeamUsageRange) {
  if (range === 'all') return sessions

  const now = Date.now()
  const cutoff =
    range === 'today'
      ? now - 24 * 60 * 60 * 1000
      : range === 'week'
        ? now - 7 * 24 * 60 * 60 * 1000
        : now - 30 * 24 * 60 * 60 * 1000

  return sessions.filter((session) => new Date(session.timestamp).getTime() >= cutoff)
}

function buildLeaderboard(
  sessions: TeamUsageSession[],
  items: Array<TeamUsageUser | TeamUsageAgent>,
  kind: 'user' | 'agent',
  usersById: Map<string, TeamUsageUser>,
): LeaderboardEntry[] {
  return items
    .map((item) => {
      const scopedSessions = sessions.filter((session) =>
        kind === 'user' ? session.userId === item.id : session.agentId === item.id,
      )

      if (scopedSessions.length === 0) return null

      const totalTokens = scopedSessions.reduce(
        (sum, session) => sum + session.inputTokens + session.outputTokens,
        0,
      )
      const totalCost = scopedSessions.reduce((sum, session) => sum + session.cost, 0)
      const avgCompletionRate =
        scopedSessions.reduce((sum, session) => sum + session.completionRate, 0) / scopedSessions.length

      return {
        id: item.id,
        name: item.name,
        subtitle:
          kind === 'user'
            ? `${(item as TeamUsageUser).role} | ${scopedSessions.length} sessions`
            : `${(item as TeamUsageAgent).instanceId} | ${
                usersById.get((item as TeamUsageAgent).ownerId)?.name || 'Unassigned'
              }`,
        totalTokens,
        totalCost: Number(totalCost.toFixed(4)),
        sessionsCount: scopedSessions.length,
        avgCostPerSession: Number((totalCost / scopedSessions.length).toFixed(4)),
        avgCompletionRate: Number(avgCompletionRate.toFixed(3)),
      } satisfies LeaderboardEntry
    })
    .filter((entry): entry is LeaderboardEntry => entry !== null)
    .sort((left, right) => {
      if (right.totalTokens !== left.totalTokens) return right.totalTokens - left.totalTokens
      return right.totalCost - left.totalCost
    })
}

function buildWasteSessions(
  sessions: TeamUsageSession[],
  usersById: Map<string, TeamUsageUser>,
  agentsById: Map<string, TeamUsageAgent>,
): WasteSession[] {
  return sessions
    .map((session) => {
      const totalTokens = session.inputTokens + session.outputTokens
      const wastedTokens = Math.round(totalTokens * (1 - session.completionRate))

      return {
        id: session.id,
        userName: usersById.get(session.userId)?.name || session.userId,
        agentName: agentsById.get(session.agentId)?.name || session.agentId,
        instanceId: session.instanceId,
        taskDescription: session.taskDescription,
        totalTokens,
        totalCost: Number(session.cost.toFixed(4)),
        completionRate: Number(session.completionRate.toFixed(2)),
        wastedTokens,
        outcome: session.outcome,
        timestamp: session.timestamp,
      } satisfies WasteSession
    })
    .filter((session) => session.totalTokens >= 18000 && session.completionRate < 0.72)
    .sort((left, right) => {
      if (right.wastedTokens !== left.wastedTokens) return right.wastedTokens - left.wastedTokens
      return right.totalCost - left.totalCost
    })
    .slice(0, 5)
}

export async function buildTeamDashboardPayload(rangeValue: string | null): Promise<TeamDashboardPayload> {
  const range = normalizeRange(rangeValue)
  const store = await readStore()
  const sessions = filterSessionsByRange(store.sessions, range).sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  )
  const usersById = new Map(store.users.map((user) => [user.id, user]))
  const agentsById = new Map(store.agents.map((agent) => [agent.id, agent]))

  const totalTokens = sessions.reduce(
    (sum, session) => sum + session.inputTokens + session.outputTokens,
    0,
  )
  const totalCost = sessions.reduce((sum, session) => sum + session.cost, 0)

  return {
    range,
    generatedAt: new Date().toISOString(),
    summary: {
      totalTokens,
      totalCost: Number(totalCost.toFixed(4)),
      sessionsCount: sessions.length,
      activeUsers: new Set(sessions.map((session) => session.userId)).size,
      activeAgents: new Set(sessions.map((session) => session.agentId)).size,
    },
    userLeaderboard: buildLeaderboard(sessions, store.users, 'user', usersById),
    agentLeaderboard: buildLeaderboard(sessions, store.agents, 'agent', usersById),
    wasteSessions: buildWasteSessions(sessions, usersById, agentsById),
  }
}

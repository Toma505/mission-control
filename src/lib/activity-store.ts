import { readFile } from 'fs/promises'
import path from 'path'

import { DATA_DIR } from '@/lib/connection-config'

export type ActivityAgent = {
  id: string
  label: string
}

type ActivitySeedWeek = {
  weekOf: string
  default?: number[]
  scout?: number[]
  editor?: number[]
  support?: number[]
  [key: string]: string | number[] | undefined
}

type ActivitySeed = {
  agents?: ActivityAgent[]
  weeks?: ActivitySeedWeek[]
}

export type ActivityDay = {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
  isFuture: boolean
  inRange: boolean
  dayOfWeek: number
}

export type ActivitySummary = {
  totalSessions: number
  mostActiveDay: { date: string; count: number } | null
  currentStreak: number
  longestStreak: number
}

export type ActivityResponse = {
  agents: ActivityAgent[]
  selectedAgent: string | null
  range: {
    start: string
    end: string
  }
  summary: ActivitySummary
  maxCount: number
  weeks: Array<{
    id: string
    days: ActivityDay[]
  }>
}

const ACTIVITY_FILE = path.join(DATA_DIR, 'activity.json')
const ACTIVITY_SEED_FILE = path.join(process.cwd(), 'data', 'activity.json')
const EMPTY_SUMMARY: ActivitySummary = {
  totalSessions: 0,
  mostActiveDay: null,
  currentStreak: 0,
  longestStreak: 0,
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function previousSunday(date: Date) {
  const copy = startOfDay(date)
  copy.setDate(copy.getDate() - copy.getDay())
  return copy
}

function nextSaturday(date: Date) {
  const copy = startOfDay(date)
  copy.setDate(copy.getDate() + (6 - copy.getDay()))
  return copy
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

async function readActivitySeed(): Promise<ActivitySeed> {
  for (const filePath of [ACTIVITY_FILE, ACTIVITY_SEED_FILE]) {
    try {
      const raw = await readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw) as ActivitySeed
      return {
        agents: Array.isArray(parsed?.agents) ? parsed.agents : [],
        weeks: Array.isArray(parsed?.weeks) ? parsed.weeks : [],
      }
    } catch {
      // fall through
    }
  }

  return { agents: [], weeks: [] }
}

function expandCounts(seed: ActivitySeed) {
  const countsByDate = new Map<string, Record<string, number>>()

  for (const week of seed.weeks || []) {
    const weekStart = startOfDay(new Date(`${week.weekOf}T00:00:00`))
    if (Number.isNaN(weekStart.getTime())) continue

    for (const [agentId, values] of Object.entries(week)) {
      if (agentId === 'weekOf' || !Array.isArray(values)) continue

      values.forEach((value, index) => {
        const date = isoDate(addDays(weekStart, index))
        const current = countsByDate.get(date) || {}
        current[agentId] = Number.isFinite(value) ? Number(value) : 0
        countsByDate.set(date, current)
      })
    }
  }

  return countsByDate
}

function getDayCount(counts: Record<string, number>, selectedAgent: string | null) {
  if (selectedAgent) return Number(counts[selectedAgent] || 0)
  return Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0)
}

function getLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || maxCount <= 0) return 0
  const ratio = count / maxCount
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

function buildSummary(days: Array<{ date: string; count: number; isFuture: boolean; inRange: boolean }>): ActivitySummary {
  const filtered = days.filter((day) => day.inRange && !day.isFuture)
  if (filtered.length === 0) return EMPTY_SUMMARY

  let totalSessions = 0
  let mostActiveDay: { date: string; count: number } | null = null
  let longestStreak = 0
  let currentLongest = 0

  for (const day of filtered) {
    totalSessions += day.count

    if (!mostActiveDay || day.count > mostActiveDay.count) {
      mostActiveDay = { date: day.date, count: day.count }
    }

    if (day.count > 0) {
      currentLongest += 1
      if (currentLongest > longestStreak) longestStreak = currentLongest
    } else {
      currentLongest = 0
    }
  }

  let currentStreak = 0
  for (let index = filtered.length - 1; index >= 0; index -= 1) {
    if (filtered[index].count > 0) {
      currentStreak += 1
      continue
    }
    break
  }

  return {
    totalSessions,
    mostActiveDay,
    currentStreak,
    longestStreak,
  }
}

export async function getActivityHeatmap(agentId?: string | null): Promise<ActivityResponse> {
  const seed = await readActivitySeed()
  const agents = Array.isArray(seed.agents) ? seed.agents : []
  const selectedAgent = agents.some((agent) => agent.id === agentId) ? agentId || null : null
  const expanded = expandCounts(seed)

  const today = startOfDay(new Date())
  const rangeStart = addDays(today, -364)
  const gridStart = previousSunday(rangeStart)
  const gridEnd = nextSaturday(today)
  const dayRows: Array<{ date: string; count: number; isFuture: boolean; inRange: boolean; dayOfWeek: number }> = []

  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    const date = isoDate(cursor)
    const inRange = cursor >= rangeStart && cursor <= today
    const isFuture = cursor > today
    const count = inRange && !isFuture
      ? getDayCount(expanded.get(date) || {}, selectedAgent)
      : 0

    dayRows.push({
      date,
      count,
      isFuture,
      inRange,
      dayOfWeek: cursor.getDay(),
    })
  }

  const filteredRows = dayRows.filter((day) => day.inRange && !day.isFuture)
  const maxCount = filteredRows.reduce((max, day) => Math.max(max, day.count), 0)
  const summary = buildSummary(dayRows)

  const weeks: ActivityResponse['weeks'] = []
  for (let index = 0; index < dayRows.length; index += 7) {
    const chunk = dayRows.slice(index, index + 7)
    weeks.push({
      id: chunk[0]?.date || `week-${index / 7}`,
      days: chunk.map((day) => ({
        ...day,
        level: getLevel(day.count, maxCount),
      })),
    })
  }

  return {
    agents,
    selectedAgent,
    range: {
      start: isoDate(rangeStart),
      end: isoDate(today),
    },
    summary,
    maxCount,
    weeks,
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/sanitize-error'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'

const SCHEDULE_FILE = path.join(DATA_DIR, 'mode-schedule.json')

export interface ScheduleEntry {
  id: string
  name: string
  mode: 'best' | 'standard' | 'budget' | 'auto'
  startTime: string  // HH:MM (24h)
  endTime: string    // HH:MM (24h)
  days: number[]     // 0=Sun, 1=Mon, ..., 6=Sat
  enabled: boolean
  createdAt: string
}

interface ScheduleConfig {
  enabled: boolean
  entries: ScheduleEntry[]
  lastApplied?: string  // ISO timestamp of last schedule application
  currentScheduleId?: string  // Which schedule entry is currently active
}

const DEFAULT_CONFIG: ScheduleConfig = {
  enabled: false,
  entries: [
    {
      id: 'default-business',
      name: 'Business hours — Best mode',
      mode: 'best',
      startTime: '09:00',
      endTime: '18:00',
      days: [1, 2, 3, 4, 5], // Mon-Fri
      enabled: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'default-overnight',
      name: 'Overnight — Budget mode',
      mode: 'budget',
      startTime: '18:00',
      endTime: '09:00',
      days: [0, 1, 2, 3, 4, 5, 6], // Every day
      enabled: true,
      createdAt: new Date().toISOString(),
    },
  ],
}

async function readSchedule(): Promise<ScheduleConfig> {
  try {
    const text = await readFile(SCHEDULE_FILE, 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(text) }
  } catch {
    return DEFAULT_CONFIG
  }
}

async function writeSchedule(config: ScheduleConfig) {
  await mkdir(path.dirname(SCHEDULE_FILE), { recursive: true })
  await writeFile(SCHEDULE_FILE, JSON.stringify(config, null, 2))
}

function isTimeInRange(now: Date, startTime: string, endTime: string): boolean {
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  if (startMinutes <= endMinutes) {
    // Same day range: e.g. 09:00 - 18:00
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  } else {
    // Overnight range: e.g. 18:00 - 09:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  }
}

function getActiveEntry(config: ScheduleConfig): ScheduleEntry | null {
  if (!config.enabled) return null

  const now = new Date()
  const dayOfWeek = now.getDay()

  for (const entry of config.entries) {
    if (!entry.enabled) continue
    if (!entry.days.includes(dayOfWeek)) continue
    if (isTimeInRange(now, entry.startTime, entry.endTime)) {
      return entry
    }
  }

  return null
}

// GET — return schedule config + which entry is currently active
export async function GET() {
  try {
    const config = await readSchedule()
    const activeEntry = getActiveEntry(config)

    return NextResponse.json({
      ...config,
      activeEntry: activeEntry ? { id: activeEntry.id, name: activeEntry.name, mode: activeEntry.mode } : null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to read schedule') },
      { status: 500 }
    )
  }
}

// POST — manage schedule entries
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    let body: {
      action: string
      entry?: Partial<ScheduleEntry>
      entryId?: string
      enabled?: boolean
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const config = await readSchedule()

    if (body.action === 'toggle_schedule') {
      config.enabled = !config.enabled
      await writeSchedule(config)
      return NextResponse.json({ ok: true, enabled: config.enabled })
    }

    if (body.action === 'create' && body.entry) {
      const entry: ScheduleEntry = {
        id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: body.entry.name || 'New Schedule',
        mode: body.entry.mode || 'standard',
        startTime: body.entry.startTime || '09:00',
        endTime: body.entry.endTime || '18:00',
        days: body.entry.days || [1, 2, 3, 4, 5],
        enabled: body.entry.enabled !== false,
        createdAt: new Date().toISOString(),
      }
      config.entries.push(entry)
      await writeSchedule(config)
      return NextResponse.json({ ok: true, entry })
    }

    if (body.action === 'update' && body.entryId && body.entry) {
      const idx = config.entries.findIndex(e => e.id === body.entryId)
      if (idx === -1) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
      config.entries[idx] = { ...config.entries[idx], ...body.entry }
      await writeSchedule(config)
      return NextResponse.json({ ok: true, entry: config.entries[idx] })
    }

    if (body.action === 'delete' && body.entryId) {
      config.entries = config.entries.filter(e => e.id !== body.entryId)
      await writeSchedule(config)
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'toggle' && body.entryId) {
      const entry = config.entries.find(e => e.id === body.entryId)
      if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
      entry.enabled = !entry.enabled
      await writeSchedule(config)
      return NextResponse.json({ ok: true, entry })
    }

    // Apply — check the schedule and switch mode if needed
    if (body.action === 'apply') {
      const activeEntry = getActiveEntry(config)
      if (!activeEntry) {
        return NextResponse.json({ ok: true, applied: false, reason: 'No active schedule entry' })
      }

      // Check if we already applied this entry
      if (config.currentScheduleId === activeEntry.id) {
        return NextResponse.json({ ok: true, applied: false, reason: 'Already on scheduled mode' })
      }

      // Switch mode by calling the mode API internally
      const { getEffectiveConfig } = await import('@/lib/connection-config')
      const appConfig = await getEffectiveConfig()
      if (!appConfig.openclawUrl) {
        return NextResponse.json({ ok: false, error: 'Not configured' })
      }

      const MODES: Record<string, { primary: string; fallbacks: string[] }> = {
        best: { primary: 'anthropic/claude-opus-4-6', fallbacks: ['openrouter/google/gemini-3.1-pro'] },
        standard: { primary: 'anthropic/claude-sonnet-4-6', fallbacks: ['openrouter/google/gemini-3.1-pro'] },
        budget: { primary: 'openrouter/deepseek/deepseek-chat-v3-0324', fallbacks: ['openrouter/openai/gpt-4.1-nano', 'openrouter/google/gemini-2.5-flash'] },
        auto: { primary: 'anthropic/claude-sonnet-4-6', fallbacks: ['openrouter/google/gemini-3.1-pro', 'openrouter/deepseek/deepseek-chat-v3-0324'] },
      }

      const modeConfig = MODES[activeEntry.mode]
      if (!modeConfig) {
        return NextResponse.json({ ok: false, error: 'Invalid mode in schedule' })
      }

      const auth = 'Basic ' + Buffer.from(':' + appConfig.setupPassword).toString('base64')

      try {
        const configRes = await fetch(`${appConfig.openclawUrl}/setup/api/config/raw`, {
          headers: { Authorization: auth },
          cache: 'no-store',
        })
        if (!configRes.ok) throw new Error('Config fetch failed')
        const configData = await configRes.json()
        const ocConfig = JSON.parse(configData.content)

        if (!ocConfig.agents) ocConfig.agents = {}
        if (!ocConfig.agents.defaults) ocConfig.agents.defaults = {}
        ocConfig.agents.defaults.model = { ...modeConfig }
        if (!ocConfig.meta) ocConfig.meta = {}
        ocConfig.meta.lastTouchedAt = new Date().toISOString()

        await fetch(`${appConfig.openclawUrl}/setup/api/config/raw`, {
          method: 'POST',
          headers: { Authorization: auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: JSON.stringify(ocConfig, null, 2) }),
        })

        config.currentScheduleId = activeEntry.id
        config.lastApplied = new Date().toISOString()
        await writeSchedule(config)

        return NextResponse.json({
          ok: true,
          applied: true,
          mode: activeEntry.mode,
          entryName: activeEntry.name,
        })
      } catch {
        return NextResponse.json({ ok: false, error: 'Could not apply schedule — OpenClaw unreachable' })
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to save schedule') },
      { status: 500 }
    )
  }
}

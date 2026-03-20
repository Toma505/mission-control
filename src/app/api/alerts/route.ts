import { NextRequest, NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/sanitize-error'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'

const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json')

export interface AlertRule {
  id: string
  name: string
  enabled: boolean
  type: 'spend_daily' | 'spend_monthly' | 'credits_low' | 'agent_offline' | 'budget_pct' | 'custom'
  condition: {
    metric: string     // e.g. 'openrouter.usageDaily', 'budget.dailyPct', 'agent.status'
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
    value: number
  }
  action: 'notify' | 'notify_and_throttle' | 'throttle'
  cooldownMinutes: number  // Don't re-fire within this window
  lastTriggered?: string
  createdAt: string
}

interface AlertsConfig {
  rules: AlertRule[]
  history: { ruleId: string; ruleName: string; message: string; timestamp: string }[]
}

const DEFAULT_RULES: AlertRule[] = [
  {
    id: 'default-daily-spend',
    name: 'High daily spend',
    enabled: true,
    type: 'spend_daily',
    condition: { metric: 'openrouter.usageDaily', operator: 'gt', value: 5 },
    action: 'notify',
    cooldownMinutes: 60,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'default-credits-low',
    name: 'Credits running low',
    enabled: true,
    type: 'credits_low',
    condition: { metric: 'openrouter.remainingPct', operator: 'lt', value: 20 },
    action: 'notify',
    cooldownMinutes: 120,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'default-budget-exceeded',
    name: 'Budget limit exceeded',
    enabled: true,
    type: 'budget_pct',
    condition: { metric: 'budget.maxPct', operator: 'gte', value: 100 },
    action: 'notify_and_throttle',
    cooldownMinutes: 30,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'default-budget-warning',
    name: 'Budget approaching limit',
    enabled: true,
    type: 'budget_pct',
    condition: { metric: 'budget.maxPct', operator: 'gte', value: 80 },
    action: 'notify',
    cooldownMinutes: 60,
    createdAt: new Date().toISOString(),
  },
]

async function readAlerts(): Promise<AlertsConfig> {
  try {
    const text = await readFile(ALERTS_FILE, 'utf-8')
    return JSON.parse(text)
  } catch {
    return { rules: DEFAULT_RULES, history: [] }
  }
}

async function writeAlerts(config: AlertsConfig) {
  await mkdir(path.dirname(ALERTS_FILE), { recursive: true })
  // Keep only last 100 history entries
  config.history = config.history.slice(-100)
  await writeFile(ALERTS_FILE, JSON.stringify(config, null, 2))
}

// GET — return rules + recent alert history
export async function GET() {
  try {
    const config = await readAlerts()
    return NextResponse.json(config)
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to read alerts') },
      { status: 500 }
    )
  }
}

// POST — create or update a rule
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    let body: { action: string; rule?: Partial<AlertRule>; ruleId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const config = await readAlerts()

    if (body.action === 'create' && body.rule) {
      const rule: AlertRule = {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: body.rule.name || 'New Alert',
        enabled: body.rule.enabled !== false,
        type: body.rule.type || 'custom',
        condition: body.rule.condition || { metric: 'openrouter.usageDaily', operator: 'gt', value: 10 },
        action: body.rule.action || 'notify',
        cooldownMinutes: body.rule.cooldownMinutes ?? 60,
        createdAt: new Date().toISOString(),
      }

      config.rules.push(rule)
      await writeAlerts(config)
      return NextResponse.json({ ok: true, rule })
    }

    if (body.action === 'update' && body.ruleId && body.rule) {
      const idx = config.rules.findIndex(r => r.id === body.ruleId)
      if (idx === -1) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })

      config.rules[idx] = { ...config.rules[idx], ...body.rule }
      await writeAlerts(config)
      return NextResponse.json({ ok: true, rule: config.rules[idx] })
    }

    if (body.action === 'delete' && body.ruleId) {
      config.rules = config.rules.filter(r => r.id !== body.ruleId)
      await writeAlerts(config)
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'toggle' && body.ruleId) {
      const rule = config.rules.find(r => r.id === body.ruleId)
      if (!rule) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
      rule.enabled = !rule.enabled
      await writeAlerts(config)
      return NextResponse.json({ ok: true, rule })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to save alert') },
      { status: 500 }
    )
  }
}

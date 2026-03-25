import { NextRequest, NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/sanitize-error'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { getEffectiveConfig, DATA_DIR } from '@/lib/connection-config'
import { appendAudit } from '@/app/api/audit-log/route'

const BUDGET_FILE = path.join(DATA_DIR, 'budget.json')

interface BudgetConfig {
  dailyLimit: number
  monthlyLimit: number
  autoThrottle: boolean
  throttleMode: string
  alertThresholds: number[]
  updatedAt: string
}

const DEFAULT_BUDGET: BudgetConfig = {
  dailyLimit: 5,
  monthlyLimit: 50,
  autoThrottle: true,
  throttleMode: 'budget',
  alertThresholds: [50, 80, 95],
  updatedAt: new Date().toISOString(),
}

async function readBudget(): Promise<BudgetConfig> {
  try {
    const text = await readFile(BUDGET_FILE, 'utf-8')
    return { ...DEFAULT_BUDGET, ...JSON.parse(text) }
  } catch {
    return DEFAULT_BUDGET
  }
}

async function writeBudget(budget: BudgetConfig) {
  await mkdir(path.dirname(BUDGET_FILE), { recursive: true })
  await writeFile(BUDGET_FILE, JSON.stringify(budget, null, 2))
}

async function getOpenRouterSpend() {
  const { openrouterApiKey: key } = await getEffectiveConfig()
  if (!key) return { daily: 0, monthly: 0, remaining: 0, total: 0 }

  try {
    const [creditsRes, keyRes] = await Promise.all([
      fetch('https://openrouter.ai/api/v1/credits', {
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store',
      }),
      fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store',
      }),
    ])

    if (!creditsRes.ok || !keyRes.ok) return { daily: 0, monthly: 0, remaining: 0, total: 0 }

    const credits = await creditsRes.json()
    const keyInfo = await keyRes.json()

    return {
      daily: keyInfo.data?.usage_daily ?? 0,
      monthly: keyInfo.data?.usage_monthly ?? 0,
      remaining: (credits.data?.total_credits ?? 0) - (credits.data?.total_usage ?? 0),
      total: credits.data?.total_credits ?? 0,
    }
  } catch {
    return { daily: 0, monthly: 0, remaining: 0, total: 0 }
  }
}

const BUDGET_MODES: Record<string, { primary: string; fallbacks: string[] }> = {
  budget: {
    primary: 'openrouter/deepseek/deepseek-chat-v3-0324',
    fallbacks: ['openrouter/openai/gpt-4.1-nano', 'openrouter/google/gemini-2.5-flash'],
  },
}

async function switchToMode(mode: string) {
  const { openclawUrl: url, setupPassword: password } = await getEffectiveConfig()
  if (!url || !password) return

  const modeConfig = BUDGET_MODES[mode]
  if (!modeConfig) return

  const auth = 'Basic ' + Buffer.from(':' + password).toString('base64')
  try {
    // Fetch current config directly from OpenClaw (no self-call)
    const configRes = await fetch(`${url}/setup/api/config/raw`, {
      headers: { Authorization: auth },
      cache: 'no-store',
    })
    if (!configRes.ok) return
    const configData = await configRes.json()
    const config = JSON.parse(configData.content)

    // Update model
    if (!config.agents) config.agents = {}
    if (!config.agents.defaults) config.agents.defaults = {}
    config.agents.defaults.model = { ...modeConfig }
    if (!config.meta) config.meta = {}
    config.meta.lastTouchedAt = new Date().toISOString()

    // Save directly to OpenClaw
    await fetch(`${url}/setup/api/config/raw`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: JSON.stringify(config, null, 2) }),
    })
  } catch {
    // Best-effort — don't block the response
  }
}

export async function GET() {
  try {
    const [budget, spend] = await Promise.all([readBudget(), getOpenRouterSpend()])

    const dailyPct = budget.dailyLimit > 0 ? (spend.daily / budget.dailyLimit) * 100 : 0
    const monthlyPct = budget.monthlyLimit > 0 ? (spend.monthly / budget.monthlyLimit) * 100 : 0

    // Determine alert level
    const maxPct = Math.max(dailyPct, monthlyPct)
    let alertLevel: 'ok' | 'warning' | 'critical' | 'exceeded' = 'ok'
    if (maxPct >= 100) alertLevel = 'exceeded'
    else if (maxPct >= 95) alertLevel = 'critical'
    else if (maxPct >= 80) alertLevel = 'warning'

    // Auto-throttle: if daily or monthly limit exceeded, switch to budget mode
    // Fire-and-forget — don't block the API response
    let throttled = false
    if (budget.autoThrottle && alertLevel === 'exceeded') {
      switchToMode(budget.throttleMode).catch(() => {})
      throttled = true
    }

    return NextResponse.json({
      budget,
      spend,
      dailyPct: Math.min(dailyPct, 100),
      monthlyPct: Math.min(monthlyPct, 100),
      alertLevel,
      throttled,
      projectedDaily: spend.daily, // Current pace
      projectedMonthly: spend.daily * 30,
    })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to fetch budget') },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const current = await readBudget()

    // Validate numeric inputs — reject NaN, Infinity, negative values
    const dailyLimit = body.dailyLimit != null ? Number(body.dailyLimit) : current.dailyLimit
    const monthlyLimit = body.monthlyLimit != null ? Number(body.monthlyLimit) : current.monthlyLimit

    if (!Number.isFinite(dailyLimit) || dailyLimit < 0 || dailyLimit > 1_000_000) {
      return NextResponse.json({ error: 'Daily limit must be between 0 and 1,000,000' }, { status: 400 })
    }
    if (!Number.isFinite(monthlyLimit) || monthlyLimit < 0 || monthlyLimit > 10_000_000) {
      return NextResponse.json({ error: 'Monthly limit must be between 0 and 10,000,000' }, { status: 400 })
    }

    const updated: BudgetConfig = {
      dailyLimit,
      monthlyLimit,
      autoThrottle: typeof body.autoThrottle === 'boolean' ? body.autoThrottle : current.autoThrottle,
      throttleMode: typeof body.throttleMode === 'string' ? body.throttleMode : current.throttleMode,
      alertThresholds: Array.isArray(body.alertThresholds) ? body.alertThresholds : current.alertThresholds,
      updatedAt: new Date().toISOString(),
    }

    await writeBudget(updated)

    const changes: string[] = []
    if (current.dailyLimit !== updated.dailyLimit) changes.push(`daily $${current.dailyLimit}→$${updated.dailyLimit}`)
    if (current.monthlyLimit !== updated.monthlyLimit) changes.push(`monthly $${current.monthlyLimit}→$${updated.monthlyLimit}`)
    if (current.autoThrottle !== updated.autoThrottle) changes.push(`auto-throttle ${updated.autoThrottle ? 'on' : 'off'}`)
    if (changes.length) appendAudit('Budget updated', 'budget', changes.join(', '))

    return NextResponse.json({ ok: true, budget: updated })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to save budget') },
      { status: 500 }
    )
  }
}

import { randomUUID } from 'crypto'
import { mkdir, readFile, readdir, writeFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { isRailwayConfigured, getRailwayUsage } from '@/lib/railway'
import { DATA_DIR, getEffectiveConfig } from '@/lib/connection-config'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { sanitizeError } from '@/lib/sanitize-error'

const COSTS_FILE = path.join(DATA_DIR, 'costs.json')
const BUDGET_FILE = path.join(DATA_DIR, 'budget.json')

type ModelRate = {
  input: number
  output: number
}

export interface CostEntry {
  id: string
  instanceId: string
  agentId: string
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
  timestamp: string
  taskDescription: string
}

interface CostSettings {
  budgets: {
    daily: number
    weekly: number
    monthly: number
    warningThreshold: number
  }
  modelRates: Record<string, ModelRate>
  updatedAt: string
}

interface CostStore {
  version: number
  settings: CostSettings
  entries: CostEntry[]
}

const DEFAULT_MODEL_RATES: Record<string, ModelRate> = {
  'claude-sonnet-4': { input: 3, output: 15 },
  'deepseek-chat-v3': { input: 0.27, output: 1.1 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
}

const DEFAULT_SUBSCRIPTIONS = [
  { id: 'anthropic-pro', name: 'Anthropic Pro', cost: 20, provider: 'anthropic', cycle: 'monthly' },
]

function normalizeModelKey(model: string) {
  return String(model || '')
    .trim()
    .toLowerCase()
    .replace(/^openrouter\//, '')
}

function resolveModelRate(model: string, modelRates: Record<string, ModelRate>): ModelRate {
  const normalized = normalizeModelKey(model)
  const exact = modelRates[normalized]
  if (exact) return exact

  for (const [key, value] of Object.entries(modelRates)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value
    }
  }

  return { input: 1, output: 5 }
}

function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
  modelRates: Record<string, ModelRate>
) {
  const rate = resolveModelRate(model, modelRates)
  return Number((((inputTokens * rate.input) + (outputTokens * rate.output)) / 1_000_000).toFixed(6))
}

function seedEntry(
  id: string,
  hoursAgo: number,
  base: Omit<CostEntry, 'id' | 'timestamp' | 'cost'>,
  modelRates: Record<string, ModelRate>
): CostEntry {
  const timestamp = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
  return {
    ...base,
    id,
    timestamp,
    cost: calculateCost(base.inputTokens, base.outputTokens, base.model, modelRates),
  }
}

function createDefaultCostStore(dailyLimit = 25, monthlyLimit = 500): CostStore {
  const settings: CostSettings = {
    budgets: {
      daily: dailyLimit,
      weekly: Math.max(dailyLimit * 6, 140),
      monthly: monthlyLimit,
      warningThreshold: 80,
    },
    modelRates: DEFAULT_MODEL_RATES,
    updatedAt: new Date().toISOString(),
  }

  return {
    version: 1,
    settings,
    entries: [
      seedEntry('cost-001', 2, {
        instanceId: 'primary-studio',
        agentId: 'default',
        model: 'claude-sonnet-4',
        inputTokens: 24000,
        outputTokens: 6200,
        taskDescription: 'Launch roadmap review',
      }, settings.modelRates),
      seedEntry('cost-002', 4, {
        instanceId: 'primary-studio',
        agentId: 'scout',
        model: 'deepseek-chat-v3',
        inputTokens: 54000,
        outputTokens: 8500,
        taskDescription: 'Trend scan for AI launch week',
      }, settings.modelRates),
      seedEntry('cost-003', 7, {
        instanceId: 'primary-studio',
        agentId: 'editor',
        model: 'claude-sonnet-4',
        inputTokens: 18000,
        outputTokens: 4200,
        taskDescription: 'Landing page polish pass',
      }, settings.modelRates),
      seedEntry('cost-004', 12, {
        instanceId: 'discord-ops',
        agentId: 'support',
        model: 'gpt-4.1-mini',
        inputTokens: 12000,
        outputTokens: 3000,
        taskDescription: 'Discord support triage',
      }, settings.modelRates),
      seedEntry('cost-005', 18, {
        instanceId: 'client-sandbox',
        agentId: 'planner',
        model: 'gemini-2.5-flash',
        inputTokens: 32000,
        outputTokens: 6400,
        taskDescription: 'Client brief summarization',
      }, settings.modelRates),
      seedEntry('cost-006', 26, {
        instanceId: 'primary-studio',
        agentId: 'scout',
        model: 'deepseek-chat-v3',
        inputTokens: 41000,
        outputTokens: 5600,
        taskDescription: 'Competitor research sweep',
      }, settings.modelRates),
      seedEntry('cost-007', 32, {
        instanceId: 'primary-studio',
        agentId: 'default',
        model: 'claude-sonnet-4',
        inputTokens: 26000,
        outputTokens: 8000,
        taskDescription: 'Weekly planning sync',
      }, settings.modelRates),
      seedEntry('cost-008', 44, {
        instanceId: 'discord-ops',
        agentId: 'support',
        model: 'gpt-4.1-mini',
        inputTokens: 8000,
        outputTokens: 2200,
        taskDescription: 'Community moderation batch',
      }, settings.modelRates),
      seedEntry('cost-009', 58, {
        instanceId: 'client-sandbox',
        agentId: 'planner',
        model: 'gemini-2.5-flash',
        inputTokens: 18000,
        outputTokens: 3800,
        taskDescription: 'Sales call notes recap',
      }, settings.modelRates),
      seedEntry('cost-010', 74, {
        instanceId: 'primary-studio',
        agentId: 'editor',
        model: 'claude-sonnet-4',
        inputTokens: 15000,
        outputTokens: 2900,
        taskDescription: 'Long-form script tightening',
      }, settings.modelRates),
      seedEntry('cost-011', 96, {
        instanceId: 'primary-studio',
        agentId: 'scout',
        model: 'deepseek-chat-v3',
        inputTokens: 37000,
        outputTokens: 4900,
        taskDescription: 'Model pricing research',
      }, settings.modelRates),
      seedEntry('cost-012', 120, {
        instanceId: 'client-sandbox',
        agentId: 'default',
        model: 'gpt-4.1-mini',
        inputTokens: 22000,
        outputTokens: 4100,
        taskDescription: 'Proposal drafting pass',
      }, settings.modelRates),
      seedEntry('cost-013', 168, {
        instanceId: 'primary-studio',
        agentId: 'default',
        model: 'claude-sonnet-4',
        inputTokens: 28000,
        outputTokens: 7600,
        taskDescription: 'Channel strategy workshop',
      }, settings.modelRates),
      seedEntry('cost-014', 216, {
        instanceId: 'client-sandbox',
        agentId: 'planner',
        model: 'gemini-2.5-flash',
        inputTokens: 27000,
        outputTokens: 5200,
        taskDescription: 'Campaign prep checklist',
      }, settings.modelRates),
      seedEntry('cost-015', 264, {
        instanceId: 'primary-studio',
        agentId: 'scout',
        model: 'deepseek-chat-v3',
        inputTokens: 61000,
        outputTokens: 9200,
        taskDescription: 'Outreach list expansion',
      }, settings.modelRates),
      seedEntry('cost-016', 336, {
        instanceId: 'discord-ops',
        agentId: 'support',
        model: 'claude-sonnet-4',
        inputTokens: 11000,
        outputTokens: 2600,
        taskDescription: 'Escalation write-up',
      }, settings.modelRates),
      seedEntry('cost-017', 480, {
        instanceId: 'primary-studio',
        agentId: 'editor',
        model: 'claude-sonnet-4',
        inputTokens: 20500,
        outputTokens: 5400,
        taskDescription: 'Product Hunt post edit',
      }, settings.modelRates),
      seedEntry('cost-018', 640, {
        instanceId: 'client-sandbox',
        agentId: 'planner',
        model: 'deepseek-chat-v3',
        inputTokens: 45000,
        outputTokens: 7000,
        taskDescription: 'Market expansion outline',
      }, settings.modelRates),
    ],
  }
}

async function readJson(filename: string) {
  try {
    const filePath = path.join(DATA_DIR, filename)
    const text = await readFile(filePath, 'utf-8')
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function readBudgetDefaults() {
  const budget = await readJson('budget.json')
  return {
    dailyLimit: Number(budget?.dailyLimit || 25),
    monthlyLimit: Number(budget?.monthlyLimit || 500),
  }
}

function normalizeCostEntry(entry: Partial<CostEntry>, modelRates: Record<string, ModelRate>): CostEntry | null {
  const instanceId = String(entry.instanceId || '').trim()
  const agentId = String(entry.agentId || '').trim()
  const model = String(entry.model || '').trim()
  const taskDescription = String(entry.taskDescription || '').trim() || 'Tracked agent session'
  const inputTokens = Number(entry.inputTokens || 0)
  const outputTokens = Number(entry.outputTokens || 0)
  const timestamp = String(entry.timestamp || new Date().toISOString())

  if (!instanceId || !agentId || !model) return null
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens) || inputTokens < 0 || outputTokens < 0) return null

  return {
    id: String(entry.id || randomUUID()),
    instanceId,
    agentId,
    model,
    inputTokens,
    outputTokens,
    timestamp,
    taskDescription,
    cost: Number(entry.cost ?? calculateCost(inputTokens, outputTokens, model, modelRates)),
  }
}

function normalizeCostStore(raw: unknown, budgetDefaults: { dailyLimit: number; monthlyLimit: number }): CostStore {
  if (!raw || typeof raw !== 'object') {
    return createDefaultCostStore(budgetDefaults.dailyLimit, budgetDefaults.monthlyLimit)
  }

  const candidate = raw as Partial<CostStore> & { settings?: Partial<CostSettings> }
  const settings: CostSettings = {
    budgets: {
      daily: Number(candidate.settings?.budgets?.daily || budgetDefaults.dailyLimit),
      weekly: Number(candidate.settings?.budgets?.weekly || Math.max(budgetDefaults.dailyLimit * 6, 140)),
      monthly: Number(candidate.settings?.budgets?.monthly || budgetDefaults.monthlyLimit),
      warningThreshold: Number(candidate.settings?.budgets?.warningThreshold || 80),
    },
    modelRates: {
      ...DEFAULT_MODEL_RATES,
      ...(candidate.settings?.modelRates || {}),
    },
    updatedAt: String(candidate.settings?.updatedAt || new Date().toISOString()),
  }

  const entries = Array.isArray(candidate.entries)
    ? candidate.entries
        .map((entry) => normalizeCostEntry(entry, settings.modelRates))
        .filter((entry): entry is CostEntry => entry !== null)
    : createDefaultCostStore(budgetDefaults.dailyLimit, budgetDefaults.monthlyLimit).entries

  return {
    version: 1,
    settings,
    entries: entries.sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()),
  }
}

async function readCostStore(): Promise<CostStore> {
  const budgetDefaults = await readBudgetDefaults()

  try {
    const text = await readFile(COSTS_FILE, 'utf-8')
    return normalizeCostStore(JSON.parse(text), budgetDefaults)
  } catch {
    return createDefaultCostStore(budgetDefaults.dailyLimit, budgetDefaults.monthlyLimit)
  }
}

async function writeCostStore(store: CostStore) {
  await mkdir(path.dirname(COSTS_FILE), { recursive: true })
  await writeFile(COSTS_FILE, JSON.stringify(store, null, 2))
}

async function syncBudgetFile(settings: CostSettings) {
  const existing = (await readJson('budget.json')) || {}
  const nextBudget = {
    dailyLimit: settings.budgets.daily,
    monthlyLimit: settings.budgets.monthly,
    autoThrottle: typeof existing.autoThrottle === 'boolean' ? existing.autoThrottle : true,
    throttleMode: typeof existing.throttleMode === 'string' ? existing.throttleMode : 'budget',
    alertThresholds: Array.isArray(existing.alertThresholds) ? existing.alertThresholds : [50, 80, 95],
    updatedAt: new Date().toISOString(),
  }

  await mkdir(path.dirname(BUDGET_FILE), { recursive: true })
  await writeFile(BUDGET_FILE, JSON.stringify(nextBudget, null, 2))
}

function withinWindow(timestamp: string, days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return new Date(timestamp).getTime() >= cutoff
}

function sumCosts(entries: CostEntry[], days: number) {
  return entries
    .filter((entry) => withinWindow(entry.timestamp, days))
    .reduce((sum, entry) => sum + entry.cost, 0)
}

function summarizeEntries(entries: CostEntry[]) {
  const totalInputTokens = entries.reduce((sum, entry) => sum + entry.inputTokens, 0)
  const totalOutputTokens = entries.reduce((sum, entry) => sum + entry.outputTokens, 0)
  const totalCost = entries.reduce((sum, entry) => sum + entry.cost, 0)
  const agents = new Set(entries.map((entry) => entry.agentId))
  const instances = new Set(entries.map((entry) => entry.instanceId))

  return {
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCost: Number(totalCost.toFixed(6)),
    activeAgents: agents.size,
    activeInstances: instances.size,
    latestEntryAt: entries.length ? entries[entries.length - 1].timestamp : null,
  }
}

function buildBudgetStatus(store: CostStore) {
  const warningThreshold = store.settings.budgets.warningThreshold
  const buildBudget = (label: 'daily' | 'weekly' | 'monthly', limit: number, days: number) => {
    const spent = Number(sumCosts(store.entries, days).toFixed(6))
    const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0
    const status = percentage >= 100 ? 'exceeded' : percentage >= warningThreshold ? 'warning' : 'ok'

    return {
      label,
      limit,
      spent,
      percentage,
      status,
      warningThreshold,
    }
  }

  return {
    daily: buildBudget('daily', store.settings.budgets.daily, 1),
    weekly: buildBudget('weekly', store.settings.budgets.weekly, 7),
    monthly: buildBudget('monthly', store.settings.budgets.monthly, 30),
  }
}

function buildModelActivity(entries: CostEntry[]) {
  const modelMap = new Map<string, { model: string; cost: number; tokens: number }>()

  for (const entry of entries) {
    const current = modelMap.get(entry.model) || { model: entry.model, cost: 0, tokens: 0 }
    current.cost += entry.cost
    current.tokens += entry.inputTokens + entry.outputTokens
    modelMap.set(entry.model, current)
  }

  return Array.from(modelMap.values())
    .sort((left, right) => right.cost - left.cost)
    .map((entry) => ({
      model: entry.model,
      cost: Number(entry.cost.toFixed(6)),
      tokens: entry.tokens,
    }))
}

async function getOpenRouterData() {
  const config = await getEffectiveConfig()
  const key = config.openrouterApiKey
  const mgmtKey = config.openrouterMgmtKey
  if (!key) return null

  try {
    const fetches: Promise<Response>[] = [
      fetch('https://openrouter.ai/api/v1/credits', {
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store',
      }),
      fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store',
      }),
    ]

    if (mgmtKey) {
      fetches.push(
        fetch('https://openrouter.ai/api/v1/activity', {
          headers: { Authorization: `Bearer ${mgmtKey}` },
          cache: 'no-store',
        })
      )
    }

    const responses = await Promise.all(fetches)
    const [creditsRes, keyRes] = responses
    if (!creditsRes.ok || !keyRes.ok) return null

    const credits = await creditsRes.json()
    const keyInfo = await keyRes.json()

    let activity: { model: string; cost: number; tokens: number }[] = []
    if (mgmtKey && responses[2]?.ok) {
      const activityData = await responses[2].json()
      const modelMap = new Map<string, { cost: number; tokens: number }>()

      for (const entry of (activityData.data || [])) {
        const model = String(entry.model || entry.model_permaslug || 'unknown')
        const current = modelMap.get(model) || { cost: 0, tokens: 0 }
        current.cost += Number(entry.usage || entry.total_cost || 0)
        current.tokens += Number(entry.prompt_tokens || 0) + Number(entry.completion_tokens || 0)
        modelMap.set(model, current)
      }

      activity = Array.from(modelMap.entries()).map(([model, data]) => ({
        model,
        cost: data.cost,
        tokens: data.tokens,
      }))
    }

    return {
      totalCredits: credits.data?.total_credits ?? 0,
      totalUsage: credits.data?.total_usage ?? 0,
      remaining: (credits.data?.total_credits ?? 0) - (credits.data?.total_usage ?? 0),
      usageDaily: keyInfo.data?.usage_daily ?? 0,
      usageWeekly: keyInfo.data?.usage_weekly ?? 0,
      usageMonthly: keyInfo.data?.usage_monthly ?? 0,
      isFreeTier: keyInfo.data?.is_free_tier ?? false,
      activity,
    }
  } catch {
    return null
  }
}

function buildOpenRouterFallback(store: CostStore) {
  const activity = buildModelActivity(store.entries)
  return {
    totalCredits: 0,
    totalUsage: Number(store.entries.reduce((sum, entry) => sum + entry.cost, 0).toFixed(6)),
    remaining: 0,
    usageDaily: Number(sumCosts(store.entries, 1).toFixed(6)),
    usageWeekly: Number(sumCosts(store.entries, 7).toFixed(6)),
    usageMonthly: Number(sumCosts(store.entries, 30).toFixed(6)),
    isFreeTier: false,
    activity,
  }
}

async function getUploadedProviderCosts(): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {}
  try {
    const files = await readdir(DATA_DIR)
    for (const file of files) {
      const match = file.match(/^(.+)-costs\.json$/)
      if (match && match[1] !== 'anthropic' && match[1] !== 'openai') {
        const data = await readJson(file)
        if (data) result[match[1]] = data
      }
    }
  } catch {
    // no-op
  }
  return result
}

function getSessionCostsPayload(store: CostStore) {
  const entries = [...store.entries].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
  )

  return {
    settings: store.settings,
    entries,
    summary: summarizeEntries(entries),
    budgetStatus: buildBudgetStatus(store),
    modelBreakdown: buildModelActivity(entries),
  }
}

export async function GET() {
  try {
    const store = await readCostStore()
    const [anthropicCosts, anthropicTokens, savedSubscriptions, openrouterLive, railway, providerCosts] = await Promise.all([
      readJson('anthropic-costs.json'),
      readJson('anthropic-tokens.json'),
      readJson('subscriptions.json'),
      getOpenRouterData(),
      isRailwayConfigured()
        ? getRailwayUsage().catch((error) => ({ error: error instanceof Error ? error.message : 'Failed to fetch Railway data' }))
        : Promise.resolve(null),
      getUploadedProviderCosts(),
    ])

    const openrouterFallback = buildOpenRouterFallback(store)
    const openrouter = openrouterLive
      ? {
          ...openrouterFallback,
          ...openrouterLive,
          activity: Array.isArray(openrouterLive.activity) && openrouterLive.activity.length > 0
            ? openrouterLive.activity
            : openrouterFallback.activity,
          usageDaily: openrouterLive.usageDaily || openrouterFallback.usageDaily,
          usageWeekly: openrouterLive.usageWeekly || openrouterFallback.usageWeekly,
          usageMonthly: openrouterLive.usageMonthly || openrouterFallback.usageMonthly,
        }
      : openrouterFallback

    return NextResponse.json({
      railway,
      anthropicCosts,
      anthropicTokens,
      subscriptions: savedSubscriptions ?? DEFAULT_SUBSCRIPTIONS,
      openrouter,
      providerCosts,
      sessionCosts: getSessionCostsPayload(store),
    })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to fetch cost data') },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const store = await readCostStore()
    const action = typeof body.action === 'string' ? body.action : 'log'

    if (action === 'updateSettings') {
      const budgets = body.settings?.budgets || {}
      const modelRatesInput = body.settings?.modelRates
      const daily = Number(budgets.daily)
      const weekly = Number(budgets.weekly)
      const monthly = Number(budgets.monthly)
      const warningThreshold = Number(budgets.warningThreshold || store.settings.budgets.warningThreshold || 80)

      if (!Number.isFinite(daily) || daily <= 0 || !Number.isFinite(weekly) || weekly <= 0 || !Number.isFinite(monthly) || monthly <= 0) {
        return NextResponse.json({ error: 'Budget limits must be positive numbers' }, { status: 400 })
      }

      if (!Number.isFinite(warningThreshold) || warningThreshold < 1 || warningThreshold >= 100) {
        return NextResponse.json({ error: 'Warning threshold must be between 1 and 99' }, { status: 400 })
      }

      const nextModelRates: Record<string, ModelRate> = {}
      if (modelRatesInput && typeof modelRatesInput === 'object') {
        for (const [model, rate] of Object.entries(modelRatesInput as Record<string, unknown>)) {
          const normalizedModel = normalizeModelKey(model)
          const input = Number((rate as { input?: number }).input)
          const output = Number((rate as { output?: number }).output)
          if (!normalizedModel) continue
          if (!Number.isFinite(input) || input < 0 || !Number.isFinite(output) || output < 0) continue
          nextModelRates[normalizedModel] = { input, output }
        }
      }

      store.settings = {
        budgets: {
          daily,
          weekly,
          monthly,
          warningThreshold,
        },
        modelRates: Object.keys(nextModelRates).length > 0 ? nextModelRates : store.settings.modelRates,
        updatedAt: new Date().toISOString(),
      }

      await writeCostStore(store)
      await syncBudgetFile(store.settings)

      return NextResponse.json({ ok: true, settings: store.settings })
    }

    const entry = normalizeCostEntry(body, store.settings.modelRates)
    if (!entry) {
      return NextResponse.json({ error: 'Missing required usage fields' }, { status: 400 })
    }

    store.entries = [...store.entries, entry]
      .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
      .slice(-5000)

    await writeCostStore(store)

    return NextResponse.json({
      ok: true,
      entry,
      sessionCosts: getSessionCostsPayload(store),
    })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to update cost data') },
      { status: 500 }
    )
  }
}

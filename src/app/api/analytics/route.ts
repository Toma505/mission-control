import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'
import { getLocalApiOrigin } from '@/lib/local-api-origin'

export const dynamic = 'force-dynamic'

type ModelUsage = {
  model: string
  cost: number
  tokens: number
  promptTokens?: number
  completionTokens?: number
}

type DailyUsage = {
  date: string
  cost: number
  tokens?: number
}

const FALLBACK_AGENT_MODELS: Record<string, string> = {
  default: 'claude-sonnet-4.6',
  scout: 'deepseek-chat-v3',
  editor: 'claude-haiku-4.5',
}

async function readJson<T>(filename: string): Promise<T | null> {
  try {
    const text = await readFile(path.join(DATA_DIR, filename), 'utf-8')
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function detectProvider(model: string) {
  const normalized = model.toLowerCase()
  if (normalized.includes('claude') || normalized.includes('anthropic')) return 'Anthropic'
  if (normalized.includes('gpt') || normalized.includes('openai')) return 'OpenAI'
  if (normalized.includes('deepseek')) return 'OpenRouter'
  if (normalized.includes('gemini') || normalized.includes('google')) return 'Google'
  return 'Other'
}

function detectAnomaly(dailyTrend: DailyUsage[]) {
  if (dailyTrend.length < 3) return { detected: false, message: '' }

  const costs = dailyTrend.map((entry) => entry.cost).filter((value) => value > 0)
  if (costs.length < 3) return { detected: false, message: '' }

  const average = costs.reduce((sum, value) => sum + value, 0) / costs.length
  const lastDay = costs[costs.length - 1]

  if (lastDay > average * 3 && lastDay > 1) {
    return {
      detected: true,
      message: `Today's spend ($${lastDay.toFixed(2)}) is ${(lastDay / average).toFixed(1)}x your daily average ($${average.toFixed(2)}).`,
    }
  }

  return { detected: false, message: '' }
}

function addUsage(map: Map<string, ModelUsage>, usage: ModelUsage) {
  const current = map.get(usage.model) || {
    model: usage.model,
    cost: 0,
    tokens: 0,
    promptTokens: 0,
    completionTokens: 0,
  }

  current.cost += usage.cost
  current.tokens += usage.tokens
  current.promptTokens = (current.promptTokens || 0) + (usage.promptTokens || 0)
  current.completionTokens = (current.completionTokens || 0) + (usage.completionTokens || 0)
  map.set(usage.model, current)
}

function buildFallbackModelUsage(activities: any[]) {
  const modelMap = new Map<string, ModelUsage>()

  for (const activity of activities) {
    const model = FALLBACK_AGENT_MODELS[activity.agent as string]
    if (!model) continue

    addUsage(modelMap, {
      model,
      cost: Number(activity.cost || 0),
      tokens: Number(activity.tokens || 0),
    })
  }

  return modelMap
}

function buildAnthropicUsage(costs: any, tokens: any) {
  const modelMap = new Map<string, ModelUsage>()
  const rows = Array.isArray(tokens?.rows) ? tokens.rows : []
  const totalAnthropicCost = Array.isArray(costs?.days)
    ? costs.days.reduce((sum: number, day: { total?: number }) => sum + Number(day.total || 0), 0)
    : 0

  const totalTokens = rows.reduce(
    (sum: number, row: { input?: number; cacheWrite?: number; cacheRead?: number; output?: number }) =>
      sum + Number(row.input || 0) + Number(row.cacheWrite || 0) + Number(row.cacheRead || 0) + Number(row.output || 0),
    0,
  )

  for (const row of rows) {
    const tokenCount =
      Number(row.input || 0) +
      Number(row.cacheWrite || 0) +
      Number(row.cacheRead || 0) +
      Number(row.output || 0)

    const proportionalCost = totalTokens > 0 ? totalAnthropicCost * (tokenCount / totalTokens) : 0

    addUsage(modelMap, {
      model: String(row.model || 'claude-sonnet-4.6'),
      cost: proportionalCost,
      tokens: tokenCount,
      promptTokens: Number(row.input || 0) + Number(row.cacheWrite || 0) + Number(row.cacheRead || 0),
      completionTokens: Number(row.output || 0),
    })
  }

  if (modelMap.size === 0 && totalAnthropicCost > 0) {
    addUsage(modelMap, {
      model: String(costs?.model || 'claude-sonnet-4.6'),
      cost: totalAnthropicCost,
      tokens: 0,
    })
  }

  return modelMap
}

export async function GET(request: NextRequest) {
  const origin = getLocalApiOrigin(request)

  try {
    const [
      costsRes,
      historyRes,
      fallbackHistory,
      fallbackAnthropicCosts,
      fallbackAnthropicTokens,
      activities,
    ] = await Promise.all([
      fetch(`${origin}/api/costs`, { cache: 'no-store' }),
      fetch(`${origin}/api/costs/history?range=30d`, { cache: 'no-store' }),
      readJson<any[]>('cost-history.json'),
      readJson<any>('anthropic-costs.json'),
      readJson<any>('anthropic-tokens.json'),
      readJson<any[]>('activities.json'),
    ])

    const costs = costsRes.ok ? await costsRes.json() : {}
    const history = historyRes.ok ? await historyRes.json() : {}

    const normalizedCosts = {
      ...costs,
      anthropicCosts: costs?.anthropicCosts || fallbackAnthropicCosts,
      anthropicTokens: costs?.anthropicTokens || fallbackAnthropicTokens,
    }

    const normalizedHistory = history?.history?.length
      ? history
      : { history: fallbackHistory || [] }

    const modelMap = new Map<string, ModelUsage>()

    if (Array.isArray(normalizedCosts?.openrouter?.activity)) {
      for (const entry of normalizedCosts.openrouter.activity) {
        addUsage(modelMap, {
          model: String(entry.model || 'openrouter'),
          cost: Number(entry.cost || 0),
          tokens: Number(entry.tokens || 0),
        })
      }
    }

    for (const usage of buildAnthropicUsage(normalizedCosts?.anthropicCosts, normalizedCosts?.anthropicTokens).values()) {
      addUsage(modelMap, usage)
    }

    if (modelMap.size === 0) {
      for (const usage of buildFallbackModelUsage(Array.isArray(activities) ? activities : []).values()) {
        addUsage(modelMap, usage)
      }
    }

    const modelBreakdown = Array.from(modelMap.values()).sort((left, right) => right.cost - left.cost)
    const totalTokens = modelBreakdown.reduce((sum, entry) => sum + entry.tokens, 0)
    const totalCost = modelBreakdown.reduce((sum, entry) => sum + entry.cost, 0)
    const avgCostPerKTokens = totalTokens > 0 ? (totalCost / totalTokens) * 1000 : 0

    const dailyTrend: DailyUsage[] = Array.isArray(normalizedHistory?.history)
      ? normalizedHistory.history.map((entry: any) => ({
          date: String(entry.date || ''),
          cost: Number(entry.total || 0),
          tokens: undefined,
        }))
      : []

    const providerMap = new Map<string, { provider: string; tokens: number; cost: number }>()
    for (const usage of modelBreakdown) {
      const provider = detectProvider(usage.model)
      const current = providerMap.get(provider) || { provider, tokens: 0, cost: 0 }
      current.tokens += usage.tokens
      current.cost += usage.cost
      providerMap.set(provider, current)
    }

    const efficientModels = modelBreakdown.filter((entry) => entry.tokens > 0)
    const cheapestModel = [...efficientModels]
      .sort((left, right) => (left.cost / left.tokens) - (right.cost / right.tokens))[0]?.model || 'N/A'
    const mostExpensiveModel = [...efficientModels]
      .sort((left, right) => (right.cost / right.tokens) - (left.cost / left.tokens))[0]?.model || 'N/A'
    const anomaly = detectAnomaly(dailyTrend)

    return NextResponse.json({
      costs: normalizedCosts,
      history: normalizedHistory,
      totalTokens,
      totalCost,
      avgCostPerKTokens,
      modelBreakdown,
      dailyTrend,
      topModel: modelBreakdown[0]?.model || 'N/A',
      cheapestModel,
      mostExpensiveModel,
      tokensByProvider: Array.from(providerMap.values()),
      anomalyDetected: anomaly.detected,
      anomalyMessage: anomaly.message,
      dataAvailable: modelBreakdown.length > 0 || dailyTrend.length > 0,
    })
  } catch {
    return NextResponse.json({
      costs: null,
      history: null,
      totalTokens: 0,
      totalCost: 0,
      avgCostPerKTokens: 0,
      modelBreakdown: [],
      dailyTrend: [],
      topModel: 'N/A',
      cheapestModel: 'N/A',
      mostExpensiveModel: 'N/A',
      tokensByProvider: [],
      anomalyDetected: false,
      anomalyMessage: '',
      dataAvailable: false,
    })
  }
}

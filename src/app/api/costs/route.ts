import { NextResponse } from 'next/server'
import { isRailwayConfigured, getRailwayUsage } from '@/lib/railway'
import { readFile } from 'fs/promises'
import path from 'path'
import { getEffectiveConfig, DATA_DIR } from '@/lib/connection-config'

async function readJson(filename: string) {
  try {
    const filePath = path.join(DATA_DIR, filename)
    const text = await readFile(filePath, 'utf-8')
    return JSON.parse(text)
  } catch {
    return null
  }
}

const DEFAULT_SUBSCRIPTIONS = [
  { id: 'anthropic-pro', name: 'Anthropic Pro', cost: 20, provider: 'anthropic', cycle: 'monthly' },
]

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

    // Activity endpoint requires management key
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

    // Parse activity data (per-model usage)
    let activity: { model: string; cost: number; tokens: number }[] = []
    if (mgmtKey && responses[2]?.ok) {
      const activityData = await responses[2].json()
      // Aggregate by model (API returns per-provider breakdowns)
      const modelMap = new Map<string, { cost: number; tokens: number }>()
      for (const entry of (activityData.data || [])) {
        const model = String(entry.model || entry.model_permaslug || 'unknown')
        const existing = modelMap.get(model) || { cost: 0, tokens: 0 }
        existing.cost += Number(entry.usage || entry.total_cost || 0)
        existing.tokens += Number((entry.prompt_tokens || 0)) + Number((entry.completion_tokens || 0))
        modelMap.set(model, existing)
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

export async function GET() {
  try {
    const [anthropicCosts, anthropicTokens, savedSubscriptions, openrouter, railway] = await Promise.all([
      readJson('anthropic-costs.json'),
      readJson('anthropic-tokens.json'),
      readJson('subscriptions.json'),
      getOpenRouterData(),
      isRailwayConfigured()
        ? getRailwayUsage().catch((e) => ({ error: e instanceof Error ? e.message : 'Failed to fetch Railway data' }))
        : Promise.resolve(null),
    ])
    const subscriptions = savedSubscriptions ?? DEFAULT_SUBSCRIPTIONS

    return NextResponse.json({ railway, anthropicCosts, anthropicTokens, subscriptions, openrouter })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch cost data' }, { status: 500 })
  }
}

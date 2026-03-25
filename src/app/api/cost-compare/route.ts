import { NextResponse } from 'next/server'
import { getEffectiveConfig } from '@/lib/connection-config'

// Pricing per 1M tokens (input / output) — approximate as of early 2026
const MODEL_PRICING: Record<string, { input: number; output: number; provider: string; label: string }> = {
  // Anthropic
  'claude-opus-4-6':      { input: 15, output: 75, provider: 'Anthropic', label: 'Claude Opus 4.6' },
  'claude-sonnet-4-6':    { input: 3, output: 15, provider: 'Anthropic', label: 'Claude Sonnet 4.6' },
  'claude-haiku-4-5':     { input: 0.80, output: 4, provider: 'Anthropic', label: 'Claude Haiku 4.5' },
  // OpenAI
  'gpt-4.1':              { input: 2.5, output: 10, provider: 'OpenAI', label: 'GPT-4.1' },
  'gpt-4.1-mini':         { input: 0.40, output: 1.60, provider: 'OpenAI', label: 'GPT-4.1 Mini' },
  'gpt-4.1-nano':         { input: 0.10, output: 0.40, provider: 'OpenAI', label: 'GPT-4.1 Nano' },
  // Google
  'gemini-3.1-pro':       { input: 1.25, output: 5, provider: 'Google', label: 'Gemini 3.1 Pro' },
  'gemini-2.5-flash':     { input: 0.15, output: 0.60, provider: 'Google', label: 'Gemini 2.5 Flash' },
  // Deepseek
  'deepseek-chat-v3':     { input: 0.27, output: 1.10, provider: 'Deepseek', label: 'Deepseek V3' },
  'deepseek-r1':          { input: 0.55, output: 2.19, provider: 'Deepseek', label: 'Deepseek R1' },
  // Local / Self-hosted
  'local-llama-70b':      { input: 0, output: 0, provider: 'Local', label: 'Llama 3 70B (self-hosted)' },
  'local-qwen-32b':       { input: 0, output: 0, provider: 'Local', label: 'Qwen 2.5 32B (self-hosted)' },
}

// Tier grouping for comparison
const TIERS = {
  premium: ['claude-opus-4-6', 'gpt-4.1'],
  balanced: ['claude-sonnet-4-6', 'gemini-3.1-pro', 'deepseek-r1'],
  budget: ['claude-haiku-4-5', 'gpt-4.1-mini', 'gemini-2.5-flash', 'deepseek-chat-v3'],
  free: ['gpt-4.1-nano', 'local-llama-70b', 'local-qwen-32b'],
}

async function getCurrentUsage() {
  const config = await getEffectiveConfig()
  const key = config.openrouterApiKey
  if (!key) return null

  try {
    const [keyRes, activityRes] = await Promise.all([
      fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store',
      }),
      config.openrouterMgmtKey
        ? fetch('https://openrouter.ai/api/v1/activity', {
            headers: { Authorization: `Bearer ${config.openrouterMgmtKey}` },
            cache: 'no-store',
          })
        : Promise.resolve(null),
    ])

    if (!keyRes.ok) return null
    const keyData = await keyRes.json()

    let totalInputTokens = 0
    let totalOutputTokens = 0
    let currentModel = ''

    if (activityRes && activityRes.ok) {
      const activity = await activityRes.json()
      for (const entry of (activity.data || [])) {
        totalInputTokens += Number(entry.prompt_tokens || 0)
        totalOutputTokens += Number(entry.completion_tokens || 0)
        if (!currentModel && entry.model) currentModel = String(entry.model)
      }
    }

    // If no activity data, estimate from monthly spend
    if (totalInputTokens === 0 && totalOutputTokens === 0) {
      const monthlySpend = keyData.data?.usage_monthly ?? 0
      // Rough estimate: assume 60/40 input/output split, sonnet-tier pricing
      totalInputTokens = Math.round((monthlySpend * 0.6 / 3) * 1_000_000)
      totalOutputTokens = Math.round((monthlySpend * 0.4 / 15) * 1_000_000)
    }

    return {
      dailySpend: keyData.data?.usage_daily ?? 0,
      monthlySpend: keyData.data?.usage_monthly ?? 0,
      totalInputTokens,
      totalOutputTokens,
      currentModel,
    }
  } catch {
    return null
  }
}

export async function GET() {
  const usage = await getCurrentUsage()

  // Calculate what the same token volume would cost on each model
  const comparisons = Object.entries(MODEL_PRICING).map(([id, pricing]) => {
    const inputTokensM = (usage?.totalInputTokens ?? 100000) / 1_000_000
    const outputTokensM = (usage?.totalOutputTokens ?? 50000) / 1_000_000
    const estimatedCost = inputTokensM * pricing.input + outputTokensM * pricing.output

    return {
      id,
      ...pricing,
      estimatedMonthlyCost: Math.round(estimatedCost * 100) / 100,
    }
  })

  comparisons.sort((a, b) => a.estimatedMonthlyCost - b.estimatedMonthlyCost)

  return NextResponse.json({
    usage,
    comparisons,
    tiers: TIERS,
    pricing: MODEL_PRICING,
  })
}

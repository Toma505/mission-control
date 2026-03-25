import { NextResponse } from 'next/server'
import { getEffectiveConfig, DATA_DIR } from '@/lib/connection-config'
import { readFile } from 'fs/promises'
import path from 'path'

// Same pricing table as cost-compare
const PRICING: Record<string, { input: number; output: number; label: string }> = {
  'claude-opus-4-6':   { input: 15, output: 75, label: 'Claude Opus 4.6' },
  'claude-sonnet-4-6': { input: 3, output: 15, label: 'Claude Sonnet 4.6' },
  'claude-haiku-4-5':  { input: 0.80, output: 4, label: 'Claude Haiku 4.5' },
  'gpt-4.1':           { input: 2.5, output: 10, label: 'GPT-4.1' },
  'gpt-4.1-mini':      { input: 0.40, output: 1.60, label: 'GPT-4.1 Mini' },
  'gemini-3.1-pro':    { input: 1.25, output: 5, label: 'Gemini 3.1 Pro' },
  'gemini-2.5-flash':  { input: 0.15, output: 0.60, label: 'Gemini 2.5 Flash' },
  'deepseek-chat-v3':  { input: 0.27, output: 1.10, label: 'Deepseek V3' },
}

interface Recommendation {
  type: 'switch' | 'throttle' | 'schedule' | 'info'
  title: string
  description: string
  savingsPercent?: number
  savingsAmount?: number
}

async function getBudget() {
  try {
    const text = await readFile(path.join(DATA_DIR, 'budget.json'), 'utf-8')
    return JSON.parse(text)
  } catch {
    return { dailyLimit: 5, monthlyLimit: 50 }
  }
}

export async function GET() {
  const config = await getEffectiveConfig()
  const key = config.openrouterApiKey
  const budget = await getBudget()

  let dailySpend = 0
  let monthlySpend = 0

  if (key) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        dailySpend = data.data?.usage_daily ?? 0
        monthlySpend = data.data?.usage_monthly ?? 0
      }
    } catch { /* ignore */ }
  }

  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth = now.getDate()
  const daysRemaining = daysInMonth - dayOfMonth

  // Projections
  const dailyAvg = dayOfMonth > 1 ? monthlySpend / dayOfMonth : dailySpend
  const projectedMonthly = dailyAvg * daysInMonth
  const projectedRemaining = dailyAvg * daysRemaining
  const projectedEndOfMonth = monthlySpend + projectedRemaining

  // Budget analysis
  const dailyBudget = budget.dailyLimit || 5
  const monthlyBudget = budget.monthlyLimit || 50
  const monthlyPct = monthlyBudget > 0 ? (projectedEndOfMonth / monthlyBudget) * 100 : 0
  const daysUntilBudgetExceeded = dailyAvg > 0
    ? Math.max(0, Math.floor((monthlyBudget - monthlySpend) / dailyAvg))
    : daysRemaining

  // Generate recommendations
  const recommendations: Recommendation[] = []

  // Recommendation: switch to cheaper model
  if (dailyAvg > 0) {
    // Estimate token volumes from spend (assume sonnet-tier pricing)
    const inputTokensM = (monthlySpend * 0.6 / 3)
    const outputTokensM = (monthlySpend * 0.4 / 15)

    // Find the best cost-saving switch
    let bestSaving = 0
    let bestModel = ''
    let bestLabel = ''
    for (const [id, p] of Object.entries(PRICING)) {
      if (id.includes('opus')) continue // skip premium
      const altCost = inputTokensM * p.input + outputTokensM * p.output
      const saving = projectedEndOfMonth - altCost
      if (saving > bestSaving) {
        bestSaving = saving
        bestModel = id
        bestLabel = p.label
      }
    }

    if (bestSaving > 1 && bestModel) {
      const pct = Math.round((bestSaving / projectedEndOfMonth) * 100)
      recommendations.push({
        type: 'switch',
        title: `Switch to ${bestLabel}`,
        description: `Save ~$${bestSaving.toFixed(2)}/mo (${pct}%) by switching your primary model.`,
        savingsPercent: pct,
        savingsAmount: Math.round(bestSaving * 100) / 100,
      })
    }
  }

  // Recommendation: budget warning
  if (monthlyPct > 100) {
    recommendations.push({
      type: 'throttle',
      title: 'Projected to exceed monthly budget',
      description: `At current pace, you'll spend $${projectedEndOfMonth.toFixed(2)} against a $${monthlyBudget} limit. Consider enabling auto-throttle.`,
    })
  } else if (monthlyPct > 80) {
    recommendations.push({
      type: 'info',
      title: 'Approaching monthly budget',
      description: `Projected ${Math.round(monthlyPct)}% of your $${monthlyBudget} monthly limit. ${daysUntilBudgetExceeded} days until limit at current pace.`,
    })
  }

  // Recommendation: schedule budget mode during off-hours
  if (dailyAvg > dailyBudget * 0.7) {
    recommendations.push({
      type: 'schedule',
      title: 'Schedule Budget Mode overnight',
      description: `Your daily average ($${dailyAvg.toFixed(2)}) is close to your $${dailyBudget} daily limit. Auto-switch to Budget mode during off-hours to save.`,
    })
  }

  // Recommendation: good standing
  if (recommendations.length === 0 && monthlySpend > 0) {
    recommendations.push({
      type: 'info',
      title: 'Spending looks healthy',
      description: `Projected $${projectedEndOfMonth.toFixed(2)} this month, well within your $${monthlyBudget} budget.`,
    })
  }

  return NextResponse.json({
    current: {
      dailySpend: Math.round(dailySpend * 100) / 100,
      monthlySpend: Math.round(monthlySpend * 100) / 100,
      dailyAvg: Math.round(dailyAvg * 100) / 100,
    },
    forecast: {
      projectedMonthly: Math.round(projectedMonthly * 100) / 100,
      projectedEndOfMonth: Math.round(projectedEndOfMonth * 100) / 100,
      projectedRemaining: Math.round(projectedRemaining * 100) / 100,
      daysRemaining,
      daysInMonth,
      dayOfMonth,
      monthlyPct: Math.round(monthlyPct),
      daysUntilBudgetExceeded,
    },
    budget: {
      dailyLimit: dailyBudget,
      monthlyLimit: monthlyBudget,
    },
    recommendations,
  })
}

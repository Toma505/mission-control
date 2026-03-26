import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { getEffectiveConfig, DATA_DIR } from '@/lib/connection-config'

interface ModelBenchmark {
  model: string
  provider: string
  totalCost: number
  totalTokens: number
  costPerKTokens: number
  avgResponseTime?: number
  usageShare: number
  efficiency: 'excellent' | 'good' | 'fair' | 'poor'
}

/** GET — compute model performance benchmarks from live data */
export async function GET() {
  try {
    const config = await getEffectiveConfig()
    const benchmarks: ModelBenchmark[] = []
    let grandTotalTokens = 0
    let grandTotalCost = 0

    // Fetch OpenRouter model data
    if (config.openrouterApiKey) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { Authorization: `Bearer ${config.openrouterApiKey}` },
          cache: 'no-store',
        })
        if (res.ok) {
          const data = await res.json()
          const models = data.data?.models || []
          for (const m of models) {
            const tokens = (m.prompt_tokens || 0) + (m.completion_tokens || 0)
            const cost = m.total_cost || 0
            if (tokens > 0) {
              grandTotalTokens += tokens
              grandTotalCost += cost
              benchmarks.push({
                model: m.id || 'unknown',
                provider: 'OpenRouter',
                totalCost: cost,
                totalTokens: tokens,
                costPerKTokens: (cost / tokens) * 1000,
                usageShare: 0, // Computed below
                efficiency: 'good',
              })
            }
          }
        }
      } catch {}
    }

    // If no benchmarks from OpenRouter, try local cost data
    if (benchmarks.length === 0) {
      try {
        const orData = JSON.parse(await readFile(path.join(DATA_DIR, 'openrouter-costs.json'), 'utf-8'))
        if (orData.days && Array.isArray(orData.days)) {
          const totalCost = orData.days.reduce((s: number, d: any) => s + (d.total || 0), 0)
          const model = orData.model || 'deepseek/deepseek-chat-v3-0324'
          const estimatedTokens = Math.round(totalCost / 0.0015 * 1000) // rough estimate
          grandTotalCost = totalCost
          grandTotalTokens = estimatedTokens
          benchmarks.push({
            model,
            provider: 'OpenRouter',
            totalCost,
            totalTokens: estimatedTokens,
            costPerKTokens: estimatedTokens > 0 ? (totalCost / estimatedTokens) * 1000 : 0,
            usageShare: 100,
            efficiency: 'good',
          })
        }
      } catch {}
    }

    // Compute usage share and efficiency rating
    for (const b of benchmarks) {
      b.usageShare = grandTotalTokens > 0 ? (b.totalTokens / grandTotalTokens) * 100 : 0

      if (b.costPerKTokens < 0.5) b.efficiency = 'excellent'
      else if (b.costPerKTokens < 2) b.efficiency = 'good'
      else if (b.costPerKTokens < 8) b.efficiency = 'fair'
      else b.efficiency = 'poor'
    }

    // Sort by cost descending
    benchmarks.sort((a, b) => b.totalCost - a.totalCost)

    // Recommendations
    const recommendations: string[] = []
    const cheapest = [...benchmarks].sort((a, b) => a.costPerKTokens - b.costPerKTokens)[0]
    const mostExpensive = [...benchmarks].sort((a, b) => b.costPerKTokens - a.costPerKTokens)[0]
    const mostUsed = [...benchmarks].sort((a, b) => b.totalTokens - a.totalTokens)[0]

    if (cheapest && mostExpensive && cheapest.model !== mostExpensive.model) {
      const savings = ((mostExpensive.costPerKTokens - cheapest.costPerKTokens) / mostExpensive.costPerKTokens * 100).toFixed(0)
      recommendations.push(
        `Switching from ${mostExpensive.model.split('/').pop()} to ${cheapest.model.split('/').pop()} could save ~${savings}% per token`
      )
    }

    if (mostUsed && mostUsed.efficiency === 'poor') {
      recommendations.push(
        `Your most-used model (${mostUsed.model.split('/').pop()}) has poor cost efficiency — consider alternatives`
      )
    }

    if (benchmarks.length > 3) {
      const lowUsage = benchmarks.filter(b => b.usageShare < 5)
      if (lowUsage.length > 0) {
        recommendations.push(
          `${lowUsage.length} model${lowUsage.length > 1 ? 's' : ''} account for less than 5% usage each — consider consolidating`
        )
      }
    }

    return NextResponse.json({
      benchmarks,
      summary: {
        totalModels: benchmarks.length,
        totalCost: grandTotalCost,
        totalTokens: grandTotalTokens,
        avgCostPerK: grandTotalTokens > 0 ? (grandTotalCost / grandTotalTokens) * 1000 : 0,
      },
      recommendations,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to compute benchmarks' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'

const HISTORY_FILE = path.join(DATA_DIR, 'cost-history.json')

interface CostSnapshot {
  date: string
  openrouter: number
  anthropic: number
  railway: number
  subscriptions: number
  total: number
}

interface ForecastPoint {
  date: string
  predicted: number
  lower: number
  upper: number
}

interface Recommendation {
  type: 'warning' | 'savings' | 'info'
  title: string
  description: string
  impact?: string
}

async function readHistory(): Promise<CostSnapshot[]> {
  try {
    const text = await readFile(HISTORY_FILE, 'utf-8')
    return JSON.parse(text)
  } catch {
    return []
  }
}

/**
 * Simple linear regression: y = mx + b
 */
function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number; r2: number } {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 }

  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0)
  const sumY2 = points.reduce((s, p) => s + p.y * p.y, 0)

  const denominator = n * sumX2 - sumX * sumX
  if (denominator === 0) return { slope: 0, intercept: sumY / n, r2: 0 }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  // R² (coefficient of determination)
  const meanY = sumY / n
  const ssRes = points.reduce((s, p) => s + Math.pow(p.y - (slope * p.x + intercept), 2), 0)
  const ssTot = points.reduce((s, p) => s + Math.pow(p.y - meanY, 2), 0)
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0

  return { slope, intercept, r2 }
}

/**
 * Exponential weighted moving average for smoothing.
 */
function ewma(values: number[], alpha: number = 0.3): number[] {
  if (values.length === 0) return []
  const result = [values[0]]
  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i] + (1 - alpha) * result[i - 1])
  }
  return result
}

/**
 * Detect weekly seasonality pattern from daily data.
 */
function weeklyPattern(snapshots: CostSnapshot[]): number[] {
  // Average spending per day of week (0=Sun, 6=Sat)
  const dayTotals = Array(7).fill(0)
  const dayCounts = Array(7).fill(0)

  for (const s of snapshots) {
    const dow = new Date(s.date + 'T00:00:00').getDay()
    dayTotals[dow] += s.total
    dayCounts[dow]++
  }

  const overallAvg = snapshots.reduce((s, d) => s + d.total, 0) / snapshots.length

  // Seasonal factor: how much each day deviates from the average
  return dayTotals.map((total, i) => {
    if (dayCounts[i] === 0) return 1
    const dayAvg = total / dayCounts[i]
    return overallAvg > 0 ? dayAvg / overallAvg : 1
  })
}

/**
 * Generate forecast using linear regression + weekly seasonality + EWMA smoothing.
 */
function generateForecast(history: CostSnapshot[], forecastDays: number): ForecastPoint[] {
  if (history.length < 3) return []

  // Prepare regression points (x = day index, y = total spend)
  const points = history.map((s, i) => ({ x: i, y: s.total }))
  const { slope, intercept, r2 } = linearRegression(points)

  // Get weekly seasonality
  const seasonal = weeklyPattern(history)

  // Calculate residual standard deviation for confidence intervals
  const predictions = points.map(p => slope * p.x + intercept)
  const residuals = points.map((p, i) => p.y - predictions[i])
  const residualStd = Math.sqrt(
    residuals.reduce((s, r) => s + r * r, 0) / Math.max(residuals.length - 2, 1)
  )

  // Smooth recent trend with EWMA
  const smoothed = ewma(history.map(s => s.total))
  const recentTrend = smoothed.length > 0 ? smoothed[smoothed.length - 1] : intercept

  // Generate future points
  const forecast: ForecastPoint[] = []
  const lastDate = new Date(history[history.length - 1].date + 'T00:00:00')
  const n = history.length

  for (let d = 1; d <= forecastDays; d++) {
    const futureDate = new Date(lastDate)
    futureDate.setDate(futureDate.getDate() + d)

    const dateStr = futureDate.toISOString().split('T')[0]
    const dow = futureDate.getDay()

    // Blend linear regression with EWMA for prediction
    const linearPred = slope * (n + d - 1) + intercept
    const blended = r2 > 0.5
      ? 0.6 * linearPred + 0.4 * recentTrend
      : 0.3 * linearPred + 0.7 * recentTrend

    // Apply seasonality
    const predicted = Math.max(0, blended * seasonal[dow])

    // Confidence interval widens as we forecast further out
    const uncertainty = residualStd * Math.sqrt(1 + d / n)
    const lower = Math.max(0, predicted - 1.96 * uncertainty)
    const upper = predicted + 1.96 * uncertainty

    forecast.push({
      date: dateStr,
      predicted: Math.round(predicted * 100) / 100,
      lower: Math.round(lower * 100) / 100,
      upper: Math.round(upper * 100) / 100,
    })
  }

  return forecast
}

/**
 * Generate actionable recommendations based on spending patterns.
 */
function generateRecommendations(
  history: CostSnapshot[],
  forecast: ForecastPoint[],
  monthlyBudget?: number
): Recommendation[] {
  const recs: Recommendation[] = []

  if (history.length < 3) {
    recs.push({
      type: 'info',
      title: 'Not enough data yet',
      description: 'Keep Mission Control running for a few more days to get accurate forecasts and recommendations.',
    })
    return recs
  }

  // Projected monthly spend
  const projectedMonthly = forecast.slice(0, 30).reduce((s, f) => s + f.predicted, 0)
  const currentMonthly = history.slice(-30).reduce((s, d) => s + d.total, 0)

  // Trend analysis
  const recentWeek = history.slice(-7)
  const previousWeek = history.slice(-14, -7)

  if (recentWeek.length >= 7 && previousWeek.length >= 7) {
    const recentAvg = recentWeek.reduce((s, d) => s + d.total, 0) / recentWeek.length
    const prevAvg = previousWeek.reduce((s, d) => s + d.total, 0) / previousWeek.length
    const change = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : 0

    if (change > 25) {
      recs.push({
        type: 'warning',
        title: 'Spending is accelerating',
        description: `Daily spend increased ${Math.round(change)}% compared to last week. Consider switching to Budget mode during off-hours.`,
        impact: `Save ~$${((recentAvg - prevAvg) * 30).toFixed(2)}/mo`,
      })
    } else if (change < -15) {
      recs.push({
        type: 'savings',
        title: 'Spending trend is improving',
        description: `Daily spend decreased ${Math.abs(Math.round(change))}% compared to last week. Keep it up!`,
        impact: `Saving ~$${((prevAvg - recentAvg) * 30).toFixed(2)}/mo`,
      })
    }
  }

  // Budget warning
  if (monthlyBudget && projectedMonthly > monthlyBudget) {
    const overBy = projectedMonthly - monthlyBudget
    recs.push({
      type: 'warning',
      title: 'On track to exceed budget',
      description: `At this rate, you'll spend ~$${projectedMonthly.toFixed(2)} this month — $${overBy.toFixed(2)} over your $${monthlyBudget.toFixed(2)} budget.`,
      impact: `$${overBy.toFixed(2)} over budget`,
    })
  }

  // Provider concentration risk
  if (history.length >= 7) {
    const recent = history.slice(-7)
    const avgTotal = recent.reduce((s, d) => s + d.total, 0) / recent.length
    const avgOr = recent.reduce((s, d) => s + d.openrouter, 0) / recent.length

    if (avgTotal > 0 && avgOr / avgTotal > 0.8) {
      recs.push({
        type: 'info',
        title: 'High OpenRouter concentration',
        description: `${Math.round((avgOr / avgTotal) * 100)}% of your spend goes through OpenRouter. Consider using Anthropic direct for high-volume tasks to potentially lower costs.`,
      })
    }
  }

  // Weekend savings opportunity
  const seasonal = weeklyPattern(history)
  const weekdayAvg = (seasonal[1] + seasonal[2] + seasonal[3] + seasonal[4] + seasonal[5]) / 5
  const weekendAvg = (seasonal[0] + seasonal[6]) / 2

  if (weekdayAvg > 0 && weekendAvg / weekdayAvg > 0.7) {
    recs.push({
      type: 'savings',
      title: 'Schedule Budget mode on weekends',
      description: 'Your weekend usage is nearly as high as weekdays. Switching to Budget mode on weekends could save 40-60% of weekend costs.',
      impact: `Save ~$${(history.slice(-7).reduce((s, d) => s + d.total, 0) / 7 * 2 * 0.5).toFixed(2)}/week`,
    })
  }

  // Mode switching opportunity
  const avgDaily = history.slice(-7).reduce((s, d) => s + d.total, 0) / Math.min(history.length, 7)
  if (avgDaily > 5) {
    recs.push({
      type: 'savings',
      title: 'Try Scheduled Mode Switching',
      description: `At $${avgDaily.toFixed(2)}/day, enabling Budget mode overnight (10pm-8am) could reduce daily costs by 20-30%.`,
      impact: `Save ~$${(avgDaily * 0.25 * 30).toFixed(2)}/mo`,
    })
  }

  return recs.slice(0, 5) // Max 5 recommendations
}

export async function GET(request: NextRequest) {
  try {
    const history = await readHistory()
    const forecastDays = parseInt(request.nextUrl.searchParams.get('days') || '30')
    const budgetParam = request.nextUrl.searchParams.get('budget')
    const monthlyBudget = budgetParam ? parseFloat(budgetParam) : undefined

    const clampedDays = Math.max(7, Math.min(forecastDays, 90))
    const forecast = generateForecast(history, clampedDays)
    const recommendations = generateRecommendations(history, forecast, monthlyBudget)

    // Summary stats
    const projectedMonthly = forecast.slice(0, 30).reduce((s, f) => s + f.predicted, 0)
    const currentAvgDaily = history.length > 0
      ? history.slice(-7).reduce((s, d) => s + d.total, 0) / Math.min(history.length, 7)
      : 0

    // Model confidence
    const points = history.map((s, i) => ({ x: i, y: s.total }))
    const { r2 } = history.length >= 2 ? linearRegression(points) : { r2: 0 }
    const confidence = history.length < 7 ? 'low' : history.length < 14 ? 'medium' : r2 > 0.5 ? 'high' : 'medium'

    return NextResponse.json({
      forecast,
      recommendations,
      summary: {
        projectedMonthly: Math.round(projectedMonthly * 100) / 100,
        currentAvgDaily: Math.round(currentAvgDaily * 100) / 100,
        forecastDays: clampedDays,
        dataPoints: history.length,
        modelConfidence: confidence,
        r2: Math.round(r2 * 100) / 100,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to generate cost forecast' },
      { status: 500 }
    )
  }
}

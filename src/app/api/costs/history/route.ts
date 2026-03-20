import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { DATA_DIR, getEffectiveConfig } from '@/lib/connection-config'

const HISTORY_FILE = path.join(DATA_DIR, 'cost-history.json')

interface CostSnapshot {
  date: string // YYYY-MM-DD
  openrouter: number
  anthropic: number
  railway: number
  subscriptions: number
  total: number
}

async function readHistory(): Promise<CostSnapshot[]> {
  try {
    const text = await readFile(HISTORY_FILE, 'utf-8')
    return JSON.parse(text)
  } catch {
    return []
  }
}

async function writeHistory(history: CostSnapshot[]) {
  await mkdir(path.dirname(HISTORY_FILE), { recursive: true })
  await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2))
}

async function getOpenRouterSpend() {
  const config = await getEffectiveConfig()
  const key = config.openrouterApiKey
  if (!key) return { daily: 0, monthly: 0 }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    if (!res.ok) return { daily: 0, monthly: 0 }
    const data = await res.json()
    return {
      daily: data.data?.usage_daily ?? 0,
      monthly: data.data?.usage_monthly ?? 0,
    }
  } catch {
    return { daily: 0, monthly: 0 }
  }
}

async function getAnthropicTotal(): Promise<number> {
  try {
    const text = await readFile(path.join(DATA_DIR, 'anthropic-costs.json'), 'utf-8')
    const data = JSON.parse(text)
    return data?.days?.reduce((s: number, d: { total: number }) => s + d.total, 0) ?? 0
  } catch {
    return 0
  }
}

async function getRailwayEstimate(): Promise<number> {
  try {
    // Import dynamically to avoid circular deps
    const { isRailwayConfigured, getRailwayUsage } = await import('@/lib/railway')
    if (!isRailwayConfigured()) return 0
    const usage = await getRailwayUsage()
    if ('error' in usage) return 0
    return usage.estimated?.total ?? 0
  } catch {
    return 0
  }
}

async function getSubscriptionTotal(): Promise<number> {
  try {
    const text = await readFile(path.join(DATA_DIR, 'subscriptions.json'), 'utf-8')
    const subs = JSON.parse(text)
    return Array.isArray(subs) ? subs.reduce((s: number, sub: { cost: number }) => s + sub.cost, 0) : 0
  } catch {
    return 20 // Default subscription (Anthropic Pro $20)
  }
}

export async function GET(request: NextRequest) {
  try {
    const range = request.nextUrl.searchParams.get('range') || '30d'
    const history = await readHistory()

    // Record today's snapshot if we don't have one yet
    const today = new Date().toISOString().split('T')[0]
    const hasToday = history.some(s => s.date === today)

    if (!hasToday) {
      const [orSpend, anthropic, railway, subscriptions] = await Promise.all([
        getOpenRouterSpend(),
        getAnthropicTotal(),
        getRailwayEstimate(),
        getSubscriptionTotal(),
      ])

      const snapshot: CostSnapshot = {
        date: today,
        openrouter: orSpend.daily,
        anthropic,
        railway,
        subscriptions,
        total: orSpend.daily + anthropic + railway + subscriptions,
      }

      history.push(snapshot)

      // Keep max 90 days of history
      const trimmed = history.slice(-90)
      await writeHistory(trimmed)
    }

    // Filter by range
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split('T')[0]

    const filtered = history.filter(s => s.date >= cutoffStr)

    // Compute aggregates
    const totalSpend = filtered.reduce((s, d) => s + d.total, 0)
    const avgDaily = filtered.length > 0 ? totalSpend / filtered.length : 0
    const maxDay = filtered.reduce((max, d) => d.total > max.total ? d : max, filtered[0] || { date: '', total: 0 })
    const minDay = filtered.reduce((min, d) => d.total < min.total ? d : min, filtered[0] || { date: '', total: 0 })

    // Trend: compare first half to second half
    const mid = Math.floor(filtered.length / 2)
    const firstHalf = filtered.slice(0, mid)
    const secondHalf = filtered.slice(mid)
    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((s, d) => s + d.total, 0) / firstHalf.length : 0
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((s, d) => s + d.total, 0) / secondHalf.length : 0
    const trendPct = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0

    return NextResponse.json({
      history: filtered,
      aggregates: {
        totalSpend,
        avgDaily,
        maxDay: { date: maxDay?.date, total: maxDay?.total },
        minDay: { date: minDay?.date, total: minDay?.total },
        trendPct: Math.round(trendPct),
        projectedMonthly: avgDaily * 30,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch cost history' }, { status: 500 })
  }
}

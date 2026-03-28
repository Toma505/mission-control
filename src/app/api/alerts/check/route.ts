import { NextResponse } from 'next/server'
import { fireWebhooks } from '@/app/api/webhooks/route'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { DATA_DIR, getEffectiveConfig } from '@/lib/connection-config'
import { pushNotification } from '@/lib/notifications-store'
import type { AlertRule } from '../route'

const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json')

interface AlertsConfig {
  rules: AlertRule[]
  history: { ruleId: string; ruleName: string; message: string; timestamp: string }[]
}

async function readAlerts(): Promise<AlertsConfig> {
  try {
    const text = await readFile(ALERTS_FILE, 'utf-8')
    return JSON.parse(text)
  } catch {
    return { rules: [], history: [] }
  }
}

async function writeAlerts(config: AlertsConfig) {
  await mkdir(path.dirname(ALERTS_FILE), { recursive: true })
  config.history = config.history.slice(-100)
  await writeFile(ALERTS_FILE, JSON.stringify(config, null, 2))
}

async function gatherMetrics(): Promise<Record<string, number>> {
  const metrics: Record<string, number> = {}

  // OpenRouter metrics
  try {
    const config = await getEffectiveConfig()
    if (config.openrouterApiKey) {
      const [creditsRes, keyRes] = await Promise.all([
        fetch('https://openrouter.ai/api/v1/credits', {
          headers: { Authorization: `Bearer ${config.openrouterApiKey}` },
          cache: 'no-store',
        }),
        fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { Authorization: `Bearer ${config.openrouterApiKey}` },
          cache: 'no-store',
        }),
      ])

      if (creditsRes.ok && keyRes.ok) {
        const credits = await creditsRes.json()
        const keyInfo = await keyRes.json()
        const totalCredits = credits.data?.total_credits ?? 0
        const totalUsage = credits.data?.total_usage ?? 0

        metrics['openrouter.usageDaily'] = keyInfo.data?.usage_daily ?? 0
        metrics['openrouter.usageWeekly'] = keyInfo.data?.usage_weekly ?? 0
        metrics['openrouter.usageMonthly'] = keyInfo.data?.usage_monthly ?? 0
        metrics['openrouter.remaining'] = totalCredits - totalUsage
        metrics['openrouter.remainingPct'] = totalCredits > 0
          ? ((totalCredits - totalUsage) / totalCredits) * 100
          : 100
      }
    }
  } catch {}

  // Budget metrics
  try {
    const budgetText = await readFile(path.join(DATA_DIR, 'budget.json'), 'utf-8')
    const budget = JSON.parse(budgetText)
    const dailyLimit = budget.dailyLimit || 5
    const monthlyLimit = budget.monthlyLimit || 50
    const dailySpend = metrics['openrouter.usageDaily'] || 0
    const monthlySpend = metrics['openrouter.usageMonthly'] || 0

    metrics['budget.dailyPct'] = dailyLimit > 0 ? (dailySpend / dailyLimit) * 100 : 0
    metrics['budget.monthlyPct'] = monthlyLimit > 0 ? (monthlySpend / monthlyLimit) * 100 : 0
    metrics['budget.maxPct'] = Math.max(metrics['budget.dailyPct'], metrics['budget.monthlyPct'])
    metrics['budget.dailyLimit'] = dailyLimit
    metrics['budget.monthlyLimit'] = monthlyLimit
  } catch {
    metrics['budget.dailyPct'] = 0
    metrics['budget.monthlyPct'] = 0
    metrics['budget.maxPct'] = 0
  }

  return metrics
}

function evaluateCondition(
  condition: AlertRule['condition'],
  metrics: Record<string, number>
): boolean {
  const value = metrics[condition.metric]
  if (value === undefined) return false

  switch (condition.operator) {
    case 'gt': return value > condition.value
    case 'lt': return value < condition.value
    case 'eq': return value === condition.value
    case 'gte': return value >= condition.value
    case 'lte': return value <= condition.value
    default: return false
  }
}

function formatAlertMessage(rule: AlertRule, metrics: Record<string, number>): string {
  const value = metrics[rule.condition.metric]
  const metricLabel = rule.condition.metric.replace('.', ' ').replace(/([A-Z])/g, ' $1').toLowerCase()

  switch (rule.type) {
    case 'spend_daily':
      return `Daily spend is $${(value ?? 0).toFixed(2)} (threshold: $${rule.condition.value})`
    case 'spend_monthly':
      return `Monthly spend is $${(value ?? 0).toFixed(2)} (threshold: $${rule.condition.value})`
    case 'credits_low':
      return `Credits at ${(value ?? 0).toFixed(0)}% remaining (threshold: ${rule.condition.value}%)`
    case 'budget_pct':
      return `Budget usage at ${(value ?? 0).toFixed(0)}% (threshold: ${rule.condition.value}%)`
    default:
      return `${metricLabel}: ${(value ?? 0).toFixed(2)} ${rule.condition.operator} ${rule.condition.value}`
  }
}

/**
 * GET /api/alerts/check — evaluate all enabled rules and return triggered alerts.
 * Also records triggered alerts in history.
 */
export async function GET() {
  try {
    const [config, metrics] = await Promise.all([readAlerts(), gatherMetrics()])

    const triggered: { ruleId: string; ruleName: string; message: string; action: string }[] = []
    const now = new Date()
    let dirty = false

    for (const rule of config.rules) {
      if (!rule.enabled) continue

      // Check cooldown
      if (rule.lastTriggered) {
        const lastTriggered = new Date(rule.lastTriggered)
        const elapsed = (now.getTime() - lastTriggered.getTime()) / 60_000
        if (elapsed < rule.cooldownMinutes) continue
      }

      if (evaluateCondition(rule.condition, metrics)) {
        const message = formatAlertMessage(rule, metrics)
        triggered.push({
          ruleId: rule.id,
          ruleName: rule.name,
          message,
          action: rule.action,
        })

        // Record in history and update lastTriggered
        rule.lastTriggered = now.toISOString()
        config.history.push({
          ruleId: rule.id,
          ruleName: rule.name,
          message,
          timestamp: now.toISOString(),
        })
        dirty = true
      }
    }

    if (dirty) {
      await writeAlerts(config)

      // Fire webhooks and push in-app notifications (non-blocking)
      for (const alert of triggered) {
        const event = alert.ruleId.includes('budget') ? 'budget.exceeded' : 'alert.triggered'
        fireWebhooks(event, `${alert.ruleName}: ${alert.message}`).catch(() => {})
        pushNotification({
          type: alert.ruleId.includes('budget') ? 'budget_alert' : 'agent_error',
          title: alert.ruleName,
          message: alert.message,
          href: '/alerts',
          source: 'alerts',
        }).catch(() => {})
      }
    }

    return NextResponse.json({ triggered, metrics })
  } catch (error) {
    return NextResponse.json({ error: 'Alert check failed' }, { status: 500 })
  }
}

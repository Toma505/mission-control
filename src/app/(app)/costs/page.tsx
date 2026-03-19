import { DollarSign, Cpu, Database, Wifi, HardDrive, Zap, Server, CreditCard, Globe, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { getAppBaseUrl } from '@/lib/app-url'
import { CsvUpload } from '@/components/costs/csv-upload'
import { ModeSwitcher } from '@/components/costs/mode-switcher'
import { BudgetControls } from '@/components/costs/budget-controls'
import { formatUsd } from '@/lib/format'

interface RailwayData {
  current: { cpu: number; memory: number; network: number; volume: number; total: number }
  estimated: { cpu: number; memory: number; network: number; volume: number; total: number }
  plan: string
  credits: number
}

interface CostDay {
  date: string
  breakdown: { type: string; cost: number }[]
  total: number
}

interface CostData {
  period: string
  model: string
  days: CostDay[]
}

interface OpenRouterData {
  totalCredits: number
  totalUsage: number
  remaining: number
  usageDaily: number
  usageWeekly: number
  usageMonthly: number
  isFreeTier: boolean
  activity: { model: string; cost: number; tokens: number }[]
}

interface Subscription {
  id: string
  name: string
  cost: number
  provider: string
  cycle: string
}

async function getCosts() {
  const baseUrl = getAppBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/api/costs`, { cache: 'no-store' })
    if (!res.ok) return { railway: null, anthropicCosts: null, openrouter: null, subscriptions: [] }
    return await res.json()
  } catch {
    return { railway: null, anthropicCosts: null, openrouter: null, subscriptions: [] }
  }
}

export default async function CostsPage() {
  const data = await getCosts()
  const railway: RailwayData | null = data.railway?.error ? null : data.railway
  const anthropicCosts: CostData | null = data.anthropicCosts
  const subscriptions: Subscription[] = data.subscriptions || []
  const openrouter: OpenRouterData | null = data.openrouter
  const providerCosts: Record<string, CostData> = data.providerCosts || {}

  const anthropicUsageTotal = anthropicCosts?.days?.reduce((s, d) => s + d.total, 0) ?? 0
  const openrouterUsage = openrouter?.usageMonthly ?? 0
  const providerCostTotal = Object.values(providerCosts).reduce(
    (sum, pc) => sum + (pc?.days?.reduce((s, d) => s + d.total, 0) ?? 0), 0
  )
  const railwayEstimated = railway?.estimated?.total ?? 0
  const subscriptionTotal = subscriptions.reduce((s, sub) => s + sub.cost, 0)
  const totalCombined = anthropicUsageTotal + openrouterUsage + providerCostTotal + railwayEstimated + subscriptionTotal

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Costs</h1>
        <p className="text-sm text-text-secondary">
          Infrastructure, API spend, and subscriptions
          {railway && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-status-active">
              <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-pulse" />
              Railway live
            </span>
          )}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-status-progress/10">
              <DollarSign className="w-5 h-5 text-status-progress" />
            </div>
            <span className="text-sm text-text-secondary">Total Monthly</span>
          </div>
          <p className="text-3xl font-bold text-text-primary">{formatUsd(totalCombined)}</p>
          <p className="text-xs text-text-muted mt-1">All costs combined</p>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-accent-highlight/10">
              <CreditCard className="w-5 h-5 text-accent-highlight" />
            </div>
            <span className="text-sm text-text-secondary">Subscriptions</span>
          </div>
          <p className="text-3xl font-bold text-text-primary">{formatUsd(subscriptionTotal)}</p>
          <p className="text-xs text-text-muted mt-1">{subscriptions.length} active</p>
        </div>

        <Link href="/api-usage" className="glass rounded-2xl p-5 hover:bg-white/[0.04] transition-colors group">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-accent-highlight/10">
              <Zap className="w-5 h-5 text-accent-highlight" />
            </div>
            <span className="text-sm text-text-secondary">API Usage</span>
            <ArrowRight className="w-3.5 h-3.5 text-text-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-3xl font-bold text-text-primary">
            {anthropicCosts || openrouter || Object.keys(providerCosts).length > 0 ? formatUsd(anthropicUsageTotal + openrouterUsage + providerCostTotal) : '—'}
          </p>
          <p className="text-xs text-text-muted mt-1">All API providers</p>
        </Link>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-accent-secondary/10">
              <Server className="w-5 h-5 text-accent-secondary" />
            </div>
            <span className="text-sm text-text-secondary">Railway (est.)</span>
          </div>
          <p className="text-3xl font-bold text-text-primary">
            {railway ? formatUsd(railway.estimated.total) : '—'}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {railway ? `${railway.plan} plan` : 'Not connected'}
          </p>
        </div>
      </div>

      {/* AI Mode Switcher + Budget Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ModeSwitcher />
        <BudgetControls />
      </div>

      {/* Quick API snapshot — compact summary with link to details */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-text-secondary">API Providers</h2>
          <Link href="/api-usage" className="text-xs text-accent-highlight hover:text-accent-highlight/80 flex items-center gap-1">
            View details <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Anthropic snapshot */}
          <div className="p-4 rounded-xl bg-background-elevated">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-text-primary">Anthropic</span>
            </div>
            {anthropicCosts ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">{anthropicCosts.period}</span>
                <span className="text-lg font-bold text-amber-400">{formatUsd(anthropicUsageTotal)}</span>
              </div>
            ) : (
              <p className="text-xs text-text-muted">No data — upload CSV below</p>
            )}
          </div>

          {/* OpenRouter snapshot */}
          <div className="p-4 rounded-xl bg-background-elevated">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-text-primary">OpenRouter</span>
              {openrouter && (
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium bg-status-active/10 text-status-active">
                  Connected
                </span>
              )}
            </div>
            {openrouter ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Credits remaining</span>
                  <span className="text-lg font-bold text-emerald-400">{formatUsd(openrouter.remaining)}</span>
                </div>
                <div className="w-full bg-white/[0.06] rounded-full h-1.5">
                  <div
                    className="bg-violet-400 h-1.5 rounded-full transition-all"
                    style={{ width: `${openrouter.totalCredits > 0 ? Math.min((openrouter.totalUsage / openrouter.totalCredits) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted">Add your OpenRouter API key in Connection Settings to connect</p>
            )}
          </div>

          {/* Uploaded provider cost snapshots */}
          {Object.entries(providerCosts).map(([provider, costData]) => {
            const total = costData?.days?.reduce((s, d) => s + d.total, 0) ?? 0
            const label = provider.charAt(0).toUpperCase() + provider.slice(1)
            return (
              <div key={provider} className="p-4 rounded-xl bg-background-elevated">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-text-primary">{label}</span>
                  <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-400/10 text-cyan-400">
                    CSV
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">{costData.period}</span>
                  <span className="text-lg font-bold text-cyan-400">{formatUsd(total)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Railway Infrastructure */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Infrastructure</h2>

        {!railway ? (
          <div className="glass rounded-2xl p-8 text-center">
            <Server className="w-8 h-8 text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-secondary">
              Railway live usage is optional and is not configured for this workspace yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Plan info */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-text-primary capitalize">{railway.plan} Plan</p>
                  <p className="text-xs text-text-muted">{formatUsd(railway.credits)}/mo credits</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-status-active/10 text-status-active border border-status-active/20">
                  Active
                </span>
              </div>
            </div>

            {/* Current usage */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-text-primary">Current Usage</span>
                <span className="text-lg font-bold text-text-primary">{formatUsd(railway.current.total)}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-text-secondary"><Cpu className="w-3.5 h-3.5" /> CPU</span>
                  <span className="text-sm text-text-primary">{formatUsd(railway.current.cpu)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-text-secondary"><Database className="w-3.5 h-3.5" /> Memory</span>
                  <span className="text-sm text-text-primary">{formatUsd(railway.current.memory)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-text-secondary"><Wifi className="w-3.5 h-3.5" /> Network</span>
                  <span className="text-sm text-text-primary">{formatUsd(railway.current.network)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-text-secondary"><HardDrive className="w-3.5 h-3.5" /> Volume</span>
                  <span className="text-sm text-text-primary">{formatUsd(railway.current.volume)}</span>
                </div>
              </div>
            </div>

            {/* Estimated */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-text-primary">Estimated Monthly</span>
                <span className="text-lg font-bold text-status-progress">{formatUsd(railway.estimated.total)}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-text-secondary"><Cpu className="w-3.5 h-3.5" /> CPU</span>
                  <span className="text-sm text-text-primary">{formatUsd(railway.estimated.cpu)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-text-secondary"><Database className="w-3.5 h-3.5" /> Memory</span>
                  <span className="text-sm text-text-primary">{formatUsd(railway.estimated.memory)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-text-secondary"><Wifi className="w-3.5 h-3.5" /> Network</span>
                  <span className="text-sm text-text-primary">{formatUsd(railway.estimated.network)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-text-secondary"><HardDrive className="w-3.5 h-3.5" /> Volume</span>
                  <span className="text-sm text-text-primary">{formatUsd(railway.estimated.volume)}</span>
                </div>
              </div>
              {railway.estimated.total > railway.credits && (
                <div className="mt-3 p-2 rounded-lg bg-status-progress/10 border border-status-progress/20">
                  <p className="text-xs text-status-progress">
                    Estimated {formatUsd(railway.estimated.total - railway.credits)} over included credits
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Subscriptions */}
      <div className="glass rounded-2xl p-5">
        <h2 className="text-sm font-medium text-text-secondary mb-3">Monthly Subscriptions</h2>
        <div className="flex flex-wrap gap-4">
          {subscriptions.map((sub) => (
            <div key={sub.id} className="flex items-center gap-3 p-3 rounded-xl bg-background-elevated">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                <span className="text-xs font-bold text-text-primary">
                  {sub.provider === 'anthropic' ? 'A' : sub.name[0]}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{sub.name}</p>
                <p className="text-xs text-text-muted">{formatUsd(sub.cost)}/mo</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CSV Upload */}
      <CsvUpload />
    </div>
  )
}

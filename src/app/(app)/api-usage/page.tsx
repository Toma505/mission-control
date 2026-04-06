import { BarChart3, Zap, Globe } from 'lucide-react'
import { getAppBaseUrl } from '@/lib/app-url'
import { formatUsd, formatTokens } from '@/lib/format'

interface TokenRow {
  date: string
  model: string
  input: number
  cacheWrite: number
  cacheRead: number
  output: number
}

interface TokenData {
  rows: TokenRow[]
  updatedAt?: string
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
  updatedAt?: string
}

interface OpenRouterActivity {
  model: string
  cost: number
  tokens: number
}

interface OpenRouterData {
  totalCredits: number
  totalUsage: number
  remaining: number
  usageDaily: number
  usageWeekly: number
  usageMonthly: number
  isFreeTier: boolean
  activity: OpenRouterActivity[]
}

async function getUsageData() {
  const baseUrl = getAppBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/api/costs`, { cache: 'no-store' })
    if (!res.ok) return { anthropicCosts: null, anthropicTokens: null, openrouter: null }
    return await res.json()
  } catch {
    return { anthropicCosts: null, anthropicTokens: null, openrouter: null }
  }
}

function aggregateTokens(data: TokenData | null) {
  if (!data?.rows?.length) return null
  const totals = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0, total: 0 }
  const byModel: Record<string, typeof totals> = {}
  const byDate: Record<string, typeof totals> = {}

  for (const row of data.rows) {
    const rowTotal = row.input + row.cacheWrite + row.cacheRead + row.output
    totals.input += row.input
    totals.cacheWrite += row.cacheWrite
    totals.cacheRead += row.cacheRead
    totals.output += row.output
    totals.total += rowTotal

    if (!byModel[row.model]) byModel[row.model] = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0, total: 0 }
    byModel[row.model].input += row.input
    byModel[row.model].cacheWrite += row.cacheWrite
    byModel[row.model].cacheRead += row.cacheRead
    byModel[row.model].output += row.output
    byModel[row.model].total += rowTotal

    if (!byDate[row.date]) byDate[row.date] = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0, total: 0 }
    byDate[row.date].input += row.input
    byDate[row.date].cacheWrite += row.cacheWrite
    byDate[row.date].cacheRead += row.cacheRead
    byDate[row.date].output += row.output
    byDate[row.date].total += rowTotal
  }

  return { totals, byModel, byDate }
}

export default async function ApiUsagePage() {
  const data = await getUsageData()
  const anthropicCosts: CostData | null = data.anthropicCosts
  const openrouter: OpenRouterData | null = data.openrouter
  const anthropicAgg = aggregateTokens(data.anthropicTokens)

  const hasAnthropicCosts = (anthropicCosts?.days?.length ?? 0) > 0
  const hasAnthropicTokens = !!anthropicAgg
  const hasOpenRouterData =
    !!openrouter &&
    (
      openrouter.totalCredits > 0 ||
      openrouter.totalUsage > 0 ||
      openrouter.remaining > 0 ||
      (openrouter.activity?.length ?? 0) > 0
    )

  const hasData = hasAnthropicCosts || hasAnthropicTokens || hasOpenRouterData

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">API Usage</h1>
          <p className="text-text-secondary">Monitor token consumption and API spend across providers</p>
        </div>
        <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="p-4 rounded-2xl bg-background-elevated mb-4">
            <BarChart3 className="w-8 h-8 text-text-muted" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">No usage data</h2>
          <p className="text-sm text-text-secondary max-w-md">
            Upload cost or token CSVs on the Costs page, or connect OpenRouter to see usage breakdowns here.
          </p>
        </div>
      </div>
    )
  }

  const anthropicSpend = anthropicCosts?.days?.reduce((s, d) => s + d.total, 0) ?? 0
  const openrouterSpend = openrouter?.totalUsage ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">API Usage</h1>
        <p className="text-text-secondary">Token consumption and API spend across providers</p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-5">
          <p className="text-xs text-text-muted mb-1">Total Tokens</p>
          <p className="text-2xl font-bold text-text-primary">
            {formatTokens(anthropicAgg?.totals.total ?? 0)}
          </p>
          <p className="text-xs text-text-muted mt-1">Anthropic</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs text-text-muted mb-1">Total API Spend</p>
          <p className="text-2xl font-bold text-text-primary">{formatUsd(anthropicSpend + openrouterSpend)}</p>
          <p className="text-xs text-text-muted mt-1">All providers</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs text-text-muted mb-1">Anthropic Spend</p>
          <p className="text-2xl font-bold text-amber-400">{formatUsd(anthropicSpend)}</p>
          <p className="text-xs text-text-muted mt-1">{anthropicCosts?.period || 'No data'}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs text-text-muted mb-1">OpenRouter Spend</p>
          <p className="text-2xl font-bold text-violet-400">{formatUsd(openrouterSpend)}</p>
          <p className="text-xs text-text-muted mt-1">{openrouter ? `${formatUsd(openrouter.remaining)} remaining` : 'Not connected'}</p>
        </div>
      </div>

      {/* Provider sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Anthropic */}
        {(anthropicAgg || anthropicCosts) && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" /> Anthropic
            </h2>

            {/* Spend by day */}
            {anthropicCosts && (
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-text-secondary">Daily Spend</h3>
                  <span className="text-xs text-text-muted">{anthropicCosts.model}</span>
                </div>
                <div className="space-y-2">
                  {anthropicCosts.days.map((day: CostDay) => (
                    <div key={day.date}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-text-primary">{day.date}</span>
                        <span className="text-sm font-bold text-text-primary">{formatUsd(day.total)}</span>
                      </div>
                      <div className="space-y-0.5 pl-3">
                        {day.breakdown.map((item) => (
                          <div key={item.type} className="flex items-center justify-between">
                            <span className="text-xs text-text-muted">{item.type}</span>
                            <span className="text-xs text-text-secondary">{formatUsd(item.cost)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tokens by model */}
            {anthropicAgg && Object.keys(anthropicAgg.byModel).length > 0 && (
              <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-medium text-text-secondary mb-3">Tokens by Model</h3>
                <div className="space-y-3">
                  {Object.entries(anthropicAgg.byModel).map(([model, t]) => (
                    <div key={model}>
                      <p className="text-xs text-text-muted font-mono mb-1">{model}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded-lg bg-background-elevated">
                          <p className="text-[10px] text-text-muted">Input</p>
                          <p className="text-sm font-medium text-text-primary">{formatTokens(t.input)}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-background-elevated">
                          <p className="text-[10px] text-text-muted">Cache Read</p>
                          <p className="text-sm font-medium text-text-primary">{formatTokens(t.cacheRead)}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-background-elevated">
                          <p className="text-[10px] text-text-muted">Cache Write</p>
                          <p className="text-sm font-medium text-text-primary">{formatTokens(t.cacheWrite)}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-background-elevated">
                          <p className="text-[10px] text-text-muted">Output</p>
                          <p className="text-sm font-medium text-text-primary">{formatTokens(t.output)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tokens by day */}
            {anthropicAgg && Object.keys(anthropicAgg.byDate).length > 0 && (
              <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-medium text-text-secondary mb-3">Daily Token Volume</h3>
                <div className="space-y-2">
                  {Object.entries(anthropicAgg.byDate).map(([date, t]) => (
                    <div key={date} className="flex items-center justify-between">
                      <span className="text-sm text-text-secondary">{date}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-text-muted">{formatTokens(t.input)} in / {formatTokens(t.output)} out</span>
                        <span className="text-sm font-medium text-text-primary">{formatTokens(t.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* OpenRouter */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Globe className="w-5 h-5 text-violet-400" /> OpenRouter
          </h2>

          {!openrouter ? (
            <div className="glass rounded-2xl p-8 text-center">
              <Globe className="w-8 h-8 text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-secondary">
                Add your OpenRouter API key in Connection Settings to see live OpenRouter usage.
              </p>
            </div>
          ) : (
            <>
              {/* Credits overview */}
              <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-medium text-text-secondary mb-3">Credits</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-background-elevated">
                    <p className="text-xs text-text-muted">Total Credits</p>
                    <p className="text-xl font-bold text-text-primary">{formatUsd(openrouter.totalCredits)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-background-elevated">
                    <p className="text-xs text-text-muted">Remaining</p>
                    <p className="text-xl font-bold text-emerald-400">{formatUsd(openrouter.remaining)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-white/[0.06] rounded-full h-2">
                    <div
                      className="bg-violet-400 h-2 rounded-full transition-all"
                      style={{ width: `${openrouter.totalCredits > 0 ? Math.min((openrouter.totalUsage / openrouter.totalCredits) * 100, 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    {(openrouter.totalCredits > 0 ? (openrouter.totalUsage / openrouter.totalCredits) * 100 : 0).toFixed(1)}% used
                  </p>
                </div>
              </div>

              {/* Usage breakdown */}
              <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-medium text-text-secondary mb-3">Spend Breakdown</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Today</span>
                    <span className="text-sm font-medium text-text-primary">{formatUsd(openrouter.usageDaily)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">This Week</span>
                    <span className="text-sm font-medium text-text-primary">{formatUsd(openrouter.usageWeekly)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">This Month</span>
                    <span className="text-sm font-medium text-text-primary">{formatUsd(openrouter.usageMonthly)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                    <span className="text-sm text-text-secondary">All Time</span>
                    <span className="text-sm font-bold text-text-primary">{formatUsd(openrouter.totalUsage)}</span>
                  </div>
                </div>
              </div>

              {/* Per-model activity */}
              {(openrouter.activity?.length ?? 0) > 0 && (
                <div className="glass rounded-2xl p-5">
                  <h3 className="text-sm font-medium text-text-secondary mb-3">Usage by Model</h3>
                  <div className="space-y-2">
                    {openrouter.activity
                      .sort((a, b) => b.cost - a.cost)
                      .map((entry, i) => (
                        <div key={`or-activity-${i}`} className="flex items-center justify-between p-2 rounded-lg bg-background-elevated">
                          <span className="text-xs text-text-primary font-mono truncate max-w-[60%]">{entry.model}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-text-muted">{formatTokens(entry.tokens)} tokens</span>
                            <span className="text-xs font-medium text-violet-400">{formatUsd(entry.cost)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

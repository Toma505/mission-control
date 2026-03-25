'use client'

import { useEffect, useState } from 'react'
import { Heart, Activity, Clock, DollarSign, AlertTriangle, Loader2 } from 'lucide-react'

interface AgentHealth {
  name: string
  score: number
  uptime: number
  errorRate: number
  responseTime: string
  costEfficiency: number
}

interface HealthData {
  agents: AgentHealth[]
  overallScore: number
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-red-400'
}

function scoreBg(score: number) {
  if (score >= 80) return 'bg-emerald-400'
  if (score >= 60) return 'bg-amber-400'
  return 'bg-red-400'
}

function scoreLabel(score: number) {
  if (score >= 90) return 'Excellent'
  if (score >= 80) return 'Healthy'
  if (score >= 60) return 'Fair'
  if (score >= 40) return 'Degraded'
  return 'Critical'
}

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#f87171'}
          strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-sm font-bold ${scoreColor(score)}`}>{score}</span>
      </div>
    </div>
  )
}

export function AgentHealthScore() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadHealth() {
      try {
        const [agentsRes, uptimeRes, costsRes] = await Promise.all([
          fetch('/api/agents'),
          fetch('/api/agents/uptime?range=7d'),
          fetch('/api/costs'),
        ])

        const agents = await agentsRes.json()
        const uptime = await uptimeRes.json()
        const costs = await costsRes.json()

        if (!agents.connected || !agents.agents?.length) {
          setData(null)
          setLoading(false)
          return
        }

        const uptimeMap = new Map<string, number>(
          (uptime.agents || []).map((a: { name: string; uptimePercentage: number }) => [a.name, a.uptimePercentage] as [string, number])
        )

        // Model cost efficiency from activity data
        const avgCostPer1k = costs.openrouter?.activity?.length > 0
          ? costs.openrouter.activity.reduce((s: number, m: { cost: number }) => s + m.cost, 0) /
            Math.max(1, costs.openrouter.activity.reduce((s: number, m: { tokens: number }) => s + m.tokens, 0)) * 1000
          : 0

        const healthAgents: AgentHealth[] = agents.agents.map((agent: { name: string; model: string; enabled: boolean }) => {
          const uptimePct: number = uptimeMap.get(agent.name) ?? (agent.enabled ? 50 : 0)
          const errorRate = 100 - uptimePct
          // Cost efficiency: lower cost = higher score. $0.01/1k = 95, $0.10/1k = 50, $1/1k = 5
          const costScore = Math.min(100, Math.max(0, Math.round(100 - avgCostPer1k * 500)))

          // Composite: 40% uptime, 30% error-free, 30% cost efficiency
          const score = Math.round(
            uptimePct * 0.4 +
            (100 - errorRate) * 0.3 +
            costScore * 0.3
          )

          return {
            name: agent.name,
            score: Math.min(100, Math.max(0, score)),
            uptime: Math.round(uptimePct),
            errorRate: Math.round(errorRate * 10) / 10,
            responseTime: agent.enabled ? 'Active' : 'Inactive',
            costEfficiency: costScore,
          }
        })

        const overallScore = healthAgents.length > 0
          ? Math.round(healthAgents.reduce((s, a) => s + a.score, 0) / healthAgents.length)
          : 0

        setData({ agents: healthAgents, overallScore })
      } catch {}
      setLoading(false)
    }

    loadHealth()
  }, [])

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-5 h-5 text-accent-highlight" />
          <h3 className="text-base font-semibold text-text-primary">Agent Health</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
        </div>
      </div>
    )
  }

  if (!data || data.agents.length === 0) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-5 h-5 text-accent-highlight" />
          <h3 className="text-base font-semibold text-text-primary">Agent Health</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Activity className="w-8 h-8 text-text-muted" />
          <p className="text-sm text-text-muted">No agent data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl p-6">
      {/* Header with overall score */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-accent-highlight" />
          <h3 className="text-base font-semibold text-text-primary">Agent Health</h3>
        </div>
        <div className="flex items-center gap-3">
          <ScoreRing score={data.overallScore} size={48} />
          <div>
            <p className={`text-sm font-semibold ${scoreColor(data.overallScore)}`}>
              {scoreLabel(data.overallScore)}
            </p>
            <p className="text-[10px] text-text-muted">Overall Score</p>
          </div>
        </div>
      </div>

      {/* Per-agent health */}
      <div className="space-y-3">
        {data.agents.map(agent => (
          <div key={agent.name} className="p-3 rounded-xl bg-background-elevated">
            <div className="flex items-center gap-3">
              <ScoreRing score={agent.score} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary">{agent.name}</p>
                  <span className={`text-[10px] font-medium ${scoreColor(agent.score)}`}>
                    {scoreLabel(agent.score)}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-[10px] text-text-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {agent.uptime}% uptime
                  </span>
                  <span className="text-[10px] text-text-muted flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {agent.errorRate}% errors
                  </span>
                  <span className="text-[10px] text-text-muted flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> {agent.costEfficiency} efficiency
                  </span>
                </div>
              </div>
            </div>
            {/* Score bar */}
            <div className="mt-2 w-full bg-white/[0.06] rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-700 ${scoreBg(agent.score)}`}
                style={{ width: `${agent.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-[10px] text-text-muted">
        <span>Score = 40% uptime + 30% error-free + 30% cost efficiency</span>
      </div>
    </div>
  )
}

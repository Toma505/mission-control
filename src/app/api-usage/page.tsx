import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Activity, TrendingUp, AlertCircle, Zap } from 'lucide-react'

export default function ApiUsagePage() {
  const apiStats = [
    {
      id: '1',
      name: 'Claude Sonnet 4',
      type: 'LLM Model',
      status: 'active' as const,
      requestCount: 1247,
      successRate: 98.5,
      avgLatency: '1.8s',
      quota: 85,
    },
    {
      id: '2',
      name: '/api/activities',
      type: 'REST Endpoint',
      status: 'active' as const,
      requestCount: 3842,
      successRate: 99.2,
      avgLatency: '142ms',
      quota: 45,
    },
    {
      id: '3',
      name: 'GPT-4 Turbo',
      type: 'LLM Model',
      status: 'progress' as const,
      requestCount: 892,
      successRate: 96.8,
      avgLatency: '2.3s',
      quota: 62,
    },
    {
      id: '4',
      name: '/api/agents',
      type: 'REST Endpoint',
      status: 'active' as const,
      requestCount: 2156,
      successRate: 99.8,
      avgLatency: '98ms',
      quota: 28,
    },
    {
      id: '5',
      name: 'Gemini Pro',
      type: 'LLM Model',
      status: 'idle' as const,
      requestCount: 534,
      successRate: 94.2,
      avgLatency: '1.5s',
      quota: 38,
    },
    {
      id: '6',
      name: '/api/system-status',
      type: 'REST Endpoint',
      status: 'active' as const,
      requestCount: 8921,
      successRate: 100,
      avgLatency: '45ms',
      quota: 72,
    },
  ]

  const getSuccessRateVariant = (rate: number): 'active' | 'progress' | 'idle' => {
    if (rate >= 98) return 'active'
    if (rate >= 95) return 'progress'
    return 'idle'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">API Usage</h1>
        <p className="text-text-secondary">Monitor API endpoints and model consumption</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {apiStats.map((stat) => (
          <Card key={stat.id}>
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-accent-primary" />
                  <div>
                    <CardTitle className="text-base">{stat.name}</CardTitle>
                    <p className="text-xs text-text-muted mt-0.5">{stat.type}</p>
                  </div>
                </div>
                <Badge variant={stat.status}>
                  {stat.status.charAt(0).toUpperCase() + stat.status.slice(1)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-accent-primary" />
                    <span className="text-text-secondary">Requests</span>
                  </div>
                  <span className="font-semibold text-text-primary">{stat.requestCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <AlertCircle className={`w-4 h-4 ${stat.successRate >= 98 ? 'text-status-active' : 'text-status-progress'}`} />
                    <span className="text-text-secondary">Success Rate</span>
                  </div>
                  <Badge variant={getSuccessRateVariant(stat.successRate)} className="text-xs">
                    {stat.successRate}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-status-progress" />
                    <span className="text-text-secondary">Avg Latency</span>
                  </div>
                  <span className="font-semibold text-text-primary">{stat.avgLatency}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <ProgressBar value={stat.quota} variant="progress" showLabel />
                <p className="text-xs text-text-muted mt-1">Monthly quota usage</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

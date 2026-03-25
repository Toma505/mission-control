import { UsageAnalytics } from '@/components/costs/usage-analytics'

export default function AnalyticsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Usage Analytics</h1>
        <p className="text-sm text-text-muted mt-1">
          Token consumption, cost breakdowns by model, and spending anomaly detection
        </p>
      </div>
      <UsageAnalytics />
    </div>
  )
}

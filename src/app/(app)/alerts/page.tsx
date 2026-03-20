import { SmartAlerts } from '@/components/alerts/smart-alerts'

export default function AlertsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Smart Alerts</h1>
        <p className="text-sm text-text-secondary">
          Set up custom alerts to monitor spend, budget, and agent status — MC watches so you don't have to
        </p>
      </div>
      <SmartAlerts />
    </div>
  )
}

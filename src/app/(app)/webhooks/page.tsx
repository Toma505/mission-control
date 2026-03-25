import { WebhookManager } from '@/components/settings/webhook-manager'

export default function WebhooksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Webhook Integrations</h1>
        <p className="text-sm text-text-muted mt-1">Send alerts and events to Slack, Discord, or custom endpoints</p>
      </div>
      <WebhookManager />
    </div>
  )
}

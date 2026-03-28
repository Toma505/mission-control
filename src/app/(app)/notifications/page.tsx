import { NotificationHistory } from '@/components/notifications/notification-history'

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text-primary">Notifications</h1>
        <p className="mt-1 text-sm text-text-muted">
          Recent alerts, agent events, and scheduled activity across Mission Control.
        </p>
      </div>
      <NotificationHistory />
    </div>
  )
}


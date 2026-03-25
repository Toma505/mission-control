import { AuditLog } from '@/components/settings/audit-log'

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Activity Audit Log</h1>
        <p className="text-sm text-text-secondary">Track every change made in Mission Control</p>
      </div>
      <AuditLog />
    </div>
  )
}

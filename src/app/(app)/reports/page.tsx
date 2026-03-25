import { ScheduledReports } from '@/components/settings/scheduled-reports'

export default function ReportsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Scheduled Reports</h1>
        <p className="text-sm text-text-muted mt-1">
          Automate cost and usage reporting — generate CSV or JSON on a schedule
        </p>
      </div>
      <ScheduledReports />
    </div>
  )
}

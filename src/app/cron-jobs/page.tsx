import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Calendar, PlayCircle, PauseCircle } from 'lucide-react'

export default function CronJobsPage() {
  const cronJobs = [
    {
      id: '1',
      name: 'Database Backup',
      schedule: '0 2 * * *',
      scheduleText: 'Daily at 2:00 AM',
      status: 'active' as const,
      lastRun: '2 hours ago',
      nextRun: 'in 22 hours',
    },
    {
      id: '2',
      name: 'Agent Health Check',
      schedule: '*/15 * * * *',
      scheduleText: 'Every 15 minutes',
      status: 'active' as const,
      lastRun: '12 minutes ago',
      nextRun: 'in 3 minutes',
    },
    {
      id: '3',
      name: 'Weekly Report Generation',
      schedule: '0 9 * * 1',
      scheduleText: 'Every Monday at 9:00 AM',
      status: 'active' as const,
      lastRun: '6 days ago',
      nextRun: 'in 1 day',
    },
    {
      id: '4',
      name: 'Cache Cleanup',
      schedule: '0 0 * * 0',
      scheduleText: 'Every Sunday at midnight',
      status: 'idle' as const,
      lastRun: '3 days ago',
      nextRun: 'in 4 days',
    },
    {
      id: '5',
      name: 'API Usage Analytics',
      schedule: '0 */6 * * *',
      scheduleText: 'Every 6 hours',
      status: 'active' as const,
      lastRun: '4 hours ago',
      nextRun: 'in 2 hours',
    },
    {
      id: '6',
      name: 'System Maintenance',
      schedule: '0 3 1 * *',
      scheduleText: 'First day of month at 3:00 AM',
      status: 'idle' as const,
      lastRun: '14 days ago',
      nextRun: 'in 16 days',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Cron Jobs</h1>
        <p className="text-text-secondary">Scheduled tasks and automated workflows</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cronJobs.map((job) => (
          <Card key={job.id}>
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-accent-primary" />
                  <CardTitle className="text-base">{job.name}</CardTitle>
                </div>
                <Badge variant={job.status}>
                  {job.status === 'active' ? (
                    <span className="flex items-center gap-1">
                      <PlayCircle className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <PauseCircle className="w-3 h-3" />
                      Paused
                    </span>
                  )}
                </Badge>
              </div>
              <p className="text-xs text-text-muted font-mono">{job.schedule}</p>
              <p className="text-sm text-text-secondary mt-1">{job.scheduleText}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-text-muted" />
                <span className="text-text-secondary">
                  Last run: <span className="text-text-primary">{job.lastRun}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-text-muted" />
                <span className="text-text-secondary">
                  Next run: <span className="text-text-primary">{job.nextRun}</span>
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

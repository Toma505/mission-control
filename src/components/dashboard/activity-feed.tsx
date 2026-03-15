import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'

interface Activity {
  id: string
  type: string
  title: string
  description?: string
  status: string
  timestamp: Date
}

interface ActivityFeedProps {
  activities: Activity[]
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

function getStatusVariant(status: string): 'active' | 'progress' | 'idle' | 'error' {
  switch (status.toLowerCase()) {
    case 'completed': return 'active'
    case 'in_progress': return 'progress'
    case 'failed': return 'error'
    default: return 'idle'
  }
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle>Live Activity</CardTitle>
        <button className="text-sm text-accent-primary hover:text-accent-primary/80 flex items-center gap-1">
          View full activity
          <ChevronRight className="w-4 h-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-background-elevated transition-colors">
            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
              activity.status === 'COMPLETED' ? 'bg-status-active animate-pulse' :
              activity.status === 'IN_PROGRESS' ? 'bg-status-progress animate-pulse' :
              activity.status === 'FAILED' ? 'bg-status-error' : 'bg-status-idle'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge variant={getStatusVariant(activity.status)} className="mb-1">
                    {activity.title}
                  </Badge>
                  {activity.description && (
                    <p className="text-sm text-text-secondary mt-1">{activity.description}</p>
                  )}
                </div>
                <span className="text-xs text-text-muted flex-shrink-0">{formatTimeAgo(activity.timestamp)}</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

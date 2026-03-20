import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ChevronRight, Zap } from 'lucide-react'
import Link from 'next/link'

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

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-400" />
          <CardTitle className="text-[15px]">Live Activity</CardTitle>
        </div>
        <Link href="/workshop" className="text-[12px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors duration-200">
          View Workshop
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-0.5 pt-2">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 px-3 py-2.5 rounded-[10px] hover:bg-white/[0.03] transition-colors duration-200">
            <div className={`w-[7px] h-[7px] rounded-full mt-[7px] flex-shrink-0 ${
              activity.status === 'COMPLETED' ? 'bg-emerald-400' :
              activity.status === 'IN_PROGRESS' ? 'bg-amber-400 animate-pulse' :
              activity.status === 'FAILED' ? 'bg-red-400' : 'bg-blue-400'
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-text-primary">{activity.title}</p>
              {activity.description && (
                <p className="text-[12px] text-text-muted mt-0.5 leading-relaxed">{activity.description}</p>
              )}
            </div>
            <span className="text-[11px] text-text-muted/60 flex-shrink-0 mt-0.5">{formatTimeAgo(activity.timestamp)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

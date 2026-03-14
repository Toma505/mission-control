import { StatusCard } from '@/components/dashboard/status-card'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { QuickLinks } from '@/components/dashboard/quick-links'
import { CommitList } from '@/components/dashboard/commit-list'
import { Brain, CheckCircle, Clock, Zap } from 'lucide-react'

async function getDashboardData() {
  const res = await fetch('/api/activities', { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch dashboard data')
  const data = await res.json()
  
  // Convert ISO strings back to Date objects
  const activities = data.activities.map((a: any) => ({
    ...a,
    timestamp: new Date(a.timestamp)
  }))
  const commits = data.commits.map((c: any) => ({
    ...c,
    timestamp: new Date(c.timestamp)
  }))
  
  return { metrics: data.metrics, activities, commits }
}

export default async function Home() {
  const { metrics, activities, commits } = await getDashboardData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Mission Control</h1>
        <p className="text-text-secondary">AI Agent & Project Management Dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard icon={Brain} title="Active Agents" value={metrics.activeAgents.value} subtitle={metrics.activeAgents.subtitle} />
        <StatusCard icon={CheckCircle} title="Tasks Complete" value={metrics.tasksComplete.value} subtitle={metrics.tasksComplete.subtitle} iconColor="text-status-active" />
        <StatusCard icon={Clock} title="Uptime" value={metrics.uptime.value} subtitle={metrics.uptime.subtitle} iconColor="text-status-progress" />
        <StatusCard icon={Zap} title="API Calls" value={metrics.apiCalls.value} subtitle={metrics.apiCalls.subtitle} iconColor="text-accent-secondary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityFeed activities={activities} />
        <CommitList commits={commits} />
      </div>

      <QuickLinks />
    </div>
  )
}

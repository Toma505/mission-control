import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { AlertCircle, ArrowUp, ArrowRight, Minus } from 'lucide-react'

export default function WorkshopPage() {
  const tasks = [
    {
      id: '1',
      name: 'Implement API Authentication',
      status: 'progress' as const,
      priority: 'high',
      progress: 65,
      tags: ['backend', 'security'],
    },
    {
      id: '2',
      name: 'Dashboard UI Refinements',
      status: 'progress' as const,
      priority: 'medium',
      progress: 40,
      tags: ['frontend', 'ui'],
    },
    {
      id: '3',
      name: 'Database Schema Migration',
      status: 'active' as const,
      priority: 'high',
      progress: 90,
      tags: ['database', 'backend'],
    },
    {
      id: '4',
      name: 'Documentation Updates',
      status: 'idle' as const,
      priority: 'low',
      progress: 15,
      tags: ['docs'],
    },
    {
      id: '5',
      name: 'Performance Optimization',
      status: 'progress' as const,
      priority: 'medium',
      progress: 50,
      tags: ['optimization', 'backend'],
    },
    {
      id: '6',
      name: 'User Testing Feedback',
      status: 'planning' as const,
      priority: 'medium',
      progress: 10,
      tags: ['ux', 'research'],
    },
  ]

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <ArrowUp className="w-4 h-4 text-status-error" />
      case 'medium':
        return <ArrowRight className="w-4 h-4 text-status-progress" />
      case 'low':
        return <Minus className="w-4 h-4 text-text-muted" />
    }
  }

  const getProgressVariant = (progress: number): 'active' | 'progress' | 'idle' => {
    if (progress >= 80) return 'active'
    if (progress >= 30) return 'progress'
    return 'idle'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Workshop</h1>
        <p className="text-text-secondary">Active tasks and projects in development</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.map((task) => (
          <Card key={task.id}>
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <CardTitle className="text-base">{task.name}</CardTitle>
                <Badge variant={task.status}>
                  {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {getPriorityIcon(task.priority)}
                <span className="text-xs text-text-muted capitalize">{task.priority} Priority</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <ProgressBar value={task.progress} variant={getProgressVariant(task.progress)} showLabel />
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs rounded-md bg-background-elevated text-text-muted border border-border"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

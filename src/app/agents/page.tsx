import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Brain, Zap, CheckCircle } from 'lucide-react'

export default function AgentsPage() {
  const agents = [
    {
      id: '1',
      name: 'Research Agent',
      role: 'Information Gathering',
      status: 'active' as const,
      tasksCompleted: 127,
      avatar: '🔍',
    },
    {
      id: '2',
      name: 'Code Assistant',
      role: 'Development & Debug',
      status: 'active' as const,
      tasksCompleted: 89,
      avatar: '💻',
    },
    {
      id: '3',
      name: 'Data Analyst',
      role: 'Analytics & Insights',
      status: 'idle' as const,
      tasksCompleted: 54,
      avatar: '📊',
    },
    {
      id: '4',
      name: 'Content Writer',
      role: 'Documentation & Copy',
      status: 'active' as const,
      tasksCompleted: 203,
      avatar: '✍️',
    },
    {
      id: '5',
      name: 'Project Manager',
      role: 'Coordination & Planning',
      status: 'progress' as const,
      tasksCompleted: 76,
      avatar: '📋',
    },
    {
      id: '6',
      name: 'QA Tester',
      role: 'Quality Assurance',
      status: 'idle' as const,
      tasksCompleted: 42,
      avatar: '🧪',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Agents</h1>
        <p className="text-text-secondary">Manage and monitor your AI agents</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <Card key={agent.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{agent.avatar}</div>
                  <div>
                    <CardTitle>{agent.name}</CardTitle>
                    <p className="text-sm text-text-muted mt-1">{agent.role}</p>
                  </div>
                </div>
                <Badge variant={agent.status}>
                  {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-text-secondary">
                <CheckCircle className="w-4 h-4 text-status-active" />
                <span className="text-sm">
                  <span className="font-semibold text-text-primary">{agent.tasksCompleted}</span> tasks completed
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

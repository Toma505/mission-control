import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, TrendingUp, CheckCircle, Zap } from 'lucide-react'

export default function WeeklyRecapsPage() {
  const recaps = [
    {
      id: '1',
      week: 'Week of March 10-16, 2026',
      title: 'Major UI Development Sprint',
      status: 'active' as const,
      summary: 'Completed 6 navigation pages including Agents, Workshop, Clients, Intelligence, Journal, and Documents. Integrated API routes with mock data. Dashboard now fully functional with real-time updates.',
      tasksCompleted: 18,
      hoursLogged: 42,
    },
    {
      id: '2',
      week: 'Week of March 3-9, 2026',
      title: 'Database Architecture & Setup',
      status: 'idle' as const,
      summary: 'Finalized Prisma schema with 8 models. Configured Prisma 7 compatibility. Generated client successfully. Database push blocked pending PostgreSQL setup.',
      tasksCompleted: 12,
      hoursLogged: 28,
    },
    {
      id: '3',
      week: 'Week of Feb 24 - Mar 2, 2026',
      title: 'Design System Foundation',
      status: 'idle' as const,
      summary: 'Built complete design system with custom dark theme. Created reusable UI component library: Card, Badge, Button, ProgressBar. Established color palette and typography scale.',
      tasksCompleted: 15,
      hoursLogged: 35,
    },
    {
      id: '4',
      week: 'Week of Feb 17-23, 2026',
      title: 'Project Kickoff & Planning',
      status: 'idle' as const,
      summary: 'Initial project setup with Next.js 14, TypeScript, and Tailwind CSS. Core layout components created: AppShell, Sidebar, Header. Repository initialized with Git.',
      tasksCompleted: 10,
      hoursLogged: 24,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Weekly Recaps</h1>
        <p className="text-text-secondary">Project progress summaries and highlights</p>
      </div>

      <div className="space-y-4">
        {recaps.map((recap) => (
          <Card key={recap.id}>
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-text-muted" />
                    <span className="text-sm text-text-muted">{recap.week}</span>
                    <Badge variant={recap.status}>Current Week</Badge>
                  </div>
                  <CardTitle className="text-lg">{recap.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-text-secondary leading-relaxed">{recap.summary}</p>
              <div className="flex items-center gap-6 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-status-active" />
                  <span className="text-sm text-text-secondary">
                    <span className="font-semibold text-text-primary">{recap.tasksCompleted}</span> tasks completed
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-status-progress" />
                  <span className="text-sm text-text-secondary">
                    <span className="font-semibold text-text-primary">{recap.hoursLogged}</span> hours logged
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

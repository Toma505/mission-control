import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, FileText } from 'lucide-react'

export default function JournalPage() {
  const entries = [
    {
      id: '1',
      title: 'Project Kickoff - Mission Control Dashboard',
      date: 'March 14, 2026',
      category: 'Project',
      preview: 'Started building the Mission Control dashboard. Implemented core layout with AppShell, Sidebar, and Header components. Set up Tailwind with custom dark theme.',
    },
    {
      id: '2',
      title: 'Database Architecture Decisions',
      date: 'March 13, 2026',
      category: 'Technical',
      preview: 'Finalized Prisma schema with 8 models: Agent, Task, Activity, Commit, Document, Client, CronJob, and SystemStatus. Chose PostgreSQL for production.',
    },
    {
      id: '3',
      title: 'User Research Insights',
      date: 'March 12, 2026',
      category: 'Research',
      preview: 'Interviewed 5 users about AI agent management needs. Key finding: context retention across sessions is the #1 pain point. Need persistent memory solution.',
    },
    {
      id: '4',
      title: 'Performance Optimization Notes',
      date: 'March 11, 2026',
      category: 'Technical',
      preview: 'Reduced dashboard load time from 3.2s to 1.8s by implementing server-side rendering and relative API paths. Next: optimize image loading.',
    },
    {
      id: '5',
      title: 'Team Meeting - Q1 Planning',
      date: 'March 10, 2026',
      category: 'Meeting',
      preview: 'Discussed Q1 priorities: complete navigation pages, integrate database, implement real-time updates, and add authentication layer.',
    },
    {
      id: '6',
      title: 'Design System Documentation',
      date: 'March 9, 2026',
      category: 'Design',
      preview: 'Documented color palette, typography scale, and component library. Created Figma mockups for remaining navigation pages.',
    },
  ]

  const getCategoryVariant = (category: string): 'active' | 'progress' | 'idle' | 'planning' => {
    switch (category.toLowerCase()) {
      case 'project': return 'active'
      case 'technical': return 'progress'
      case 'research': return 'planning'
      case 'meeting': return 'idle'
      default: return 'idle'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Journal</h1>
        <p className="text-text-secondary">Development notes and project insights</p>
      </div>

      <div className="space-y-4">
        {entries.map((entry) => (
          <Card key={entry.id}>
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-3 flex-1">
                  <FileText className="w-5 h-5 text-accent-primary mt-0.5" />
                  <div className="flex-1">
                    <CardTitle className="text-lg">{entry.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Calendar className="w-4 h-4 text-text-muted" />
                      <span className="text-sm text-text-muted">{entry.date}</span>
                    </div>
                  </div>
                </div>
                <Badge variant={getCategoryVariant(entry.category)}>
                  {entry.category}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-secondary leading-relaxed">{entry.preview}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

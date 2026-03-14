import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Brain, TrendingUp, Target, FileSearch, Lightbulb, Shield } from 'lucide-react'

export default function IntelligencePage() {
  const research = [
    {
      id: '1',
      title: 'AI Agent Market Trends 2026',
      category: 'Market Research',
      status: 'active' as const,
      icon: TrendingUp,
      finding: 'Agent orchestration platforms growing 340% YoY. Multi-agent systems becoming industry standard.',
    },
    {
      id: '2',
      title: 'Competitor Analysis: Automation Tools',
      category: 'Competitive Intel',
      status: 'progress' as const,
      icon: Target,
      finding: 'Top 3 competitors focus on single-agent workflows. Opportunity for multi-agent differentiation.',
    },
    {
      id: '3',
      title: 'Customer Pain Points Research',
      category: 'User Research',
      status: 'active' as const,
      icon: FileSearch,
      finding: 'Primary pain point: context retention across agent sessions. 87% of users cite this issue.',
    },
    {
      id: '4',
      title: 'Emerging Tech: LLM Fine-tuning',
      category: 'Technology',
      status: 'planning' as const,
      icon: Lightbulb,
      finding: 'Domain-specific fine-tuning reduces hallucinations by 60%. Worth exploring for vertical markets.',
    },
    {
      id: '5',
      title: 'Security Best Practices Review',
      category: 'Security',
      status: 'active' as const,
      icon: Shield,
      finding: 'Zero-trust architecture critical for AI agents. Implement sandboxed execution environments.',
    },
    {
      id: '6',
      title: 'Industry Benchmarking Study',
      category: 'Analysis',
      status: 'idle' as const,
      icon: Brain,
      finding: 'Average agent response time: 2.3s. Our system at 1.8s - competitive advantage confirmed.',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Intelligence</h1>
        <p className="text-text-secondary">Research insights and competitive intelligence</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {research.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex items-start gap-3 mb-2">
                <div className="p-2 rounded-lg bg-accent-primary/10">
                  <item.icon className="w-5 h-5 text-accent-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base leading-tight">{item.title}</CardTitle>
                  <p className="text-xs text-text-muted mt-1">{item.category}</p>
                </div>
              </div>
              <Badge variant={item.status}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="p-3 rounded-lg bg-background-elevated border border-border">
                <p className="text-sm text-text-secondary leading-relaxed">{item.finding}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ArrowRight, Briefcase, Brain, Wrench } from 'lucide-react'
import Link from 'next/link'

const quickLinks = [
  { name: 'Workshop', icon: Wrench, href: '/workshop', color: 'text-status-progress' },
  { name: 'Client Intelligence', icon: Briefcase, href: '/clients', color: 'text-status-idle' },
  { name: 'Research', icon: Brain, href: '/intelligence', color: 'text-status-planning' },
]

export function QuickLinks() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Quick Links</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="group p-4 rounded-lg border border-border bg-background-elevated hover:bg-background-card hover:border-accent-primary/30 transition-all"
            >
              <link.icon className={`w-6 h-6 mb-2 ${link.color}`} />
              <p className="text-sm font-medium text-text-primary mb-1">{link.name}</p>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent-primary group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

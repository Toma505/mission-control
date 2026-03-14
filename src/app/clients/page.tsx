import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Calendar, DollarSign, Users } from 'lucide-react'

export default function ClientsPage() {
  const clients = [
    {
      id: '1',
      name: 'Acme Corporation',
      status: 'active' as const,
      lastActivity: '2 hours ago',
      industry: 'Technology',
      projects: 5,
      revenue: '$125K',
    },
    {
      id: '2',
      name: 'Global Innovations Ltd',
      status: 'active' as const,
      lastActivity: '1 day ago',
      industry: 'Finance',
      projects: 3,
      revenue: '$89K',
    },
    {
      id: '3',
      name: 'TechStart Ventures',
      status: 'inactive' as const,
      lastActivity: '2 weeks ago',
      industry: 'Startup',
      projects: 1,
      revenue: '$42K',
    },
    {
      id: '4',
      name: 'Enterprise Solutions Co',
      status: 'active' as const,
      lastActivity: '3 hours ago',
      industry: 'Enterprise',
      projects: 8,
      revenue: '$210K',
    },
    {
      id: '5',
      name: 'Creative Agency Plus',
      status: 'active' as const,
      lastActivity: '5 hours ago',
      industry: 'Marketing',
      projects: 4,
      revenue: '$67K',
    },
    {
      id: '6',
      name: 'DataFlow Systems',
      status: 'inactive' as const,
      lastActivity: '1 month ago',
      industry: 'Analytics',
      projects: 2,
      revenue: '$38K',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Clients</h1>
        <p className="text-text-secondary">Manage client relationships and track engagement</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client) => (
          <Card key={client.id}>
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-accent-primary" />
                  <CardTitle className="text-base">{client.name}</CardTitle>
                </div>
                <Badge variant={client.status === 'active' ? 'active' : 'idle'}>
                  {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                </Badge>
              </div>
              <p className="text-xs text-text-muted">{client.industry}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-text-muted" />
                  <span className="text-text-secondary">
                    Last active: <span className="text-text-primary">{client.lastActivity}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-text-muted" />
                  <span className="text-text-secondary">
                    <span className="font-semibold text-text-primary">{client.projects}</span> active projects
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-text-muted" />
                  <span className="text-text-secondary">
                    Revenue: <span className="font-semibold text-text-primary">{client.revenue}</span>
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

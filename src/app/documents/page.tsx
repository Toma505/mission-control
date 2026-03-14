import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, File, Image, Code, Archive, Calendar } from 'lucide-react'

export default function DocumentsPage() {
  const documents = [
    {
      id: '1',
      name: 'Project Requirements.pdf',
      type: 'PDF',
      category: 'planning' as const,
      updatedAt: '2 hours ago',
      description: 'Complete project specification and requirements document for Mission Control dashboard.',
      icon: FileText,
    },
    {
      id: '2',
      name: 'API Documentation.md',
      type: 'Markdown',
      category: 'idle' as const,
      updatedAt: '1 day ago',
      description: 'Technical documentation for REST API endpoints and authentication flow.',
      icon: Code,
    },
    {
      id: '3',
      name: 'Design Mockups.fig',
      type: 'Figma',
      category: 'active' as const,
      updatedAt: '3 hours ago',
      description: 'UI/UX design files including wireframes, components, and style guide.',
      icon: Image,
    },
    {
      id: '4',
      name: 'Database Schema.sql',
      type: 'SQL',
      category: 'progress' as const,
      updatedAt: '5 hours ago',
      description: 'PostgreSQL schema definitions and migration scripts for production database.',
      icon: Code,
    },
    {
      id: '5',
      name: 'Meeting Notes Q1.docx',
      type: 'Document',
      category: 'idle' as const,
      updatedAt: '4 days ago',
      description: 'Quarterly planning notes, action items, and decisions from team meetings.',
      icon: File,
    },
    {
      id: '6',
      name: 'Project Assets.zip',
      type: 'Archive',
      category: 'idle' as const,
      updatedAt: '1 week ago',
      description: 'Compressed archive containing logos, icons, fonts, and brand assets.',
      icon: Archive,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Documents</h1>
        <p className="text-text-secondary">Manage project files and documentation</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <Card key={doc.id}>
            <CardHeader>
              <div className="flex items-start gap-3 mb-2">
                <div className="p-2 rounded-lg bg-accent-primary/10">
                  <doc.icon className="w-5 h-5 text-accent-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base leading-tight truncate">{doc.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={doc.category}>{doc.type}</Badge>
                    <div className="flex items-center gap-1 text-xs text-text-muted">
                      <Calendar className="w-3 h-3" />
                      <span>{doc.updatedAt}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">
                {doc.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

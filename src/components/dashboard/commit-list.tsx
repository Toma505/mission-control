import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { GitCommit } from 'lucide-react'

interface Commit {
  id: string
  message: string
  author: string
  timestamp: Date
}

interface CommitListProps {
  commits: Commit[]
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 60) return `${diffMins}m ago`
  return `${diffHours}h ago`
}

export function CommitList({ commits }: CommitListProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle>Recent Commits</CardTitle>
          <span className="text-sm text-text-muted">{commits.length} total</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {commits.map((commit) => (
          <div key={commit.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-background-elevated transition-colors">
            <div className="w-8 h-8 rounded-full bg-accent-primary/10 shadow-md shadow-accent-primary/20 flex items-center justify-center flex-shrink-0">
              <GitCommit className="w-4 h-4 text-accent-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary font-medium line-clamp-1">{commit.message}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-text-muted">{commit.author}</span>
                <span className="text-xs text-text-muted">•</span>
                <span className="text-xs text-text-muted">{formatTimeAgo(commit.timestamp)}</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

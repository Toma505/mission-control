import { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface StatusCardProps {
  icon: LucideIcon
  title: string
  value: string
  subtitle: string
  iconColor?: string
}

export function StatusCard({ icon: Icon, title, value, subtitle, iconColor = 'text-accent-primary' }: StatusCardProps) {
  return (
    <Card className="flex items-start gap-4">
      <div className={`p-3 rounded-lg bg-background-elevated ${iconColor}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">{title}</p>
        <p className="text-2xl font-bold text-text-primary mb-1">{value}</p>
        <p className="text-sm text-text-secondary">{subtitle}</p>
      </div>
    </Card>
  )
}

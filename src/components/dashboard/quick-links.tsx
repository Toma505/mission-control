import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ArrowRight, Clapperboard, DollarSign, Shield, BarChart3, Users } from 'lucide-react'
import Link from 'next/link'

const quickLinks = [
  { name: 'Operations', description: 'Pipeline jobs', icon: Clapperboard, href: '/operations', color: 'text-violet-400', bg: 'bg-violet-400/8' },
  { name: 'Costs', description: 'Spend tracking', icon: DollarSign, href: '/costs', color: 'text-emerald-400', bg: 'bg-emerald-400/8' },
  { name: 'API Usage', description: 'Token breakdown', icon: BarChart3, href: '/api-usage', color: 'text-sky-400', bg: 'bg-sky-400/8' },
  { name: 'Agents', description: 'Model config', icon: Users, href: '/agents', color: 'text-amber-400', bg: 'bg-amber-400/8' },
]

export function QuickLinks() {
  return (
    <Card className="p-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-[14px]">Quick Access</CardTitle>
      </CardHeader>
      <CardContent className="pt-1 space-y-0.5">
        {quickLinks.map((link) => (
          <Link
            key={link.name}
            href={link.href}
            className="group flex items-center gap-3 p-2 rounded-[10px] hover:bg-white/[0.03] transition-all duration-200"
          >
            <div className={`w-7 h-7 rounded-[8px] ${link.bg} flex items-center justify-center`}>
              <link.icon className={`w-3.5 h-3.5 ${link.color}`} />
            </div>
            <div className="flex-1">
              <span className="text-[13px] font-medium text-text-primary">{link.name}</span>
              <p className="text-[10px] text-text-muted">{link.description}</p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-text-muted/30 group-hover:text-text-muted group-hover:translate-x-0.5 transition-all duration-200" />
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

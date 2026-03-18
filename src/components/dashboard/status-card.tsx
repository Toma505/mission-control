import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

interface StatusCardProps {
  icon?: any
  title: string
  value: string
  subtitle: string
  iconColor?: string
  dotColor?: string
  href?: string
}

export function StatusCard({ title, value, subtitle, dotColor, href }: StatusCardProps) {
  const content = (
    <div className="rounded-2xl p-4 glass glass-hover transition-all duration-300 cursor-pointer group">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          {dotColor && <div className={`w-[6px] h-[6px] rounded-full ${dotColor}`} />}
          <span className="text-[10px] font-medium text-text-muted/80 uppercase tracking-[0.1em]">{title}</span>
        </div>
        <ArrowUpRight className="w-3.5 h-3.5 text-text-muted/40 group-hover:text-blue-400 transition-colors duration-200" />
      </div>
      <div>
        <p className="text-lg font-semibold text-text-primary tracking-tight">{value}</p>
        {subtitle && <p className="text-[11px] text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}

"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Users,
  Brain,
  Calendar,
  Briefcase,
  Clock,
  BarChart3,
  Settings,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Journal', href: '/journal', icon: BookOpen },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Agents', href: '/agents', icon: Users },
  { name: 'Intelligence', href: '/intelligence', icon: Brain },
  { name: 'Weekly Recaps', href: '/weekly-recaps', icon: Calendar },
  { name: 'Clients', href: '/clients', icon: Briefcase },
  { name: 'Cron Jobs', href: '/cron-jobs', icon: Clock },
  { name: 'API Usage', href: '/api-usage', icon: BarChart3 },
  { name: 'Workshop', href: '/workshop', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-background-secondary border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">Mission Control</h1>
            <p className="text-xs text-text-muted">v1.0</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        <p className="px-3 text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          Navigation
        </p>
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent-primary text-white'
                  : 'text-text-secondary hover:bg-background-elevated hover:text-text-primary'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent-secondary flex items-center justify-center text-white font-semibold text-sm">
            JA
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">Jarvis</p>
            <p className="text-xs text-text-muted">AI Assistant</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

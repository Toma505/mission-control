"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
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
  Wrench,
  DollarSign,
  Shield,
  Clapperboard,
  Settings,
  ChevronDown,
  MessageSquare,
  BellRing,
  Globe,
  Package,
  UsersRound,
  Workflow,
  Archive,
  Camera,
  Sparkles,
  PieChart,
  History,
  BookMarked,
  Tags,
  KeyRound,
  Award,
  FileBarChart,
} from 'lucide-react'

const mainNav = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Operations', href: '/operations', icon: Clapperboard },
  { name: 'Agents', href: '/agents', icon: Users },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Replay', href: '/replay', icon: History },
  { name: 'Plugins', href: '/plugins', icon: Package },
  { name: 'Skills', href: '/skills', icon: Shield },
  { name: 'Presets', href: '/presets', icon: Sparkles },
  { name: 'Workflows', href: '/workflows', icon: Workflow },
]

const monitorNav = [
  { name: 'Costs', href: '/costs', icon: DollarSign },
  { name: 'Analytics', href: '/analytics', icon: PieChart },
  { name: 'Benchmarks', href: '/benchmarks', icon: Award },
  { name: 'API Usage', href: '/api-usage', icon: BarChart3 },
  { name: 'Instances', href: '/instances', icon: Globe },
  { name: 'Alerts', href: '/alerts', icon: BellRing },
  { name: 'Team', href: '/team', icon: UsersRound },
  { name: 'Journal', href: '/journal', icon: BookOpen },
]

const workspaceNav = [
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Intelligence', href: '/intelligence', icon: Brain },
  { name: 'Workshop', href: '/workshop', icon: Wrench },
  { name: 'Clients', href: '/clients', icon: Briefcase },
  { name: 'Cron Jobs', href: '/cron-jobs', icon: Clock },
  { name: 'Prompts', href: '/prompts', icon: BookMarked },
  { name: 'Cost Tags', href: '/cost-tags', icon: Tags },
  { name: 'Key Vault', href: '/vault', icon: KeyRound },
  { name: 'Reports', href: '/reports', icon: FileBarChart },
  { name: 'Webhooks', href: '/webhooks', icon: Workflow },
  { name: 'Snapshots', href: '/snapshots', icon: Camera },
  { name: 'Backup', href: '/backup', icon: Archive },
]

function NavSection({ label, items }: { label: string; items: typeof mainNav }) {
  const pathname = usePathname()

  return (
    <div className="mb-3">
      <p className="px-3 text-[10px] font-medium text-text-muted/50 uppercase tracking-[0.12em] mb-1.5">
        {label}
      </p>
      {items.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-[7px] rounded-[10px] text-[13px] font-medium transition-all duration-200',
              isActive
                ? 'bg-[var(--accent-primary,#3b82f6)]/10 text-[var(--text-primary)] shadow-[inset_0_0_0_1px_var(--glass-border)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--glass-border)] hover:text-[var(--text-primary)]'
            )}
          >
            <item.icon className={cn(
              "w-[18px] h-[18px]",
              isActive ? "text-[var(--accent-primary,#3b82f6)]" : "text-[var(--text-muted)]"
            )} />
            {item.name}
          </Link>
        )
      })}
    </div>
  )
}

export function Sidebar() {
  const [status, setStatus] = useState<{ connected: boolean; mode: string; model: string }>({
    connected: false,
    mode: 'unknown',
    model: '',
  })

  useEffect(() => {
    fetch('/api/mode')
      .then(r => r.json())
      .then(data => {
        setStatus({
          connected: data.connected,
          mode: data.mode || 'unknown',
          model: data.currentModel?.split('/').pop() || '',
        })
      })
      .catch(() => {})

    const interval = setInterval(() => {
      fetch('/api/mode')
        .then(r => r.json())
        .then(data => {
          setStatus({
            connected: data.connected,
            mode: data.mode || 'unknown',
            model: data.currentModel?.split('/').pop() || '',
          })
        })
        .catch(() => {})
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  const modeColors: Record<string, string> = {
    best: 'bg-amber-400',
    standard: 'bg-sky-400',
    budget: 'bg-emerald-400',
    auto: 'bg-violet-400',
  }

  return (
    <aside className="w-64 flex flex-col glass-sidebar">
      {/* Logo & Status */}
      <div className="p-5 pb-4 electron-drag">
        <div className="flex items-center gap-3 electron-no-drag">
          <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center shadow-lg shadow-black/20">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-text-primary tracking-tight">Mission Control</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={cn(
                "w-[6px] h-[6px] rounded-full",
                status.connected ? modeColors[status.mode] || 'bg-emerald-400' : 'bg-red-400'
              )} />
              <span className="text-[11px] text-text-muted capitalize">
                {status.connected ? `${status.mode} mode` : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 px-3 overflow-y-auto">
        <NavSection label="Core" items={mainNav} />
        <NavSection label="Monitor" items={monitorNav} />
        <NavSection label="Workspace" items={workspaceNav} />
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-[var(--glass-border)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-500 to-zinc-600 flex items-center justify-center text-white font-medium text-xs shadow-md shadow-black/15">
            T
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-text-primary">Tomas</p>
            <p className="text-[11px] text-text-muted">
              {status.connected ? status.model : 'Disconnected'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}

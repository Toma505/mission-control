"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { type ComponentType, type MouseEvent, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Award,
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Camera,
  Clapperboard,
  Clock,
  Database,
  DollarSign,
  FileBarChart,
  FileText,
  GitBranch,
  GitCompare,
  Globe,
  Keyboard,
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
  MessageSquare,
  Package,
  PieChart,
  PlayCircle,
  ScrollText,
  Sparkles,
  Star,
  Tags,
  TrendingUp,
  Users,
  UsersRound,
  Workflow,
  Wrench,
} from 'lucide-react'

import { useSettings } from '@/contexts/settings-context'

type NavItem = {
  name: string
  href: string
  icon: ComponentType<{ className?: string }>
}

const MAX_PINNED_PAGES = 8

const mainNav: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Operations', href: '/operations', icon: Clapperboard },
  { name: 'Agents', href: '/agents', icon: Users },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Agent Chat', href: '/agent-chat', icon: Bot },
  { name: 'Replay', href: '/replay', icon: PlayCircle },
  { name: 'Extensions', href: '/extensions', icon: Package },
  { name: 'Templates', href: '/templates', icon: LayoutTemplate },
  { name: 'Presets', href: '/presets', icon: Sparkles },
  { name: 'Workflows', href: '/workflows', icon: Workflow },
  { name: 'Orchestrate', href: '/orchestrate', icon: GitBranch },
]

const monitorNav: NavItem[] = [
  { name: 'Cost Dashboard', href: '/costs', icon: DollarSign },
  { name: 'Analytics', href: '/analytics', icon: PieChart },
  { name: 'Benchmarks', href: '/benchmarks', icon: Award },
  { name: 'Compare', href: '/cost-compare', icon: GitCompare },
  { name: 'Forecast', href: '/forecast', icon: TrendingUp },
  { name: 'API Usage', href: '/api-usage', icon: BarChart3 },
  { name: 'Instances', href: '/instances', icon: Globe },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Alerts', href: '/alerts', icon: BellRing },
  { name: 'Team Usage', href: '/team-dashboard', icon: UsersRound },
  { name: 'Team', href: '/team', icon: UsersRound },
  { name: 'Journal', href: '/journal', icon: BookOpen },
]

const workspaceNav: NavItem[] = [
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Intelligence', href: '/intelligence', icon: Brain },
  { name: 'Changelog', href: '/changelog', icon: Sparkles },
  { name: 'Knowledge Base', href: '/knowledge', icon: Database },
  { name: 'Workshop', href: '/workshop', icon: Wrench },
  { name: 'Clients', href: '/clients', icon: Briefcase },
  { name: 'Scheduled Tasks', href: '/schedules', icon: Clock },
  { name: 'Prompts', href: '/prompts', icon: BookOpen },
  { name: 'Cost Tags', href: '/cost-tags', icon: Tags },
  { name: 'Key Vault', href: '/vault', icon: KeyRound },
  { name: 'Reports', href: '/reports', icon: FileBarChart },
  { name: 'Webhooks', href: '/webhooks', icon: Workflow },
  { name: 'Snapshots', href: '/snapshots', icon: Camera },
  { name: 'Backup', href: '/backup', icon: Archive },
  { name: 'Shortcuts', href: '/settings/shortcuts', icon: Keyboard },
  { name: 'Audit Log', href: '/audit', icon: ScrollText },
]

function SidebarItem({
  item,
  isPinned,
  draggable = false,
  onTogglePin,
  onDragStart,
  onDrop,
  onContextMenu,
}: {
  item: NavItem
  isPinned: boolean
  draggable?: boolean
  onTogglePin: (href: string) => void
  onDragStart?: (href: string) => void
  onDrop?: (href: string) => void
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void
}) {
  const pathname = usePathname()
  const isActive = pathname === item.href

  return (
    <div
      draggable={draggable}
      onDragStart={() => onDragStart?.(item.href)}
      onDragOver={(event) => {
        if (!draggable) return
        event.preventDefault()
      }}
      onDrop={(event) => {
        if (!draggable) return
        event.preventDefault()
        onDrop?.(item.href)
      }}
      onContextMenu={onContextMenu}
      className={cn('group flex items-center gap-1.5', draggable && 'cursor-grab active:cursor-grabbing')}
    >
      <Link
        href={item.href}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-3 py-[7px] text-[13px] font-medium transition-all duration-200',
          isActive
            ? 'bg-[var(--accent-primary,#3b82f6)]/10 text-[var(--text-primary)] shadow-[inset_0_0_0_1px_var(--glass-border)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--glass-border)] hover:text-[var(--text-primary)]',
        )}
      >
        <item.icon
          className={cn(
            'h-[18px] w-[18px] shrink-0',
            isActive ? 'text-[var(--accent-primary,#3b82f6)]' : 'text-[var(--text-muted)]',
          )}
        />
        <span className="truncate">{item.name}</span>
      </Link>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onTogglePin(item.href)
        }}
        className={cn(
          'rounded-lg p-1.5 transition-all duration-200',
          isPinned
            ? 'text-amber-300 opacity-100 hover:bg-amber-400/10 hover:text-amber-200'
            : 'text-text-muted opacity-0 group-hover:opacity-100 hover:bg-white/[0.06] hover:text-amber-300',
        )}
        aria-label={isPinned ? `Unpin ${item.name}` : `Pin ${item.name}`}
        title={isPinned ? `Unpin ${item.name}` : `Pin ${item.name}`}
      >
        <Star className="h-3.5 w-3.5" fill={isPinned ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}

function NavSection({
  label,
  items,
  pinnedHrefs,
  onTogglePin,
}: {
  label: string
  items: NavItem[]
  pinnedHrefs: string[]
  onTogglePin: (href: string) => void
}) {
  const visibleItems = items.filter((item) => !pinnedHrefs.includes(item.href))
  if (visibleItems.length === 0) return null

  return (
    <div className="mb-3">
      <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted/50">
        {label}
      </p>
      <div className="space-y-0.5">
        {visibleItems.map((item) => (
          <SidebarItem
            key={item.href}
            item={item}
            isPinned={false}
            onTogglePin={onTogglePin}
          />
        ))}
      </div>
    </div>
  )
}

export function Sidebar() {
  const { settings, updateSetting } = useSettings()
  const [status, setStatus] = useState<{ connected: boolean; mode: string; model: string }>({
    connected: false,
    mode: 'unknown',
    model: '',
  })
  const [draggedHref, setDraggedHref] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const allNavItems = useMemo(
    () => [...mainNav, ...monitorNav, ...workspaceNav],
    [],
  )

  const pinnedItems = useMemo(
    () =>
      settings.pinnedPages
        .map((href) => allNavItems.find((item) => item.href === href))
        .filter((item): item is NavItem => item !== undefined),
    [allNavItems, settings.pinnedPages],
  )

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

  useEffect(() => {
    if (!toast) return
    const timeoutId = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  function persistPinnedPages(nextPinnedPages: string[]) {
    updateSetting('pinnedPages', nextPinnedPages)
  }

  function togglePinnedPage(href: string) {
    const isAlreadyPinned = settings.pinnedPages.includes(href)

    if (isAlreadyPinned) {
      persistPinnedPages(settings.pinnedPages.filter((item) => item !== href))
      return
    }

    if (settings.pinnedPages.length >= MAX_PINNED_PAGES) {
      setToast('You can pin up to 8 pages.')
      return
    }

    persistPinnedPages([...settings.pinnedPages, href])
  }

  function reorderPinnedPages(targetHref: string) {
    if (!draggedHref || draggedHref === targetHref) return

    const nextPinnedPages = [...settings.pinnedPages]
    const sourceIndex = nextPinnedPages.indexOf(draggedHref)
    const targetIndex = nextPinnedPages.indexOf(targetHref)
    if (sourceIndex === -1 || targetIndex === -1) return

    nextPinnedPages.splice(sourceIndex, 1)
    nextPinnedPages.splice(targetIndex, 0, draggedHref)
    persistPinnedPages(nextPinnedPages)
  }

  const modeColors: Record<string, string> = {
    best: 'bg-amber-400',
    standard: 'bg-sky-400',
    budget: 'bg-emerald-400',
    auto: 'bg-violet-400',
  }

  return (
    <aside className="relative flex w-64 flex-col glass-sidebar">
      <div className="p-5 pb-4 electron-drag">
        <div className="flex items-center gap-3 electron-no-drag">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-zinc-600 to-zinc-700 shadow-lg shadow-black/20">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-text-primary">Mission Control</h1>
            <div className="mt-0.5 flex items-center gap-1.5">
              <div
                className={cn(
                  'h-[6px] w-[6px] rounded-full',
                  status.connected ? modeColors[status.mode] || 'bg-emerald-400' : 'bg-red-400',
                )}
              />
              <span className="text-[11px] capitalize text-text-muted">
                {status.connected ? `${status.mode} mode` : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        {pinnedItems.length > 0 ? (
          <div className="mb-4">
            <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted/50">
              Pinned
            </p>
            <div className="space-y-0.5">
              {pinnedItems.map((item) => (
                <SidebarItem
                  key={item.href}
                  item={item}
                  isPinned
                  draggable
                  onTogglePin={togglePinnedPage}
                  onDragStart={(href) => setDraggedHref(href)}
                  onDrop={(href) => {
                    reorderPinnedPages(href)
                    setDraggedHref(null)
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    togglePinnedPage(item.href)
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}

        <NavSection
          label="Core"
          items={mainNav}
          pinnedHrefs={settings.pinnedPages}
          onTogglePin={togglePinnedPage}
        />
        <NavSection
          label="Monitor"
          items={monitorNav}
          pinnedHrefs={settings.pinnedPages}
          onTogglePin={togglePinnedPage}
        />
        <NavSection
          label="Workspace"
          items={workspaceNav}
          pinnedHrefs={settings.pinnedPages}
          onTogglePin={togglePinnedPage}
        />
      </nav>

      <div className="border-t border-[var(--glass-border)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-zinc-500 to-zinc-600 text-xs font-medium text-white shadow-md shadow-black/15">
            T
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-text-primary">Tomas</p>
            <p className="text-[11px] text-text-muted">
              {status.connected ? status.model : 'Disconnected'}
            </p>
          </div>
        </div>
      </div>

      {toast ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-20 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-100 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          {toast}
        </div>
      ) : null}
    </aside>
  )
}

"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
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
  GripVertical,
  KeyRound,
  Keyboard,
  LayoutDashboard,
  LayoutTemplate,
  MessageSquare,
  Package,
  PieChart,
  PlayCircle,
  RotateCcw,
  ScrollText,
  Sparkles,
  Tags,
  TrendingUp,
  Users,
  UsersRound,
  Workflow,
  Wrench,
} from 'lucide-react'

import { apiFetch } from '@/lib/api-client'
import type { Settings, SidebarOrder, SidebarSectionKey } from '@/lib/app-settings'
import { cn } from '@/lib/utils'

type NavItem = {
  name: string
  href: string
  icon: LucideIcon
}

type DraggedItem = {
  section: SidebarSectionKey
  href: string
}

type DropTarget = {
  section: SidebarSectionKey
  href: string
  position: 'before' | 'after'
}

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
  { name: 'Team', href: '/team', icon: UsersRound },
  { name: 'Journal', href: '/journal', icon: BookOpen },
]

const workspaceNav: NavItem[] = [
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Intelligence', href: '/intelligence', icon: Brain },
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

const DEFAULT_SECTION_ITEMS: Record<SidebarSectionKey, NavItem[]> = {
  main: mainNav,
  monitor: monitorNav,
  workspace: workspaceNav,
}

const DEFAULT_SECTION_ORDER: Record<SidebarSectionKey, string[]> = {
  main: mainNav.map((item) => item.href),
  monitor: monitorNav.map((item) => item.href),
  workspace: workspaceNav.map((item) => item.href),
}

const SECTION_LABELS: Record<SidebarSectionKey, string> = {
  main: 'Main',
  monitor: 'Monitor',
  workspace: 'Workspace',
}

function orderItems(section: SidebarSectionKey, customOrder: string[] | undefined) {
  const items = DEFAULT_SECTION_ITEMS[section]
  const validHrefs = new Set(items.map((item) => item.href))
  const requestedOrder = Array.isArray(customOrder)
    ? [...new Set(customOrder.filter((href) => validHrefs.has(href)))]
    : []

  const missing = items.map((item) => item.href).filter((href) => !requestedOrder.includes(href))
  const resolvedOrder = [...requestedOrder, ...missing]

  return resolvedOrder
    .map((href) => items.find((item) => item.href === href))
    .filter((item): item is NavItem => !!item)
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function insertAt<T>(items: T[], index: number, item: T) {
  const next = [...items]
  next.splice(index, 0, item)
  return next
}

function buildDragGhost(source: HTMLElement) {
  const ghost = source.cloneNode(true) as HTMLElement
  ghost.style.position = 'fixed'
  ghost.style.top = '-1000px'
  ghost.style.left = '-1000px'
  ghost.style.width = `${source.offsetWidth}px`
  ghost.style.pointerEvents = 'none'
  ghost.style.opacity = '0.95'
  ghost.style.transform = 'rotate(1deg)'
  ghost.style.boxShadow = '0 18px 40px rgba(0, 0, 0, 0.35)'
  ghost.style.borderRadius = '12px'
  document.body.appendChild(ghost)
  return ghost
}

function SectionHeader({
  label,
  customized,
  onReset,
}: {
  label: string
  customized: boolean
  onReset: () => void
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between px-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted/50">
        {label}
      </p>
      {customized ? (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted transition hover:bg-[var(--glass-border)] hover:text-text-primary"
        >
          <RotateCcw className="h-3 w-3" />
          Reset to Default
        </button>
      ) : null}
    </div>
  )
}

function NavSection({
  section,
  items,
  customized,
  draggedItem,
  dropTarget,
  onReset,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  section: SidebarSectionKey
  items: NavItem[]
  customized: boolean
  draggedItem: DraggedItem | null
  dropTarget: DropTarget | null
  onReset: () => void
  onDragStart: (section: SidebarSectionKey, href: string, event: DragEvent<HTMLDivElement>) => void
  onDragOver: (section: SidebarSectionKey, href: string, event: DragEvent<HTMLDivElement>) => void
  onDrop: (section: SidebarSectionKey, href: string, event: DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
}) {
  const pathname = usePathname()

  return (
    <div className="mb-3">
      <SectionHeader label={SECTION_LABELS[section]} customized={customized} onReset={onReset} />

      <div className="space-y-1">
        {items.map((item) => {
          const isActive = pathname === item.href
          const isDragging = draggedItem?.section === section && draggedItem.href === item.href
          const isDropBefore =
            dropTarget?.section === section &&
            dropTarget.href === item.href &&
            dropTarget.position === 'before'
          const isDropAfter =
            dropTarget?.section === section &&
            dropTarget.href === item.href &&
            dropTarget.position === 'after'

          return (
            <div
              key={item.href}
              draggable
              onDragStart={(event) => onDragStart(section, item.href, event)}
              onDragOver={(event) => onDragOver(section, item.href, event)}
              onDrop={(event) => onDrop(section, item.href, event)}
              onDragEnd={onDragEnd}
              className={cn(
                'group/item relative transition-all duration-200',
                isDragging && 'scale-[0.985] opacity-45'
              )}
            >
              {isDropBefore ? (
                <div className="absolute left-3 right-3 top-0 z-10 h-[2px] rounded-full bg-[var(--accent-primary,#3b82f6)] shadow-[0_0_12px_rgba(59,130,246,0.45)]" />
              ) : null}

              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-[10px] px-3 py-[7px] text-[13px] font-medium transition-all duration-200',
                  isActive
                    ? 'bg-[var(--accent-primary,#3b82f6)]/10 text-[var(--text-primary)] shadow-[inset_0_0_0_1px_var(--glass-border)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--glass-border)] hover:text-[var(--text-primary)]',
                  dropTarget?.section === section && dropTarget.href === item.href && !isActive && 'bg-white/[0.05]'
                )}
              >
                <span className="flex w-3 shrink-0 justify-center text-text-muted/60 opacity-0 transition-opacity duration-150 group-hover/item:opacity-100">
                  <GripVertical className="h-3.5 w-3.5" />
                </span>
                <item.icon
                  className={cn(
                    'h-[18px] w-[18px]',
                    isActive ? 'text-[var(--accent-primary,#3b82f6)]' : 'text-[var(--text-muted)]'
                  )}
                />
                <span>{item.name}</span>
              </Link>

              {isDropAfter ? (
                <div className="absolute left-3 right-3 bottom-0 z-10 h-[2px] rounded-full bg-[var(--accent-primary,#3b82f6)] shadow-[0_0_12px_rgba(59,130,246,0.45)]" />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Sidebar() {
  const [status, setStatus] = useState<{ connected: boolean; mode: string; model: string }>({
    connected: false,
    mode: 'unknown',
    model: '',
  })
  const [settings, setSettings] = useState<Settings | null>(null)
  const [sidebarOrder, setSidebarOrder] = useState<SidebarOrder>({})
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const dragGhostRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    fetch('/api/mode')
      .then((response) => response.json())
      .then((data) => {
        setStatus({
          connected: data.connected,
          mode: data.mode || 'unknown',
          model: data.currentModel?.split('/').pop() || '',
        })
      })
      .catch(() => {})

    fetch('/api/settings', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (data?.settings) {
          setSettings(data.settings as Settings)
          setSidebarOrder((data.settings as Settings).sidebarOrder || {})
        }
      })
      .catch(() => {})

    const interval = setInterval(() => {
      fetch('/api/mode')
        .then((response) => response.json())
        .then((data) => {
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
    if (!message) return

    const timeout = setTimeout(() => setMessage(null), 2600)
    return () => clearTimeout(timeout)
  }, [message])

  const orderedSections = useMemo(
    () => ({
      main: orderItems('main', sidebarOrder.main),
      monitor: orderItems('monitor', sidebarOrder.monitor),
      workspace: orderItems('workspace', sidebarOrder.workspace),
    }),
    [sidebarOrder]
  )

  const customizedSections = useMemo(
    () => ({
      main: !arraysEqual(orderedSections.main.map((item) => item.href), DEFAULT_SECTION_ORDER.main),
      monitor: !arraysEqual(orderedSections.monitor.map((item) => item.href), DEFAULT_SECTION_ORDER.monitor),
      workspace: !arraysEqual(orderedSections.workspace.map((item) => item.href), DEFAULT_SECTION_ORDER.workspace),
    }),
    [orderedSections]
  )

  const modeColors: Record<string, string> = {
    best: 'bg-amber-400',
    standard: 'bg-sky-400',
    budget: 'bg-emerald-400',
    auto: 'bg-violet-400',
  }

  async function persistSidebarOrder(nextOrder: SidebarOrder, previousOrder: SidebarOrder) {
    try {
      const response = await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(settings || {}),
          sidebarOrder: nextOrder,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not save sidebar order.')
      }

      setSettings(payload.settings as Settings)
      setSidebarOrder((payload.settings as Settings).sidebarOrder || {})
      setMessage({ tone: 'success', text: 'Sidebar order saved.' })
    } catch (error) {
      setSidebarOrder(previousOrder)
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not save sidebar order.',
      })
    }
  }

  function resetSection(section: SidebarSectionKey) {
    const previousOrder = sidebarOrder
    const nextOrder = { ...sidebarOrder }
    delete nextOrder[section]
    setSidebarOrder(nextOrder)
    void persistSidebarOrder(nextOrder, previousOrder)
  }

  function handleDragStart(section: SidebarSectionKey, href: string, event: DragEvent<HTMLDivElement>) {
    setDraggedItem({ section, href })
    setDropTarget(null)

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', `${section}:${href}`)

    const ghost = buildDragGhost(event.currentTarget)
    dragGhostRef.current = ghost
    event.dataTransfer.setDragImage(ghost, 20, 20)
  }

  function handleDragOver(section: SidebarSectionKey, href: string, event: DragEvent<HTMLDivElement>) {
    if (!draggedItem || draggedItem.section !== section || draggedItem.href === href) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    const bounds = event.currentTarget.getBoundingClientRect()
    const midpoint = bounds.top + bounds.height / 2
    const position = event.clientY < midpoint ? 'before' : 'after'

    setDropTarget({ section, href, position })
  }

  function handleDrop(section: SidebarSectionKey, href: string, event: DragEvent<HTMLDivElement>) {
    event.preventDefault()

    if (!draggedItem || draggedItem.section !== section) {
      setDropTarget(null)
      return
    }

    const currentOrder = orderedSections[section].map((item) => item.href)
    const withoutDragged = currentOrder.filter((value) => value !== draggedItem.href)
    const targetIndex = withoutDragged.indexOf(href)

    if (targetIndex === -1) {
      setDraggedItem(null)
      setDropTarget(null)
      return
    }

    const position = dropTarget?.section === section && dropTarget.href === href
      ? dropTarget.position
      : 'before'
    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1
    const nextSectionOrder = insertAt(withoutDragged, insertIndex, draggedItem.href)

    if (arraysEqual(nextSectionOrder, currentOrder)) {
      setDraggedItem(null)
      setDropTarget(null)
      return
    }

    const previousOrder = sidebarOrder
    const nextOrder: SidebarOrder = {
      ...sidebarOrder,
      [section]: nextSectionOrder,
    }

    setSidebarOrder(nextOrder)
    setDraggedItem(null)
    setDropTarget(null)
    void persistSidebarOrder(nextOrder, previousOrder)
  }

  function handleDragEnd() {
    setDraggedItem(null)
    setDropTarget(null)

    if (dragGhostRef.current) {
      dragGhostRef.current.remove()
      dragGhostRef.current = null
    }
  }

  return (
    <aside className="glass-sidebar flex w-64 flex-col">
      <div className="electron-drag p-5 pb-4">
        <div className="electron-no-drag flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-zinc-600 to-zinc-700 shadow-lg shadow-black/20">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-text-primary">Mission Control</h1>
            <div className="mt-0.5 flex items-center gap-1.5">
              <div
                className={cn(
                  'h-[6px] w-[6px] rounded-full',
                  status.connected ? modeColors[status.mode] || 'bg-emerald-400' : 'bg-red-400'
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
        <NavSection
          section="main"
          items={orderedSections.main}
          customized={customizedSections.main}
          draggedItem={draggedItem}
          dropTarget={dropTarget}
          onReset={() => resetSection('main')}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        />
        <NavSection
          section="monitor"
          items={orderedSections.monitor}
          customized={customizedSections.monitor}
          draggedItem={draggedItem}
          dropTarget={dropTarget}
          onReset={() => resetSection('monitor')}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        />
        <NavSection
          section="workspace"
          items={orderedSections.workspace}
          customized={customizedSections.workspace}
          draggedItem={draggedItem}
          dropTarget={dropTarget}
          onReset={() => resetSection('workspace')}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        />
      </nav>

      <div className="border-t border-[var(--glass-border)] p-4">
        {message ? (
          <div
            className={cn(
              'mb-3 rounded-xl border px-3 py-2 text-xs',
              message.tone === 'success'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/20 bg-red-500/10 text-red-200'
            )}
          >
            {message.text}
          </div>
        ) : null}

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
    </aside>
  )
}

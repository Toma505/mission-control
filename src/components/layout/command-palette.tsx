'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Calendar,
  Clapperboard,
  Clock,
  Database,
  DollarSign,
  FileBarChart,
  FileText,
  GitBranch,
  Info,
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
  Loader2,
  Package,
  PlayCircle,
  Plug,
  Rocket,
  Search,
  Settings,
  Shield,
  Sparkles,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react'

import { apiFetch } from '@/lib/api-client'
import { formatUpdaterMessage } from '@/lib/updater-status'
import { OPEN_DIAGNOSTICS_EVENT, OPEN_PREFERENCES_EVENT } from './desktop-events'

type ElectronAPI = {
  updaterCheck?: () => Promise<{ status: string; info?: { version?: string } | null; error?: string | null }>
  quit?: () => Promise<{ ok: boolean }>
}

type ApiSearchResult = {
  id: string
  title: string
  subtitle: string
  href: string
}

type ApiSearchGroup = {
  id: string
  label: string
  href: string
  total: number
  results: ApiSearchResult[]
}

type StaticItem = {
  id: string
  title: string
  subtitle?: string
  href?: string
  icon: ReactNode
  keywords: string[]
  kind: 'page' | 'action'
  onSelect?: () => void | string | Promise<void | string>
  keepOpen?: boolean
}

type DisplayResult = {
  id: string
  title: string
  subtitle?: string
  href?: string
  icon: ReactNode
  kind: 'page' | 'action' | 'search'
  onSelect?: () => void | string | Promise<void | string>
  keepOpen?: boolean
}

type DisplayGroup = {
  id: string
  label: string
  total: number
  href?: string
  results: DisplayResult[]
}

const PAGE_ITEMS: StaticItem[] = [
  { id: 'dashboard', title: 'Dashboard', subtitle: 'System overview', href: '/', icon: <LayoutDashboard className="h-4 w-4" />, kind: 'page', keywords: ['home', 'overview', 'status'] },
  { id: 'operations', title: 'Operations', subtitle: 'Pipeline jobs and automation', href: '/operations', icon: <Clapperboard className="h-4 w-4" />, kind: 'page', keywords: ['jobs', 'pipeline', 'automation'] },
  { id: 'agents', title: 'Agents', subtitle: 'Agent management', href: '/agents', icon: <Users className="h-4 w-4" />, kind: 'page', keywords: ['bot', 'agent', 'sessions', 'model'] },
  { id: 'agent-chat', title: 'Agent-to-Agent Chat', subtitle: 'Let two agents collaborate on a shared goal', href: '/agent-chat', icon: <Bot className="h-4 w-4" />, kind: 'page', keywords: ['agent chat', 'collaboration', 'conversation', 'multi-agent'] },
  { id: 'replay', title: 'Agent Replay', subtitle: 'Replay completed runs step by step', href: '/replay', icon: <PlayCircle className="h-4 w-4" />, kind: 'page', keywords: ['replay', 'session', 'history', 'timeline', 'diff'] },
  { id: 'costs', title: 'Cost Dashboard', subtitle: 'Real-time token spend, budgets, and session costs', href: '/costs', icon: <DollarSign className="h-4 w-4" />, kind: 'page', keywords: ['cost dashboard', 'billing', 'spend', 'budget', 'tokens'] },
  { id: 'analytics', title: 'Usage Analytics', subtitle: 'Token usage, model costs, anomaly detection', href: '/analytics', icon: <BarChart3 className="h-4 w-4" />, kind: 'page', keywords: ['analytics', 'tokens', 'usage', 'models'] },
  { id: 'api-usage', title: 'API Usage', subtitle: 'Token consumption', href: '/api-usage', icon: <BarChart3 className="h-4 w-4" />, kind: 'page', keywords: ['api usage', 'tokens', 'openrouter', 'anthropic'] },
  { id: 'extensions', title: 'Extensions', subtitle: 'Installed tools, marketplace, and upload scanner', href: '/extensions', icon: <Package className="h-4 w-4" />, kind: 'page', keywords: ['extensions', 'plugins', 'skills', 'marketplace'] },
  { id: 'orchestrate', title: 'Orchestrate', subtitle: 'Multi-agent orchestration workflows', href: '/orchestrate', icon: <GitBranch className="h-4 w-4" />, kind: 'page', keywords: ['orchestrate', 'workflow', 'fan-out', 'consensus'] },
  { id: 'templates', title: 'Agent Templates', subtitle: 'Deploy reusable agent setups and custom roles', href: '/templates', icon: <LayoutTemplate className="h-4 w-4" />, kind: 'page', keywords: ['templates', 'agent templates', 'deploy', 'roles'] },
  { id: 'notifications', title: 'Notifications', subtitle: 'Desktop alerts and notification history', href: '/notifications', icon: <Bell className="h-4 w-4" />, kind: 'page', keywords: ['notifications', 'alerts', 'bell', 'badge'] },
  { id: 'journal', title: 'Journal', subtitle: 'Activity logs', href: '/journal', icon: <BookOpen className="h-4 w-4" />, kind: 'page', keywords: ['journal', 'logs', 'activity', 'history'] },
  { id: 'documents', title: 'Documents', subtitle: 'Workspace files', href: '/documents', icon: <FileText className="h-4 w-4" />, kind: 'page', keywords: ['documents', 'files', 'workspace'] },
  { id: 'intelligence', title: 'Intelligence', subtitle: 'Agent memory', href: '/intelligence', icon: <Brain className="h-4 w-4" />, kind: 'page', keywords: ['intelligence', 'memory', 'context'] },
  { id: 'knowledge', title: 'Knowledge Base', subtitle: 'Local file indexing, search, and agent context attachments', href: '/knowledge', icon: <Database className="h-4 w-4" />, kind: 'page', keywords: ['knowledge', 'knowledge base', 'pdf', 'index', 'search'] },
  { id: 'workshop', title: 'Workshop', subtitle: 'Active sessions', href: '/workshop', icon: <Wrench className="h-4 w-4" />, kind: 'page', keywords: ['workshop', 'sessions', 'tasks'] },
  { id: 'clients', title: 'Clients', subtitle: 'Integrations', href: '/clients', icon: <Briefcase className="h-4 w-4" />, kind: 'page', keywords: ['clients', 'discord', 'channels', 'integrations'] },
  { id: 'schedules', title: 'Scheduled Tasks', subtitle: 'Recurring prompts and command runs', href: '/schedules', icon: <Clock className="h-4 w-4" />, kind: 'page', keywords: ['schedules', 'scheduled tasks', 'cron', 'timer'] },
  { id: 'weekly-recaps', title: 'Weekly Recaps', subtitle: 'Activity summaries', href: '/weekly-recaps', icon: <Calendar className="h-4 w-4" />, kind: 'page', keywords: ['weekly recap', 'summary', 'weekly'] },
  { id: 'webhooks', title: 'Webhooks', subtitle: 'Slack, Discord, and HTTP integrations', href: '/webhooks', icon: <Plug className="h-4 w-4" />, kind: 'page', keywords: ['webhooks', 'slack', 'discord', 'integration'] },
  { id: 'snapshots', title: 'Config Snapshots', subtitle: 'Save and restore configurations', href: '/snapshots', icon: <Shield className="h-4 w-4" />, kind: 'page', keywords: ['snapshots', 'config', 'restore'] },
  { id: 'backup', title: 'Backup & Restore', subtitle: 'Export or import data', href: '/backup', icon: <Shield className="h-4 w-4" />, kind: 'page', keywords: ['backup', 'restore', 'export', 'import'] },
  { id: 'presets', title: 'Model Presets', subtitle: 'One-click model configurations', href: '/presets', icon: <Rocket className="h-4 w-4" />, kind: 'page', keywords: ['presets', 'model', 'quality', 'fast', 'cheap'] },
  { id: 'prompts', title: 'Prompt Library', subtitle: 'Save and reuse system prompts', href: '/prompts', icon: <BookOpen className="h-4 w-4" />, kind: 'page', keywords: ['prompts', 'library', 'system', 'instruction'] },
  { id: 'cost-tags', title: 'Cost Allocation', subtitle: 'Tag sessions by project or client', href: '/cost-tags', icon: <Users className="h-4 w-4" />, kind: 'page', keywords: ['cost tags', 'project', 'client', 'allocation'] },
  { id: 'vault', title: 'API Key Vault', subtitle: 'Manage and rotate API keys', href: '/vault', icon: <KeyRound className="h-4 w-4" />, kind: 'page', keywords: ['key vault', 'api', 'secret', 'rotate'] },
  { id: 'benchmarks', title: 'Model Benchmarks', subtitle: 'Compare model cost efficiency', href: '/benchmarks', icon: <BarChart3 className="h-4 w-4" />, kind: 'page', keywords: ['benchmarks', 'compare', 'efficiency'] },
  { id: 'reports', title: 'Reports', subtitle: 'Build PDF, CSV, and JSON exports with preview', href: '/reports', icon: <FileBarChart className="h-4 w-4" />, kind: 'page', keywords: ['reports', 'pdf', 'csv', 'json', 'preview'] },
  { id: 'changelog', title: 'Changelog', subtitle: 'Release history and shipped improvements', href: '/changelog', icon: <Sparkles className="h-4 w-4" />, kind: 'page', keywords: ['changelog', 'release', 'update', 'whats new', 'version'] },
  { id: 'themes', title: 'Theme Engine', subtitle: 'Preview and apply app themes', href: '/settings/themes', icon: <Settings className="h-4 w-4" />, kind: 'page', keywords: ['theme', 'appearance', 'light', 'dark', 'midnight'] },
  { id: 'shortcuts', title: 'Keyboard Shortcuts', subtitle: 'Customize key bindings', href: '/settings/shortcuts', icon: <Settings className="h-4 w-4" />, kind: 'page', keywords: ['keyboard', 'shortcut', 'hotkey', 'remap'] },
]

function makeActionItems(
  router: ReturnType<typeof useRouter>,
  getElectronAPI: () => ElectronAPI | undefined,
): StaticItem[] {
  async function switchMode(mode: 'best' | 'budget' | 'auto') {
    const response = await apiFetch('/api/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Mode switch failed' }))
      throw new Error(error.error || 'Mode switch failed')
    }

    router.push('/costs')
    router.refresh()
  }

  return [
    {
      id: 'switch-best',
      title: 'Switch to Best Mode',
      subtitle: 'Apply premium quality mode now',
      icon: <Shield className="h-4 w-4 text-amber-400" />,
      kind: 'action',
      keywords: ['mode', 'best', 'opus', 'premium'],
      onSelect: () => switchMode('best'),
    },
    {
      id: 'switch-budget',
      title: 'Switch to Budget Mode',
      subtitle: 'Apply lower-cost routing now',
      icon: <DollarSign className="h-4 w-4 text-emerald-400" />,
      kind: 'action',
      keywords: ['mode', 'budget', 'cheap', 'save'],
      onSelect: () => switchMode('budget'),
    },
    {
      id: 'switch-auto',
      title: 'Switch to Auto Mode',
      subtitle: 'Apply smart task-based routing now',
      icon: <Brain className="h-4 w-4 text-violet-400" />,
      kind: 'action',
      keywords: ['mode', 'auto', 'smart', 'routing'],
      onSelect: () => switchMode('auto'),
    },
    {
      id: 'preferences',
      title: 'Preferences',
      subtitle: 'Open settings',
      icon: <Settings className="h-4 w-4" />,
      kind: 'action',
      keywords: ['settings', 'preferences', 'config', 'options'],
      onSelect: () => {
        window.dispatchEvent(new CustomEvent(OPEN_PREFERENCES_EVENT))
      },
    },
    {
      id: 'connection-settings',
      title: 'Connection Settings',
      subtitle: 'Update your OpenClaw URL, password, and API key',
      icon: <Plug className="h-4 w-4 text-sky-400" />,
      kind: 'action',
      keywords: ['connection', 'setup', 'openclaw', 'credentials', 'url'],
      onSelect: () => {
        router.push('/setup?reconfigure=true')
      },
    },
    {
      id: 'license',
      title: 'License',
      subtitle: 'Open activation and license details',
      icon: <KeyRound className="h-4 w-4 text-emerald-400" />,
      kind: 'action',
      keywords: ['license', 'activate', 'key', 'billing'],
      onSelect: () => {
        router.push('/activate')
      },
    },
    {
      id: 'about-diagnostics',
      title: 'About & Diagnostics',
      subtitle: 'Open desktop version info and support tools',
      icon: <Info className="h-4 w-4 text-violet-400" />,
      kind: 'action',
      keywords: ['diagnostics', 'about', 'support', 'version', 'logs'],
      onSelect: () => {
        window.dispatchEvent(new CustomEvent(OPEN_DIAGNOSTICS_EVENT))
      },
    },
    {
      id: 'check-updates',
      title: 'Check for Updates',
      subtitle: 'Look for a newer Mission Control desktop build',
      icon: <Rocket className="h-4 w-4 text-amber-400" />,
      kind: 'action',
      keywords: ['update', 'upgrade', 'release', 'version'],
      keepOpen: true,
      onSelect: async () => {
        const electronAPI = getElectronAPI()
        if (!electronAPI?.updaterCheck) {
          return 'Update checks are only available in the desktop app.'
        }

        const result = await electronAPI.updaterCheck()
        return formatUpdaterMessage(result) || 'Update check started.'
      },
    },
    {
      id: 'quit',
      title: 'Quit Mission Control',
      subtitle: 'Fully close the desktop app',
      icon: <XCircle className="h-4 w-4 text-red-400" />,
      kind: 'action',
      keywords: ['quit', 'exit', 'close', 'tray'],
      onSelect: async () => {
        const electronAPI = getElectronAPI()
        if (!electronAPI?.quit) {
          return 'Quit is only available in the desktop app.'
        }

        await electronAPI.quit()
      },
    },
  ]
}

function matchesQuery(item: StaticItem, query: string) {
  const needle = query.toLowerCase()
  return (
    item.title.toLowerCase().includes(needle) ||
    item.subtitle?.toLowerCase().includes(needle) ||
    item.keywords.some((keyword) => keyword.toLowerCase().includes(needle))
  )
}

function resultIcon(groupId: string) {
  switch (groupId) {
    case 'prompts':
      return <BookOpen className="h-4 w-4" />
    case 'templates':
      return <LayoutTemplate className="h-4 w-4" />
    case 'replays':
      return <PlayCircle className="h-4 w-4" />
    case 'knowledge':
      return <Database className="h-4 w-4" />
    case 'changelog':
      return <Sparkles className="h-4 w-4" />
    case 'schedules':
      return <Clock className="h-4 w-4" />
    default:
      return <Search className="h-4 w-4" />
  }
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [remoteGroups, setRemoteGroups] = useState<ApiSearchGroup[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const getElectronAPI = useCallback(() => {
    return typeof window !== 'undefined'
      ? (window as Window & { electronAPI?: ElectronAPI }).electronAPI
      : undefined
  }, [])

  const actionItems = useMemo(() => makeActionItems(router, getElectronAPI), [getElectronAPI, router])

  useEffect(() => {
    if (!open) return
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [open, query])

  useEffect(() => {
    if (!open || !debouncedQuery) {
      setRemoteGroups([])
      setSearchLoading(false)
      return
    }

    const controller = new AbortController()
    setSearchLoading(true)

    void fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload) => {
        if (!controller.signal.aborted) {
          setRemoteGroups(Array.isArray(payload.groups) ? payload.groups : [])
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setRemoteGroups([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearchLoading(false)
      })

    return () => controller.abort()
  }, [debouncedQuery, open])

  const displayGroups = useMemo<DisplayGroup[]>(() => {
    if (!query.trim()) {
      return [
        {
          id: 'pages',
          label: 'Pages',
          total: PAGE_ITEMS.length,
          results: PAGE_ITEMS.map((item) => ({
            id: item.id,
            title: item.title,
            subtitle: item.subtitle,
            href: item.href,
            icon: item.icon,
            kind: item.kind,
          })),
        },
      ]
    }

    const groups: DisplayGroup[] = []
    const pageResults = PAGE_ITEMS
      .filter((item) => matchesQuery(item, query))
      .map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        href: item.href,
        icon: item.icon,
        kind: item.kind,
      } satisfies DisplayResult))

    if (pageResults.length > 0) {
      groups.push({
        id: 'pages',
        label: 'Pages',
        total: pageResults.length,
        results: pageResults,
      })
    }

    const matchedActions = actionItems
      .filter((item) => matchesQuery(item, query))
      .map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        href: item.href,
        icon: item.icon,
        kind: item.kind,
        onSelect: item.onSelect,
        keepOpen: item.keepOpen,
      } satisfies DisplayResult))

    if (matchedActions.length > 0) {
      groups.push({
        id: 'actions',
        label: 'Actions',
        total: matchedActions.length,
        results: matchedActions,
      })
    }

    for (const group of remoteGroups) {
      if (!Array.isArray(group.results) || group.results.length === 0) continue
      groups.push({
        id: group.id,
        label: group.label,
        total: group.total,
        href: group.href,
        results: group.results.map((result) => ({
          id: `${group.id}:${result.id}`,
          title: result.title,
          subtitle: result.subtitle,
          href: result.href,
          icon: resultIcon(group.id),
          kind: 'search',
        })),
      })
    }

    return groups
  }, [actionItems, query, remoteGroups])

  const indexedGroups = useMemo(() => {
    let flatIndex = 0

    return displayGroups.map((group) => {
      const visibleCount = expandedGroups[group.id] ? group.results.length : Math.min(group.results.length, 5)
      const visibleResults = group.results.slice(0, visibleCount).map((result) => ({
        ...result,
        flatIndex: flatIndex++,
      }))

      return {
        ...group,
        visibleResults,
      }
    })
  }, [displayGroups, expandedGroups])

  const flatResults = useMemo(
    () => indexedGroups.flatMap((group) => group.visibleResults),
    [indexedGroups],
  )

  useEffect(() => {
    setSelectedIndex(0)
    setExpandedGroups({})
  }, [query])

  useEffect(() => {
    if (selectedIndex >= flatResults.length) {
      setSelectedIndex(Math.max(flatResults.length - 1, 0))
    }
  }, [flatResults.length, selectedIndex])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault()
      setOpen((previous) => !previous)
      setQuery('')
      setDebouncedQuery('')
      setRemoteGroups([])
      setSelectedIndex(0)
      setExpandedGroups({})
      setStatusMessage(null)
    }

    if (event.key === 'Escape') {
      setOpen(false)
      setStatusMessage(null)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  async function navigate(item: DisplayResult) {
    setStatusMessage(null)

    try {
      let result: void | string | undefined
      if (item.onSelect) {
        setBusyItemId(item.id)
        result = await item.onSelect()
      } else if (item.href) {
        router.push(item.href)
      }

      if (item.keepOpen) {
        if (result) setStatusMessage({ tone: 'info', text: result })
        return
      }

      if (result) setStatusMessage({ tone: 'info', text: result })
      setOpen(false)
      setQuery('')
      setRemoteGroups([])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed.'
      setStatusMessage({ tone: 'error', text: message })
    } finally {
      setBusyItemId(null)
    }
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((index) => Math.min(index + 1, Math.max(flatResults.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && flatResults[selectedIndex]) {
      void navigate(flatResults[selectedIndex])
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      <div className="relative mx-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--background-card)]/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-[var(--glass-border)] px-4 py-3">
          {busyItemId || searchLoading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-text-muted" />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-text-muted" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search pages, prompts, templates, sessions, and more..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
          />
          {query.trim() ? (
            <span className="rounded-full border border-[var(--glass-border)] bg-white/[0.05] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
              Search Everything
            </span>
          ) : null}
          <kbd className="rounded border border-[var(--glass-border)] bg-[var(--glass-bg)] px-1.5 py-0.5 text-[10px] font-medium text-text-muted/60">
            ESC
          </kbd>
        </div>

        {statusMessage ? (
          <div
            className={`flex items-start gap-2 border-b px-4 py-2.5 text-[11px] ${
              statusMessage.tone === 'error'
                ? 'border-red-500/20 bg-red-500/10 text-red-100'
                : 'border-sky-500/20 bg-sky-500/10 text-sky-100'
            }`}
          >
            {statusMessage.tone === 'error' ? (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300" />
            ) : (
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        ) : null}

        <div className="max-h-[28rem] overflow-y-auto py-2">
          {indexedGroups.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-text-muted">
                {query.trim() ? `No results for "${query}"` : 'Start typing to search.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {indexedGroups.map((group) => (
                <div key={group.id} className="pb-2">
                  <div className="flex items-center justify-between px-4 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                      {group.label}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-text-muted/70">{group.total} results</span>
                      {group.results.length > 5 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedGroups((current) => ({
                              ...current,
                              [group.id]: !current[group.id],
                            }))
                          }
                          className="text-[11px] font-medium text-accent-primary transition hover:brightness-110"
                        >
                          {expandedGroups[group.id] ? 'Show less' : 'Show all'}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {group.visibleResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void navigate(item)}
                      onMouseEnter={() => setSelectedIndex(item.flatIndex)}
                      disabled={busyItemId !== null}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        item.flatIndex === selectedIndex ? 'bg-[var(--glass-bg)]' : 'hover:bg-[var(--glass-bg)]'
                      } ${busyItemId === item.id ? 'opacity-60' : ''}`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--glass-bg)] text-text-muted">
                        {item.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary">{item.title}</p>
                        {item.subtitle ? (
                          <p className="truncate text-xs text-text-muted">{item.subtitle}</p>
                        ) : null}
                      </div>
                      {item.kind === 'action' ? (
                        <span className="rounded bg-violet-400/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
                          {busyItemId === item.id ? 'Working' : 'Action'}
                        </span>
                      ) : null}
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-muted/30" />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-[var(--glass-border)] px-4 py-2 text-[10px] text-text-muted/50">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--glass-border)] bg-[var(--glass-bg)] px-1 py-0.5">Up/Down</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--glass-border)] bg-[var(--glass-bg)] px-1 py-0.5">Enter</kbd>
            Open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--glass-border)] bg-[var(--glass-bg)] px-1 py-0.5">Esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  )
}

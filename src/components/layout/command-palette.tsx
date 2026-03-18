'use client'

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Search,
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
  ArrowRight,
  Settings,
  Info,
  KeyRound,
  Loader2,
  Plug,
  Rocket,
  XCircle,
} from 'lucide-react'
import { OPEN_DIAGNOSTICS_EVENT, OPEN_PREFERENCES_EVENT } from './desktop-events'

type ElectronAPI = {
  updaterCheck?: () => Promise<{ status: string; info?: { version?: string } | null; error?: string | null }>
  quit?: () => Promise<{ ok: boolean }>
}

interface SearchItem {
  id: string
  title: string
  subtitle?: string
  href?: string
  icon: ReactNode
  category: 'page' | 'action' | 'agent'
  keywords: string[]
  onSelect?: () => void | string | Promise<void | string>
  keepOpen?: boolean
}

const PAGE_ITEMS: SearchItem[] = [
  { id: 'dashboard', title: 'Dashboard', subtitle: 'System overview', href: '/', icon: <LayoutDashboard className="w-4 h-4" />, category: 'page', keywords: ['home', 'overview', 'status'] },
  { id: 'operations', title: 'Operations', subtitle: 'Pipeline jobs and automation', href: '/operations', icon: <Clapperboard className="w-4 h-4" />, category: 'page', keywords: ['jobs', 'pipeline', 'real estate', 'video', 'automation'] },
  { id: 'agents', title: 'Agents', subtitle: 'Agent management', href: '/agents', icon: <Users className="w-4 h-4" />, category: 'page', keywords: ['bot', 'agent', 'sessions', 'model'] },
  { id: 'costs', title: 'Costs', subtitle: 'Infrastructure and spend', href: '/costs', icon: <DollarSign className="w-4 h-4" />, category: 'page', keywords: ['money', 'billing', 'railway', 'credits', 'spend'] },
  { id: 'api-usage', title: 'API Usage', subtitle: 'Token consumption', href: '/api-usage', icon: <BarChart3 className="w-4 h-4" />, category: 'page', keywords: ['tokens', 'openrouter', 'anthropic', 'usage'] },
  { id: 'skills', title: 'Skills', subtitle: 'Plugin security scanner', href: '/skills', icon: <Shield className="w-4 h-4" />, category: 'page', keywords: ['plugins', 'install', 'scan'] },
  { id: 'journal', title: 'Journal', subtitle: 'Activity logs', href: '/journal', icon: <BookOpen className="w-4 h-4" />, category: 'page', keywords: ['logs', 'activity', 'history'] },
  { id: 'documents', title: 'Documents', subtitle: 'Workspace files', href: '/documents', icon: <FileText className="w-4 h-4" />, category: 'page', keywords: ['files', 'workspace', 'memory'] },
  { id: 'intelligence', title: 'Intelligence', subtitle: 'Agent memory', href: '/intelligence', icon: <Brain className="w-4 h-4" />, category: 'page', keywords: ['memory', 'knowledge', 'context'] },
  { id: 'workshop', title: 'Workshop', subtitle: 'Active sessions', href: '/workshop', icon: <Wrench className="w-4 h-4" />, category: 'page', keywords: ['sessions', 'tasks', 'work'] },
  { id: 'clients', title: 'Clients', subtitle: 'Integrations', href: '/clients', icon: <Briefcase className="w-4 h-4" />, category: 'page', keywords: ['discord', 'channels', 'integrations'] },
  { id: 'cron-jobs', title: 'Cron Jobs', subtitle: 'Scheduled tasks', href: '/cron-jobs', icon: <Clock className="w-4 h-4" />, category: 'page', keywords: ['schedule', 'cron', 'timer', 'automated'] },
  { id: 'weekly-recaps', title: 'Weekly Recaps', subtitle: 'Activity summaries', href: '/weekly-recaps', icon: <Calendar className="w-4 h-4" />, category: 'page', keywords: ['recap', 'summary', 'weekly'] },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function getElectronAPI() {
    return typeof window !== 'undefined'
      ? (window as Window & { electronAPI?: ElectronAPI }).electronAPI
      : undefined
  }

  function formatUpdateMessage(result?: { status: string; info?: { version?: string } | null; error?: string | null } | null) {
    switch (result?.status) {
      case 'checking':
        return 'Checking for updates...'
      case 'available':
        return result.info?.version ? `Update ${result.info.version} is available.` : 'An update is available.'
      case 'up-to-date':
        return 'Mission Control is up to date.'
      case 'downloaded':
        return 'Update downloaded. Restart Mission Control to install it.'
      case 'dev':
        return result.error || 'Updates are disabled in development mode.'
      case 'error':
        return result.error || 'Update check failed.'
      default:
        return 'Update check started.'
    }
  }

  async function switchMode(mode: 'best' | 'budget' | 'auto') {
    const response = await fetch('/api/mode', {
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

  const searchItems: SearchItem[] = [
    ...PAGE_ITEMS,
    {
      id: 'switch-best',
      title: 'Switch to Best Mode',
      subtitle: 'Apply premium quality mode now',
      icon: <Shield className="w-4 h-4 text-amber-400" />,
      category: 'action',
      keywords: ['mode', 'best', 'opus', 'premium'],
      onSelect: () => switchMode('best'),
    },
    {
      id: 'switch-budget',
      title: 'Switch to Budget Mode',
      subtitle: 'Apply lower-cost routing now',
      icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
      category: 'action',
      keywords: ['mode', 'budget', 'cheap', 'save'],
      onSelect: () => switchMode('budget'),
    },
    {
      id: 'switch-auto',
      title: 'Switch to Auto Mode',
      subtitle: 'Apply smart task-based routing now',
      icon: <Brain className="w-4 h-4 text-violet-400" />,
      category: 'action',
      keywords: ['mode', 'auto', 'smart', 'routing'],
      onSelect: () => switchMode('auto'),
    },
    {
      id: 'preferences',
      title: 'Preferences',
      subtitle: 'Open settings',
      icon: <Settings className="w-4 h-4" />,
      category: 'action',
      keywords: ['settings', 'preferences', 'config', 'options'],
      onSelect: () => {
        window.dispatchEvent(new CustomEvent(OPEN_PREFERENCES_EVENT))
      },
    },
    {
      id: 'connection-settings',
      title: 'Connection Settings',
      subtitle: 'Update your OpenClaw URL, password, and API key',
      icon: <Plug className="w-4 h-4 text-sky-400" />,
      category: 'action',
      keywords: ['connection', 'setup', 'openclaw', 'credentials', 'url'],
      onSelect: () => {
        router.push('/setup?reconfigure=true')
      },
    },
    {
      id: 'license',
      title: 'License',
      subtitle: 'Open activation and license details',
      icon: <KeyRound className="w-4 h-4 text-emerald-400" />,
      category: 'action',
      keywords: ['license', 'activate', 'key', 'billing'],
      onSelect: () => {
        router.push('/activate')
      },
    },
    {
      id: 'about-diagnostics',
      title: 'About & Diagnostics',
      subtitle: 'Open desktop version info and support tools',
      icon: <Info className="w-4 h-4 text-violet-400" />,
      category: 'action',
      keywords: ['diagnostics', 'about', 'support', 'version', 'logs'],
      onSelect: () => {
        window.dispatchEvent(new CustomEvent(OPEN_DIAGNOSTICS_EVENT))
      },
    },
    {
      id: 'check-updates',
      title: 'Check for Updates',
      subtitle: 'Look for a newer Mission Control desktop build',
      icon: <Rocket className="w-4 h-4 text-amber-400" />,
      category: 'action',
      keywords: ['update', 'upgrade', 'release', 'version'],
      keepOpen: true,
      onSelect: async () => {
        const electronAPI = getElectronAPI()
        if (!electronAPI?.updaterCheck) {
          return 'Update checks are only available in the desktop app.'
        }

        const result = await electronAPI.updaterCheck()
        return formatUpdateMessage(result)
      },
    },
    {
      id: 'quit',
      title: 'Quit Mission Control',
      subtitle: 'Fully close the desktop app',
      icon: <XCircle className="w-4 h-4 text-red-400" />,
      category: 'action',
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

  const filtered = query.length === 0
    ? searchItems.filter(item => item.category === 'page')
    : searchItems.filter((item) => {
        const q = query.toLowerCase()
        return (
          item.title.toLowerCase().includes(q) ||
          item.subtitle?.toLowerCase().includes(q) ||
          item.keywords.some(keyword => keyword.includes(q))
        )
      })

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault()
      setOpen(prev => !prev)
      setQuery('')
      setSelectedIndex(0)
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
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  async function navigate(item: SearchItem) {
    setStatusMessage(null)

    try {
      let result: void | string | undefined = undefined
      if (item.onSelect) {
        setBusyItemId(item.id)
        result = await item.onSelect()
      } else if (item.href) {
        router.push(item.href)
      }

      if (item.keepOpen) {
        if (result) {
          setStatusMessage({ tone: 'info', text: result })
        }
        return
      }

      if (result) {
        setStatusMessage({ tone: 'info', text: result })
      }

      setOpen(false)
      setQuery('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed.'
      setStatusMessage({ tone: 'error', text: message })
    } finally {
      setBusyItemId(null)
    }
  }

  function handleInputKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex(index => Math.min(index + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex(index => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && filtered[selectedIndex]) {
      void navigate(filtered[selectedIndex])
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-white/[0.08] bg-[#1a1a1e]/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          {busyItemId ? <Loader2 className="w-4 h-4 text-text-muted shrink-0 animate-spin" /> : <Search className="w-4 h-4 text-text-muted shrink-0" />}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search pages, actions..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded text-[10px] font-medium text-text-muted/60 bg-white/[0.06] border border-white/[0.08]">
            ESC
          </kbd>
        </div>

        {statusMessage ? (
          <div className={`flex items-start gap-2 border-b px-4 py-2.5 text-[11px] ${
            statusMessage.tone === 'error'
              ? 'border-red-500/20 bg-red-500/10 text-red-100'
              : 'border-sky-500/20 bg-sky-500/10 text-sky-100'
          }`}>
            {statusMessage.tone === 'error'
              ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300" />
              : <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />}
            <span>{statusMessage.text}</span>
          </div>
        ) : null}

        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-text-muted">No results for "{query}"</p>
            </div>
          ) : (
            <>
              {filtered.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => void navigate(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  disabled={busyItemId !== null}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    index === selectedIndex ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                  } ${busyItemId === item.id ? 'opacity-60' : ''}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 text-text-muted">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{item.title}</p>
                    {item.subtitle && (
                      <p className="text-xs text-text-muted truncate">{item.subtitle}</p>
                    )}
                  </div>
                  {item.category === 'action' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-violet-400 bg-violet-400/10">
                      {busyItemId === item.id ? 'Working' : 'Action'}
                    </span>
                  )}
                  <ArrowRight className="w-3.5 h-3.5 text-text-muted/30 shrink-0" />
                </button>
              ))}
            </>
          )}
        </div>

        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-4 text-[10px] text-text-muted/50">
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">Up/Down</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">Enter</kbd> Open</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}

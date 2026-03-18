'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
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
  Command,
  Settings,
} from 'lucide-react'

interface SearchItem {
  id: string
  title: string
  subtitle?: string
  href?: string
  icon: React.ReactNode
  category: 'page' | 'action' | 'agent'
  keywords: string[]
  onSelect?: () => void
}

const SEARCH_ITEMS: SearchItem[] = [
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
  // Actions
  { id: 'switch-best', title: 'Switch to Best Mode', subtitle: 'Opus 4.6', href: '/costs', icon: <Shield className="w-4 h-4 text-amber-400" />, category: 'action', keywords: ['mode', 'best', 'opus', 'premium'] },
  { id: 'switch-budget', title: 'Switch to Budget Mode', subtitle: 'Deepseek v3 via OpenRouter', href: '/costs', icon: <DollarSign className="w-4 h-4 text-emerald-400" />, category: 'action', keywords: ['mode', 'budget', 'cheap', 'save'] },
  { id: 'switch-auto', title: 'Switch to Auto Mode', subtitle: 'Smart routing per task', href: '/costs', icon: <Brain className="w-4 h-4 text-violet-400" />, category: 'action', keywords: ['mode', 'auto', 'smart', 'routing'] },
  { id: 'preferences', title: 'Preferences', subtitle: 'Open settings', icon: <Settings className="w-4 h-4" />, category: 'action', keywords: ['settings', 'preferences', 'config', 'options'], onSelect: () => window.dispatchEvent(new CustomEvent('open-preferences')) },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const filtered = query.length === 0
    ? SEARCH_ITEMS.filter(i => i.category === 'page')
    : SEARCH_ITEMS.filter(item => {
        const q = query.toLowerCase()
        return (
          item.title.toLowerCase().includes(q) ||
          item.subtitle?.toLowerCase().includes(q) ||
          item.keywords.some(k => k.includes(q))
        )
      })

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setOpen(prev => !prev)
      setQuery('')
      setSelectedIndex(0)
    }
    if (e.key === 'Escape') {
      setOpen(false)
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

  function navigate(item: SearchItem) {
    if (item.onSelect) {
      item.onSelect()
    } else if (item.href) {
      router.push(item.href)
    }
    setOpen(false)
    setQuery('')
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      navigate(filtered[selectedIndex])
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Palette */}
      <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-white/[0.08] bg-[#1a1a1e]/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <Search className="w-4 h-4 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search pages, actions..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded text-[10px] font-medium text-text-muted/60 bg-white/[0.06] border border-white/[0.08]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-text-muted">No results for "{query}"</p>
            </div>
          ) : (
            <>
              {filtered.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === selectedIndex ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                  }`}
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
                      Action
                    </span>
                  )}
                  <ArrowRight className="w-3.5 h-3.5 text-text-muted/30 shrink-0" />
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-4 text-[10px] text-text-muted/50">
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">↵</kbd> Open</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import {
  Package,
  Search,
  Download,
  Trash2,
  RefreshCw,
  Star,
  Shield,
  DollarSign,
  Wrench,
  Plug,
  Code2,
  CheckCircle2,
  ArrowUpCircle,
  Loader2,
  ExternalLink,
  Filter,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'

interface MarketplacePlugin {
  id: string
  name: string
  description: string
  author: string
  version: string
  category: string
  downloads: number
  rating: number
  tags: string[]
  homepage?: string
  installed: boolean
  installedVersion?: string
  hasUpdate: boolean
}

interface PluginData {
  installed: { name: string; version: string; enabled: boolean }[]
  marketplace: MarketplacePlugin[]
  categories: string[]
}

const CATEGORY_ICONS: Record<string, typeof Shield> = {
  security: Shield,
  cost: DollarSign,
  ops: Wrench,
  integration: Plug,
  dev: Code2,
}

const CATEGORY_LABELS: Record<string, string> = {
  security: 'Security',
  cost: 'Cost',
  ops: 'Operations',
  integration: 'Integration',
  dev: 'Developer',
}

const CATEGORY_COLORS: Record<string, string> = {
  security: 'text-red-400 bg-red-400/10 border-red-400/20',
  cost: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  ops: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  integration: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  dev: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
}

function formatDownloads(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function PluginMarketplace() {
  const [data, setData] = useState<PluginData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [showInstalled, setShowInstalled] = useState(false)

  useEffect(() => {
    loadPlugins()
  }, [])

  useEffect(() => {
    if (!actionMessage) return
    const timer = setTimeout(() => setActionMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [actionMessage])

  async function loadPlugins() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/plugins', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError('Could not load plugins')
    } finally {
      setLoading(false)
    }
  }

  async function pluginAction(action: string, pluginId: string) {
    setActionInProgress(`${action}-${pluginId}`)
    setActionMessage(null)
    try {
      const res = await apiFetch('/api/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, pluginId }),
      })
      const result = await res.json()
      setActionMessage({ ok: result.ok, text: result.message })
      if (result.ok) await loadPlugins()
    } catch {
      setActionMessage({ ok: false, text: `Failed to ${action} plugin` })
    } finally {
      setActionInProgress(null)
    }
  }

  const filtered = data?.marketplace.filter(p => {
    if (showInstalled && !p.installed) return false
    if (activeCategory !== 'all' && p.category !== activeCategory) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.includes(q)) ||
        p.author.toLowerCase().includes(q)
      )
    }
    return true
  }) || []

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-accent-primary" />
          <h1 className="text-3xl font-bold text-text-primary">Plugins</h1>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-text-muted" />
        </div>
      </div>
    )
  }

  const installedCount = data?.marketplace.filter(p => p.installed).length ?? 0
  const updateCount = data?.marketplace.filter(p => p.hasUpdate).length ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-accent-primary" />
            <h1 className="text-3xl font-bold text-text-primary">Plugins</h1>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Browse, install, and manage OpenClaw plugins
          </p>
        </div>
        <div className="flex items-center gap-3">
          {installedCount > 0 && (
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
              {installedCount} installed
            </span>
          )}
          {updateCount > 0 && (
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">
              {updateCount} update{updateCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Action message toast */}
      {actionMessage && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
          actionMessage.ok
            ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-400'
            : 'border-red-400/20 bg-red-400/5 text-red-400'
        }`}>
          {actionMessage.ok ? <CheckCircle2 className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
          {actionMessage.text}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search plugins..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-primary/50"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowInstalled(!showInstalled)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              showInstalled
                ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20'
                : 'glass text-text-secondary hover:text-text-primary'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Installed
          </button>
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-accent-primary text-white'
                : 'glass text-text-secondary hover:text-text-primary'
            }`}
          >
            All
          </button>
          {(data?.categories || []).map(cat => {
            const Icon = CATEGORY_ICONS[cat] || Package
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat === activeCategory ? 'all' : cat)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-accent-primary text-white'
                    : 'glass text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {CATEGORY_LABELS[cat] || cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Plugin grid */}
      {error ? (
        <div className="glass rounded-2xl p-8 text-center">
          <Package className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary">{error}</p>
          <button
            onClick={loadPlugins}
            className="mt-3 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm hover:bg-accent-primary/80"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <Search className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary">No plugins match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(plugin => {
            const Icon = CATEGORY_ICONS[plugin.category] || Package
            const isActioning = actionInProgress?.endsWith(plugin.id)
            const catColor = CATEGORY_COLORS[plugin.category] || 'text-text-muted bg-white/[0.04] border-white/[0.06]'

            return (
              <div
                key={plugin.id}
                className={`glass rounded-2xl p-5 flex flex-col transition-colors ${
                  plugin.installed ? 'border border-emerald-400/10' : ''
                }`}
              >
                {/* Plugin header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className={`p-2.5 rounded-xl ${catColor.split(' ').slice(1).join(' ')}`}>
                    <Icon className={`w-5 h-5 ${catColor.split(' ')[0]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-text-primary truncate">{plugin.name}</h3>
                      {plugin.installed && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted">
                      by {plugin.author} · v{plugin.version}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-text-secondary leading-relaxed mb-3 flex-1">
                  {plugin.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {plugin.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full text-[10px] bg-white/[0.04] text-text-muted border border-white/[0.06]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Stats + category badge */}
                <div className="flex items-center gap-3 mb-4 text-[11px] text-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {formatDownloads(plugin.downloads)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" />
                    {plugin.rating.toFixed(1)}
                  </span>
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium border ${catColor}`}>
                    {CATEGORY_LABELS[plugin.category] || plugin.category}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                  {plugin.installed ? (
                    <>
                      {plugin.hasUpdate && (
                        <button
                          onClick={() => pluginAction('update', plugin.id)}
                          disabled={!!isActioning}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 border border-amber-400/20 transition-colors disabled:opacity-50"
                        >
                          {isActioning ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                          )}
                          Update to v{plugin.version}
                        </button>
                      )}
                      <button
                        onClick={() => pluginAction('uninstall', plugin.id)}
                        disabled={!!isActioning}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                      >
                        {isActioning ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Uninstall
                      </button>
                      {!plugin.hasUpdate && (
                        <span className="flex-1 text-center text-[11px] text-emerald-400 font-medium">
                          Installed v{plugin.installedVersion || plugin.version}
                        </span>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => pluginAction('install', plugin.id)}
                      disabled={!!isActioning}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium bg-accent-primary text-white hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
                    >
                      {isActioning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      Install
                    </button>
                  )}
                  {plugin.homepage && (
                    <a
                      href={plugin.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl hover:bg-white/[0.06] text-text-muted transition-colors"
                      title="View source"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

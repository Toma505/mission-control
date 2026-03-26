import { NextRequest, NextResponse } from 'next/server'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { sanitizeError } from '@/lib/sanitize-error'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { isConfigured, runCommand, getOpenClawPlugins } from '@/lib/openclaw'
import { DATA_DIR } from '@/lib/connection-config'
import { parseOpenClawPlugins, titleCaseFromPluginId } from '@/lib/openclaw-plugin-parser'

/**
 * Plugin Marketplace API.
 *
 * GET  - list installed plugins + available marketplace plugins
 * POST - install, uninstall, or update a plugin
 */

interface MarketplacePlugin {
  id: string
  name: string
  description: string
  author: string
  version: string
  category: string
  tags: string[]
  homepage?: string
  npmPackage?: string
  downloads?: number
  rating?: number
  installed: boolean
  installedVersion?: string
  hasUpdate: boolean
}

interface InstalledPlugin {
  name: string
  version: string
  enabled: boolean
}

interface PluginCatalogEntry {
  id: string
  name: string
  description: string
  author: string
  version: string
  category: string
  tags: string[]
  homepage?: string
  npmPackage?: string
  downloads?: number
  rating?: number
}

const CATALOG_FILE = path.join(DATA_DIR, 'plugin-catalog.json')

// No public OpenClaw marketplace API is available yet, so seed a catalog in
// DATA_DIR/plugin-catalog.json and let operators edit it without code changes.
const DEFAULT_PLUGIN_CATALOG: PluginCatalogEntry[] = [
  {
    id: 'security-scanner',
    name: 'Security Scanner',
    description: 'Automated security scanning for agent outputs. Detects prompt injection, data leaks, and unsafe code generation.',
    author: 'OpenClaw',
    version: '1.2.0',
    category: 'security',
    tags: ['security', 'scanning', 'safety'],
    homepage: 'https://github.com/openclaw/plugin-security-scanner',
  },
  {
    id: 'cost-optimizer',
    name: 'Cost Optimizer',
    description: 'Automatically routes requests to the cheapest model that meets quality thresholds.',
    author: 'OpenClaw',
    version: '2.0.1',
    category: 'cost',
    tags: ['cost', 'optimization', 'routing'],
    homepage: 'https://github.com/openclaw/plugin-cost-optimizer',
  },
  {
    id: 'rate-limiter',
    name: 'Rate Limiter',
    description: 'Per-agent and per-model rate limiting with burst protection and queue management.',
    author: 'OpenClaw',
    version: '1.0.3',
    category: 'ops',
    tags: ['rate-limit', 'throttle', 'queue'],
    homepage: 'https://github.com/openclaw/plugin-rate-limiter',
  },
  {
    id: 'output-logger',
    name: 'Output Logger',
    description: 'Structured logging of agent inputs and outputs with file, SQLite, and webhook destinations.',
    author: 'OpenClaw',
    version: '1.1.0',
    category: 'ops',
    tags: ['logging', 'audit', 'observability'],
    homepage: 'https://github.com/openclaw/plugin-output-logger',
  },
  {
    id: 'discord-notifications',
    name: 'Discord Notifications',
    description: 'Send agent events, alerts, and task completions directly to Discord via webhooks.',
    author: 'Community',
    version: '1.0.0',
    category: 'integration',
    tags: ['discord', 'notifications', 'webhook'],
  },
  {
    id: 'slack-integration',
    name: 'Slack Integration',
    description: 'Bidirectional Slack integration for status updates and lightweight control flows.',
    author: 'Community',
    version: '0.9.2',
    category: 'integration',
    tags: ['slack', 'integration', 'chat'],
  },
  {
    id: 'auto-backup',
    name: 'Auto Backup',
    description: 'Scheduled backups of agent configs, conversation history, and plugin data to S3 or local storage.',
    author: 'OpenClaw',
    version: '1.3.0',
    category: 'ops',
    tags: ['backup', 'storage', 's3'],
    homepage: 'https://github.com/openclaw/plugin-auto-backup',
  },
  {
    id: 'content-filter',
    name: 'Content Filter',
    description: 'Allowlist, blocklist, and regex filtering for generated agent output.',
    author: 'OpenClaw',
    version: '1.0.1',
    category: 'security',
    tags: ['filter', 'moderation', 'safety'],
    homepage: 'https://github.com/openclaw/plugin-content-filter',
  },
  {
    id: 'webhook-relay',
    name: 'Webhook Relay',
    description: 'Forward agent events to external HTTP endpoints with retry and signature support.',
    author: 'Community',
    version: '1.1.1',
    category: 'integration',
    tags: ['webhook', 'events', 'relay'],
  },
  {
    id: 'model-benchmark',
    name: 'Model Benchmark',
    description: 'Run automated quality benchmarks across models to compare latency, accuracy, and cost.',
    author: 'Community',
    version: '0.8.0',
    category: 'dev',
    tags: ['benchmark', 'testing', 'quality'],
  },
  {
    id: 'prompt-cache',
    name: 'Prompt Cache',
    description: 'Reduce repeated prompt costs with an intelligent caching layer for predictable workloads.',
    author: 'OpenClaw',
    version: '1.0.0',
    category: 'cost',
    tags: ['cache', 'optimization', 'performance'],
    homepage: 'https://github.com/openclaw/plugin-prompt-cache',
  },
  {
    id: 'memory-manager',
    name: 'Memory Manager',
    description: 'Long-term memory for agents with vector storage and automatic context injection.',
    author: 'OpenClaw',
    version: '2.1.0',
    category: 'dev',
    tags: ['memory', 'context', 'vector'],
    homepage: 'https://github.com/openclaw/plugin-memory-manager',
  },
]

function normalizePluginKey(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, '').replace(/\s+/g, '-')
}

async function readCatalog(): Promise<PluginCatalogEntry[]> {
  try {
    const text = await readFile(CATALOG_FILE, 'utf-8')
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : DEFAULT_PLUGIN_CATALOG
  } catch {
    await mkdir(path.dirname(CATALOG_FILE), { recursive: true })
    await writeFile(CATALOG_FILE, JSON.stringify(DEFAULT_PLUGIN_CATALOG, null, 2))
    return DEFAULT_PLUGIN_CATALOG
  }
}

function findCatalogMatch(catalog: PluginCatalogEntry[], pluginName: string) {
  const normalized = normalizePluginKey(pluginName)
  return catalog.find(entry => {
    const keys = [entry.id, entry.name, entry.npmPackage].filter(Boolean) as string[]
    return keys.some(key => normalizePluginKey(key) === normalized)
  })
}

export async function GET() {
  try {
    const catalog = await readCatalog()

    if (!(await isConfigured())) {
      return NextResponse.json({
        installed: [],
        marketplace: catalog.map(entry => ({
          ...entry,
          installed: false,
          hasUpdate: false,
        })),
        categories: [...new Set(catalog.map(entry => entry.category))],
      })
    }

    let installed: InstalledPlugin[] = []
    try {
      const raw = await getOpenClawPlugins()
      installed = parseOpenClawPlugins(raw).plugins.map(plugin => ({
        name: plugin.name,
        version: plugin.version,
        enabled: plugin.enabled,
      }))
    } catch {
      installed = []
    }

    const marketplace: MarketplacePlugin[] = catalog.map(entry => {
      const installedPlugin = installed.find(plugin => findCatalogMatch([entry], plugin.name))

      return {
        ...entry,
        installed: !!installedPlugin,
        installedVersion: installedPlugin?.version,
        hasUpdate: installedPlugin ? installedPlugin.version !== entry.version : false,
      }
    })

    const uncataloguedInstalled = installed
      .filter(plugin => !findCatalogMatch(catalog, plugin.name))
      .map<MarketplacePlugin>(plugin => ({
        id: plugin.name,
        name: titleCaseFromPluginId(plugin.name),
        description: 'Installed plugin discovered from OpenClaw. Add it to plugin-catalog.json to enrich its metadata.',
        author: 'Installed',
        version: plugin.version,
        category: 'installed',
        tags: ['installed'],
        installed: true,
        installedVersion: plugin.version,
        hasUpdate: false,
      }))

    return NextResponse.json({
      installed: installed.map(plugin => ({
        ...plugin,
        marketplaceMatch: findCatalogMatch(catalog, plugin.name),
      })),
      marketplace: [...marketplace, ...uncataloguedInstalled],
      categories: [...new Set([...catalog.map(entry => entry.category), ...uncataloguedInstalled.map(entry => entry.category)])],
    })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to load plugins') },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()
  if (!(await isConfigured())) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  try {
    let body: { action: string; pluginId: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { action, pluginId } = body
    if (!pluginId) {
      return NextResponse.json({ error: 'Plugin ID is required' }, { status: 400 })
    }

    function friendlyError(raw: string | undefined, fallback: string): string {
      if (!raw) return fallback
      if (/command not allowed|not.?allowed|forbidden/i.test(raw)) {
        return 'Plugin management requires a fully connected OpenClaw instance. Check your connection settings.'
      }
      return raw
    }

    switch (action) {
      case 'install': {
        const result = await runCommand('openclaw.plugins.install', pluginId)
        return NextResponse.json({
          ok: result.ok,
          message: result.ok
            ? `Successfully installed ${pluginId}`
            : friendlyError(result.error, `Failed to install ${pluginId}`),
          output: result.output,
        })
      }
      case 'uninstall': {
        const result = await runCommand('openclaw.plugins.uninstall', pluginId)
        return NextResponse.json({
          ok: result.ok,
          message: result.ok
            ? `Successfully uninstalled ${pluginId}`
            : friendlyError(result.error, `Failed to uninstall ${pluginId}`),
          output: result.output,
        })
      }
      case 'update': {
        const result = await runCommand('openclaw.plugins.update', pluginId)
        return NextResponse.json({
          ok: result.ok,
          message: result.ok
            ? `Successfully updated ${pluginId}`
            : friendlyError(result.error, `Failed to update ${pluginId}`),
          output: result.output,
        })
      }
      case 'enable': {
        const result = await runCommand('openclaw.plugins.enable', pluginId)
        return NextResponse.json({
          ok: result.ok,
          message: result.ok
            ? `Enabled ${pluginId}`
            : friendlyError(result.error, `Failed to enable ${pluginId}`),
        })
      }
      case 'disable': {
        const result = await runCommand('openclaw.plugins.disable', pluginId)
        return NextResponse.json({
          ok: result.ok,
          message: result.ok
            ? `Disabled ${pluginId}`
            : friendlyError(result.error, `Failed to disable ${pluginId}`),
        })
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Plugin operation failed') },
      { status: 500 }
    )
  }
}

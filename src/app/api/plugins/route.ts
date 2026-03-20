import { NextRequest, NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/sanitize-error'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { isConfigured, runCommand, getOpenClawPlugins } from '@/lib/openclaw'
import { getEffectiveConfig } from '@/lib/connection-config'

/**
 * Plugin Marketplace API.
 *
 * GET  — list installed plugins + available marketplace plugins
 * POST — install, uninstall, or update a plugin
 */

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

interface InstalledPlugin {
  name: string
  version: string
  enabled: boolean
  description?: string
}

// Known OpenClaw plugins from the ecosystem
// In production, this would come from a real marketplace API
const MARKETPLACE_CATALOG: Omit<MarketplacePlugin, 'installed' | 'installedVersion' | 'hasUpdate'>[] = [
  {
    id: 'security-scanner',
    name: 'Security Scanner',
    description: 'Automated security scanning for agent outputs. Detects prompt injection, data leaks, and unsafe code generation.',
    author: 'OpenClaw',
    version: '1.2.0',
    category: 'security',
    downloads: 2840,
    rating: 4.8,
    tags: ['security', 'scanning', 'safety'],
    homepage: 'https://github.com/openclaw/plugin-security-scanner',
  },
  {
    id: 'cost-optimizer',
    name: 'Cost Optimizer',
    description: 'Automatically routes requests to the cheapest model that meets quality thresholds. Saves 20-40% on average.',
    author: 'OpenClaw',
    version: '2.0.1',
    category: 'cost',
    downloads: 1950,
    rating: 4.6,
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
    downloads: 1200,
    rating: 4.5,
    tags: ['rate-limit', 'throttle', 'queue'],
    homepage: 'https://github.com/openclaw/plugin-rate-limiter',
  },
  {
    id: 'output-logger',
    name: 'Output Logger',
    description: 'Structured logging of all agent inputs and outputs. Supports file, SQLite, and webhook destinations.',
    author: 'OpenClaw',
    version: '1.1.0',
    category: 'ops',
    downloads: 980,
    rating: 4.3,
    tags: ['logging', 'audit', 'observability'],
    homepage: 'https://github.com/openclaw/plugin-output-logger',
  },
  {
    id: 'discord-notifications',
    name: 'Discord Notifications',
    description: 'Send agent events, alerts, and task completions directly to a Discord channel via webhooks.',
    author: 'Community',
    version: '1.0.0',
    category: 'integration',
    downloads: 750,
    rating: 4.2,
    tags: ['discord', 'notifications', 'webhook'],
  },
  {
    id: 'slack-integration',
    name: 'Slack Integration',
    description: 'Bidirectional Slack integration — control agents from Slack and receive status updates in channels.',
    author: 'Community',
    version: '0.9.2',
    category: 'integration',
    downloads: 620,
    rating: 4.0,
    tags: ['slack', 'integration', 'chat'],
  },
  {
    id: 'auto-backup',
    name: 'Auto Backup',
    description: 'Scheduled backups of agent configs, conversation history, and plugin data to S3 or local storage.',
    author: 'OpenClaw',
    version: '1.3.0',
    category: 'ops',
    downloads: 540,
    rating: 4.7,
    tags: ['backup', 'storage', 's3'],
    homepage: 'https://github.com/openclaw/plugin-auto-backup',
  },
  {
    id: 'content-filter',
    name: 'Content Filter',
    description: 'Customizable content filtering with allowlists, blocklists, and regex patterns for agent outputs.',
    author: 'OpenClaw',
    version: '1.0.1',
    category: 'security',
    downloads: 430,
    rating: 4.1,
    tags: ['filter', 'moderation', 'safety'],
    homepage: 'https://github.com/openclaw/plugin-content-filter',
  },
  {
    id: 'webhook-relay',
    name: 'Webhook Relay',
    description: 'Forward agent events to any HTTP endpoint. Supports retries, batching, and signature verification.',
    author: 'Community',
    version: '1.1.1',
    category: 'integration',
    downloads: 380,
    rating: 4.4,
    tags: ['webhook', 'events', 'relay'],
  },
  {
    id: 'model-benchmark',
    name: 'Model Benchmark',
    description: 'Run automated quality benchmarks across models. Compare latency, accuracy, and cost per task type.',
    author: 'Community',
    version: '0.8.0',
    category: 'dev',
    downloads: 290,
    rating: 3.9,
    tags: ['benchmark', 'testing', 'quality'],
  },
  {
    id: 'prompt-cache',
    name: 'Prompt Cache',
    description: 'Intelligent caching layer for repeated prompts. Reduces API calls by 30-60% for predictable workloads.',
    author: 'OpenClaw',
    version: '1.0.0',
    category: 'cost',
    downloads: 850,
    rating: 4.5,
    tags: ['cache', 'optimization', 'performance'],
    homepage: 'https://github.com/openclaw/plugin-prompt-cache',
  },
  {
    id: 'memory-manager',
    name: 'Memory Manager',
    description: 'Long-term memory for agents with vector storage, semantic search, and automatic context injection.',
    author: 'OpenClaw',
    version: '2.1.0',
    category: 'dev',
    downloads: 1100,
    rating: 4.7,
    tags: ['memory', 'context', 'vector'],
    homepage: 'https://github.com/openclaw/plugin-memory-manager',
  },
]

function parseInstalledPlugins(raw: string): InstalledPlugin[] {
  const plugins: InstalledPlugin[] = []

  // Try table format: │ name │ version │ enabled │
  const tableRows = raw.match(/│\s*(\S+)\s*│\s*(\S+)\s*│\s*(\S+)\s*│/g)
  if (tableRows) {
    for (const row of tableRows) {
      const match = row.match(/│\s*(\S+)\s*│\s*(\S+)\s*│\s*(\S+)\s*│/)
      if (match && match[1] !== 'name' && match[1] !== '─') {
        plugins.push({
          name: match[1],
          version: match[2],
          enabled: match[3] !== 'false' && match[3] !== 'disabled',
        })
      }
    }
    if (plugins.length > 0) return plugins
  }

  // Try list format: - plugin-name@1.0.0 (enabled)
  const listRegex = /[-•]\s*(\S+?)(?:@(\S+))?\s*(?:\((\w+)\))?/g
  let m
  while ((m = listRegex.exec(raw)) !== null) {
    plugins.push({
      name: m[1],
      version: m[2] || 'unknown',
      enabled: m[3] !== 'disabled',
    })
  }

  // Try line-by-line
  if (plugins.length === 0) {
    const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('─') && !l.startsWith('='))
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.toLowerCase().includes('plugin') && !trimmed.toLowerCase().includes('no ')) {
        const parts = trimmed.split(/[\s@]+/)
        plugins.push({
          name: parts[0],
          version: parts[1] || 'unknown',
          enabled: true,
        })
      }
    }
  }

  return plugins
}

export async function GET() {
  try {
    if (!(await isConfigured())) {
      return NextResponse.json({
        installed: [],
        marketplace: MARKETPLACE_CATALOG.map(p => ({
          ...p,
          installed: false,
          hasUpdate: false,
        })),
        categories: [...new Set(MARKETPLACE_CATALOG.map(p => p.category))],
      })
    }

    // Get installed plugins from OpenClaw
    let installed: InstalledPlugin[] = []
    try {
      const raw = await getOpenClawPlugins()
      installed = parseInstalledPlugins(raw)
    } catch {
      // OpenClaw might not support plugin listing — continue with empty
    }

    const installedNames = new Set(installed.map(p => p.name.toLowerCase()))

    // Merge installed status with marketplace catalog
    const marketplace: MarketplacePlugin[] = MARKETPLACE_CATALOG.map(mp => {
      const inst = installed.find(ip =>
        ip.name.toLowerCase() === mp.id ||
        ip.name.toLowerCase() === mp.name.toLowerCase().replace(/\s+/g, '-')
      )

      return {
        ...mp,
        installed: !!inst,
        installedVersion: inst?.version,
        hasUpdate: inst ? inst.version !== mp.version : false,
      }
    })

    return NextResponse.json({
      installed: installed.map(p => ({
        ...p,
        marketplaceMatch: MARKETPLACE_CATALOG.find(mp =>
          mp.id === p.name.toLowerCase() ||
          mp.name.toLowerCase().replace(/\s+/g, '-') === p.name.toLowerCase()
        ),
      })),
      marketplace,
      categories: [...new Set(MARKETPLACE_CATALOG.map(p => p.category))],
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

    switch (action) {
      case 'install': {
        const result = await runCommand('openclaw.plugins.install', pluginId)
        return NextResponse.json({
          ok: result.ok,
          message: result.ok
            ? `Successfully installed ${pluginId}`
            : result.error || `Failed to install ${pluginId}`,
          output: result.output,
        })
      }
      case 'uninstall': {
        const result = await runCommand('openclaw.plugins.uninstall', pluginId)
        return NextResponse.json({
          ok: result.ok,
          message: result.ok
            ? `Successfully uninstalled ${pluginId}`
            : result.error || `Failed to uninstall ${pluginId}`,
          output: result.output,
        })
      }
      case 'update': {
        const result = await runCommand('openclaw.plugins.update', pluginId)
        return NextResponse.json({
          ok: result.ok,
          message: result.ok
            ? `Successfully updated ${pluginId}`
            : result.error || `Failed to update ${pluginId}`,
          output: result.output,
        })
      }
      case 'enable': {
        const result = await runCommand('openclaw.plugins.enable', pluginId)
        return NextResponse.json({
          ok: result.ok,
          message: result.ok
            ? `Enabled ${pluginId}`
            : result.error || `Failed to enable ${pluginId}`,
        })
      }
      case 'disable': {
        const result = await runCommand('openclaw.plugins.disable', pluginId)
        return NextResponse.json({
          ok: result.ok,
          message: result.ok
            ? `Disabled ${pluginId}`
            : result.error || `Failed to disable ${pluginId}`,
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

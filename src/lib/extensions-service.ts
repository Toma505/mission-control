import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { sanitizeError } from '@/lib/sanitize-error'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { generateReport } from '@/lib/skill-scanner'
import { getEffectiveConfig } from '@/lib/connection-config'
import { getOpenClawConfig, getOpenClawPlugins, isConfigured, runCommand } from '@/lib/openclaw'
import {
  findCatalogEntry,
  getExtensionsCatalog,
  normalizeExtensionKey,
  type ExtensionCatalogEntry,
  type ExtensionSource,
} from '@/lib/extensions-catalog'
import { parseOpenClawPlugins, titleCaseFromPluginId } from '@/lib/openclaw-plugin-parser'

const MAX_ZIP_SIZE = 50 * 1024 * 1024
const MAX_FILES_IN_ZIP = 5000
const MAX_TOTAL_UNCOMPRESSED = 500 * 1024 * 1024

export interface ExtensionRecord {
  id: string
  name: string
  description: string
  author: string
  version: string
  category: string
  tags: string[]
  installed: boolean
  enabled: boolean
  source: ExtensionSource
  hasUpdate: boolean
  homepage?: string
  npmPackage?: string
  installedVersion?: string
}

interface InstalledExtensionRecord {
  id: string
  name: string
  version: string
  enabled: boolean
  source: Exclude<ExtensionSource, 'marketplace'>
  npmPackage?: string
}

function buildInstalledFallback(plugin: InstalledExtensionRecord): ExtensionRecord {
  return {
    id: plugin.id,
    name: titleCaseFromPluginId(plugin.name),
    description:
      plugin.source === 'openclaw'
        ? 'Built-in OpenClaw extension detected from your live instance.'
        : 'Extension installed from npm on your OpenClaw instance.',
    author: plugin.source === 'openclaw' ? 'OpenClaw' : 'Installed',
    version: plugin.version,
    category: plugin.source === 'openclaw' ? 'plugins' : 'developer',
    tags: plugin.source === 'openclaw' ? ['built-in'] : ['npm'],
    installed: true,
    enabled: plugin.enabled,
    source: plugin.source,
    hasUpdate: false,
    installedVersion: plugin.version,
    npmPackage: plugin.npmPackage,
  }
}

function mergeCatalogEntry(
  entry: ExtensionCatalogEntry,
  installedPlugin?: InstalledExtensionRecord
): ExtensionRecord {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    author: entry.author,
    version: entry.version,
    category: entry.category,
    tags: entry.tags,
    homepage: entry.homepage,
    npmPackage: entry.npmPackage,
    installed: !!installedPlugin,
    enabled: installedPlugin?.enabled ?? false,
    source: installedPlugin?.source ?? 'marketplace',
    hasUpdate: installedPlugin ? installedPlugin.version !== entry.version : false,
    installedVersion: installedPlugin?.version,
  }
}

function resolvePackageName(
  extensionId: string,
  catalog: ExtensionCatalogEntry[],
  packageName?: string
) {
  if (packageName) return packageName.trim()
  const catalogEntry = findCatalogEntry(catalog, extensionId)
  return catalogEntry?.npmPackage || extensionId
}

async function getInstalledExtensions(): Promise<InstalledExtensionRecord[]> {
  if (!(await isConfigured())) return []

  const raw = await getOpenClawPlugins()
  const parsed = parseOpenClawPlugins(raw)
  return parsed.plugins.map((plugin) => ({
    id: plugin.id,
    name: plugin.name,
    version: plugin.version,
    enabled: plugin.enabled,
    source: plugin.source,
    npmPackage: plugin.source === 'npm' ? `@openclaw/${plugin.id}` : undefined,
  }))
}

export async function getExtensionsPayload() {
  const catalog = getExtensionsCatalog()
  const connected = await isConfigured()
  const installed = connected ? await getInstalledExtensions() : []
  const installedMap = new Map(installed.map((plugin) => [normalizeExtensionKey(plugin.id), plugin]))

  const marketplace = catalog.map((entry) => {
    const installedPlugin =
      installedMap.get(normalizeExtensionKey(entry.id)) ||
      (entry.npmPackage ? installedMap.get(normalizeExtensionKey(entry.npmPackage)) : undefined)

    return mergeCatalogEntry(entry, installedPlugin)
  })

  const uncataloguedInstalled = installed
    .filter((plugin) => !findCatalogEntry(catalog, plugin.id) && !(plugin.npmPackage && findCatalogEntry(catalog, plugin.npmPackage)))
    .map(buildInstalledFallback)

  const installedExtensions = installed.map((plugin) => {
    const match = findCatalogEntry(catalog, plugin.id) || (plugin.npmPackage ? findCatalogEntry(catalog, plugin.npmPackage) : undefined)
    return match ? mergeCatalogEntry(match, plugin) : buildInstalledFallback(plugin)
  })

  return {
    connected,
    installed: installedExtensions,
    marketplace: [...marketplace, ...uncataloguedInstalled],
    categories: [...new Set([...catalog.map((entry) => entry.category), ...uncataloguedInstalled.map((entry) => entry.category)])],
  }
}

export async function getExtensionsResponse() {
  try {
    return NextResponse.json(await getExtensionsPayload())
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to load extensions') },
      { status: 500 }
    )
  }
}

async function runExtensionCleanup(extensionId?: string) {
  const targetId = extensionId || 'self-improving-agent-3-0-2'
  const connConfig = await getEffectiveConfig()
  const auth = 'Basic ' + Buffer.from(':' + connConfig.setupPassword).toString('base64')

  const configData = await getOpenClawConfig()
  if (!configData?.content) {
    return NextResponse.json({ error: 'Could not read config' }, { status: 500 })
  }

  const config = JSON.parse(configData.content)
  if (!config.plugins?.entries?.[targetId]) {
    return NextResponse.json({
      ok: true,
      message: `No stale entry found for ${targetId}`,
    })
  }

  delete config.plugins.entries[targetId]

  if (Object.keys(config.plugins.entries).length === 0) {
    delete config.plugins.entries
  }
  if (Object.keys(config.plugins).length === 0) {
    delete config.plugins
  }

  const endpoints = [
    { url: `${connConfig.openclawUrl}/setup/api/config/raw`, method: 'PUT' },
    { url: `${connConfig.openclawUrl}/setup/api/config/raw`, method: 'POST' },
  ]

  for (const endpoint of endpoints) {
    const res = await fetch(endpoint.url, {
      method: endpoint.method,
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: JSON.stringify(config, null, 2) }),
    })

    if (res.ok) {
      return NextResponse.json({
        ok: true,
        message: `Removed stale extension entry for ${targetId}`,
      })
    }
  }

  return NextResponse.json({ error: 'Could not write config back' }, { status: 500 })
}

async function runExtensionScan(formData: FormData) {
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size > MAX_ZIP_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum size is 50 MB.' }, { status: 400 })
  }
  if (!file.name.endsWith('.zip')) {
    return NextResponse.json({ error: 'Only .zip files are accepted.' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)
  const entries = Object.entries(zip.files).filter(([, entry]) => !entry.dir)

  if (entries.length > MAX_FILES_IN_ZIP) {
    return NextResponse.json(
      { error: `Too many files in archive (${entries.length}). Maximum is ${MAX_FILES_IN_ZIP}.` },
      { status: 400 }
    )
  }

  let totalUncompressed = 0
  const files: { name: string; size: number; content?: string }[] = []

  for (const [name, entry] of entries) {
    const size = (entry as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0
    totalUncompressed += size

    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) {
      return NextResponse.json(
        { error: 'Archive is too large when uncompressed. Maximum total is 500 MB.' },
        { status: 400 }
      )
    }

    const ext = name.includes('.') ? '.' + name.split('.').pop()!.toLowerCase() : ''
    const isTextFile = [
      '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
      '.py', '.sh', '.bash', '.bat', '.cmd', '.ps1',
      '.json', '.yaml', '.yml', '.toml', '.md', '.txt',
      '.html', '.css', '.xml', '.env', '.cfg', '.ini',
    ].includes(ext)

    let content: string | undefined
    if (isTextFile && size < 1024 * 1024) {
      try {
        content = await entry.async('string')
      } catch {
        content = undefined
      }
    }

    files.push({ name, size, content })
  }

  return NextResponse.json({
    ok: true,
    fileName: file.name,
    fileSize: file.size,
    report: generateReport(files),
  })
}

function friendlyCommandError(raw: string | undefined, fallback: string) {
  if (!raw) return fallback
  if (/command not allowed|not.?allowed|forbidden/i.test(raw)) {
    return 'Extension management requires a fully connected OpenClaw instance. Check your connection settings.'
  }
  return raw
}

export async function handleExtensionsMutation(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const action = String(formData.get('action') || '')
      if (action !== 'scan') {
        return NextResponse.json({ error: 'Unknown multipart action' }, { status: 400 })
      }
      return runExtensionScan(formData)
    }

    const body = await request.json().catch(() => null) as {
      action?: string
      extensionId?: string
      packageName?: string
      skillName?: string
    } | null

    if (!body?.action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    const { action } = body
    if (action === 'scan') {
      return NextResponse.json({ error: 'Use multipart form data for scan uploads' }, { status: 400 })
    }

    if (!(await isConfigured())) {
      return NextResponse.json({ error: 'OpenClaw not configured' }, { status: 400 })
    }

    const catalog = getExtensionsCatalog()
    const extensionId = body.extensionId || body.skillName || ''

    switch (action) {
      case 'install': {
        const packageName = resolvePackageName(extensionId, catalog, body.packageName || body.skillName)
        if (!packageName) {
          return NextResponse.json({ error: 'Extension ID or package name is required' }, { status: 400 })
        }
        const result = await runCommand('openclaw.plugins.install', packageName)
        return NextResponse.json({
          ok: result.ok,
          message: result.ok
            ? `Successfully installed ${packageName}`
            : friendlyCommandError(result.error, `Failed to install ${packageName}`),
          output: result.output,
        })
      }
      case 'uninstall':
      case 'update':
      case 'enable':
      case 'disable': {
        if (!extensionId) {
          return NextResponse.json({ error: 'Extension ID is required' }, { status: 400 })
        }
        const command = `openclaw.plugins.${action}`
        const result = await runCommand(command, extensionId)
        const verb = action === 'enable'
          ? 'Enabled'
          : action === 'disable'
            ? 'Disabled'
            : action === 'update'
              ? 'Updated'
              : 'Uninstalled'

        return NextResponse.json({
          ok: result.ok,
          message: result.ok
            ? `${verb} ${extensionId}`
            : friendlyCommandError(result.error, `Failed to ${action} ${extensionId}`),
          output: result.output,
        })
      }
      case 'cleanup':
        return runExtensionCleanup(extensionId || undefined)
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Extension operation failed') },
      { status: 500 }
    )
  }
}

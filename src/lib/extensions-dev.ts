import { randomUUID } from 'crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'fs/promises'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'

export type DevLogLevel = 'info' | 'success' | 'warn' | 'error'
export type DevTemplateId = 'basic' | 'skill' | 'integration'

export interface ExtensionDevLog {
  id: string
  level: DevLogLevel
  message: string
  timestamp: string
  pluginId?: string
  filePath?: string
}

export interface ExtensionDevScaffold {
  id: string
  name: string
  slug: string
  template: DevTemplateId
  rootPath: string
  manifestPath: string
  createdAt: string
  updatedAt: string
  lastReloadAt?: string
  lastValidationAt?: string
}

export interface ExtensionManifest {
  name: string
  displayName: string
  version: string
  description: string
  entry: string
  template: DevTemplateId
  permissions: string[]
}

interface ExtensionDevStore {
  enabled: boolean
  watcherLastEventAt: string | null
  scaffolds: ExtensionDevScaffold[]
  logs: ExtensionDevLog[]
}

interface WatcherState {
  interval: NodeJS.Timeout | null
  snapshot: Map<string, string>
  running: boolean
}

export interface ExtensionDevTemplateDescriptor {
  id: DevTemplateId
  label: string
  description: string
}

export interface ManifestValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  manifest: ExtensionManifest | null
}

export interface ExtensionDevScaffoldSummary extends ExtensionDevScaffold {
  fileCount: number
  manifestValid: boolean
  manifestErrors: string[]
  manifestWarnings: string[]
}

export interface ExtensionDevPayload {
  enabled: boolean
  watcher: {
    active: boolean
    rootPath: string
    watchedPlugins: number
    lastEventAt: string | null
  }
  templates: ExtensionDevTemplateDescriptor[]
  scaffolds: ExtensionDevScaffoldSummary[]
  logs: ExtensionDevLog[]
}

const EXTENSIONS_DEV_FILE = path.join(DATA_DIR, 'extensions-dev.json')
const SEED_EXTENSIONS_DEV_FILE = path.join(process.cwd(), 'data', 'extensions-dev.json')
const EXTENSIONS_DEV_ROOT = path.join(DATA_DIR, 'plugin-dev')
const MAX_LOG_ENTRIES = 250
const WATCH_INTERVAL_MS = 2500

const TEMPLATE_OPTIONS: ExtensionDevTemplateDescriptor[] = [
  {
    id: 'basic',
    label: 'Basic Plugin',
    description: 'Minimal manifest, entry file, and README for a new extension.',
  },
  {
    id: 'skill',
    label: 'Skill Plugin',
    description: 'Adds a skills folder and starter docs for prompt-driven capabilities.',
  },
  {
    id: 'integration',
    label: 'Integration Plugin',
    description: 'Adds hooks and a service stub for event-driven integrations.',
  },
]

type DevGlobals = typeof globalThis & {
  __mcExtensionsDevWatcher?: WatcherState
}

function getWatcherState(): WatcherState {
  const globals = globalThis as DevGlobals
  if (!globals.__mcExtensionsDevWatcher) {
    globals.__mcExtensionsDevWatcher = {
      interval: null,
      snapshot: new Map(),
      running: false,
    }
  }
  return globals.__mcExtensionsDevWatcher
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function normalizeLog(input: unknown): ExtensionDevLog | null {
  if (!input || typeof input !== 'object') return null
  const value = input as Record<string, unknown>
  const level = value.level
  const acceptedLevel: DevLogLevel =
    level === 'success' || level === 'warn' || level === 'error' || level === 'info'
      ? level
      : 'info'

  const message = String(value.message || '').trim()
  if (!message) return null

  return {
    id: typeof value.id === 'string' && value.id ? value.id : randomUUID(),
    level: acceptedLevel,
    message,
    timestamp:
      typeof value.timestamp === 'string' && !Number.isNaN(Date.parse(value.timestamp))
        ? value.timestamp
        : nowIso(),
    pluginId: typeof value.pluginId === 'string' ? value.pluginId : undefined,
    filePath: typeof value.filePath === 'string' ? value.filePath : undefined,
  }
}

function normalizeScaffold(input: unknown): ExtensionDevScaffold | null {
  if (!input || typeof input !== 'object') return null
  const value = input as Record<string, unknown>
  const name = String(value.name || '').trim()
  const slug = normalizeSlug(String(value.slug || name))
  const rootPath = typeof value.rootPath === 'string' ? value.rootPath : ''
  const manifestPath = typeof value.manifestPath === 'string' ? value.manifestPath : ''

  if (!name || !slug || !rootPath || !manifestPath) return null

  const templateValue = value.template
  const template: DevTemplateId =
    templateValue === 'skill' || templateValue === 'integration' || templateValue === 'basic'
      ? templateValue
      : 'basic'

  return {
    id: typeof value.id === 'string' && value.id ? value.id : randomUUID(),
    name,
    slug,
    template,
    rootPath,
    manifestPath,
    createdAt:
      typeof value.createdAt === 'string' && !Number.isNaN(Date.parse(value.createdAt))
        ? value.createdAt
        : nowIso(),
    updatedAt:
      typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt))
        ? value.updatedAt
        : nowIso(),
    lastReloadAt:
      typeof value.lastReloadAt === 'string' && !Number.isNaN(Date.parse(value.lastReloadAt))
        ? value.lastReloadAt
        : undefined,
    lastValidationAt:
      typeof value.lastValidationAt === 'string' && !Number.isNaN(Date.parse(value.lastValidationAt))
        ? value.lastValidationAt
        : undefined,
  }
}

function normalizeStore(input: unknown): ExtensionDevStore {
  const value = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  return {
    enabled: value.enabled === true,
    watcherLastEventAt:
      typeof value.watcherLastEventAt === 'string' && !Number.isNaN(Date.parse(value.watcherLastEventAt))
        ? value.watcherLastEventAt
        : null,
    scaffolds: Array.isArray(value.scaffolds)
      ? value.scaffolds.map(normalizeScaffold).filter((entry): entry is ExtensionDevScaffold => !!entry)
      : [],
    logs: Array.isArray(value.logs)
      ? value.logs.map(normalizeLog).filter((entry): entry is ExtensionDevLog => !!entry).slice(-MAX_LOG_ENTRIES)
      : [],
  }
}

async function readSeedStore() {
  try {
    const raw = await readFile(SEED_EXTENSIONS_DEV_FILE, 'utf-8')
    return normalizeStore(JSON.parse(raw))
  } catch {
    return normalizeStore(null)
  }
}

export async function readExtensionsDevStore(): Promise<ExtensionDevStore> {
  try {
    const raw = await readFile(EXTENSIONS_DEV_FILE, 'utf-8')
    return normalizeStore(JSON.parse(raw))
  } catch {
    return readSeedStore()
  }
}

export async function writeExtensionsDevStore(store: ExtensionDevStore) {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(
    EXTENSIONS_DEV_FILE,
    JSON.stringify(
      {
        ...store,
        logs: store.logs.slice(-MAX_LOG_ENTRIES),
      },
      null,
      2,
    ),
  )
}

async function pushLog(
  level: DevLogLevel,
  message: string,
  options?: { pluginId?: string; filePath?: string },
) {
  const store = await readExtensionsDevStore()
  store.logs.push({
    id: randomUUID(),
    level,
    message,
    timestamp: nowIso(),
    pluginId: options?.pluginId,
    filePath: options?.filePath,
  })
  store.logs = store.logs.slice(-MAX_LOG_ENTRIES)
  await writeExtensionsDevStore(store)
}

async function updateScaffold(
  pluginId: string,
  updater: (scaffold: ExtensionDevScaffold) => ExtensionDevScaffold,
) {
  const store = await readExtensionsDevStore()
  store.scaffolds = store.scaffolds.map((scaffold) =>
    scaffold.slug === pluginId ? updater(scaffold) : scaffold,
  )
  await writeExtensionsDevStore(store)
}

async function ensureDevRoot() {
  await mkdir(EXTENSIONS_DEV_ROOT, { recursive: true })
}

async function walkFiles(dirPath: string, baseDir = dirPath): Promise<Array<{ relativePath: string; signature: string }>> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const files: Array<{ relativePath: string; signature: string }> = []

    for (const entry of entries) {
      if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        files.push(...(await walkFiles(fullPath, baseDir)))
        continue
      }

      const fileStat = await stat(fullPath)
      files.push({
        relativePath: path.relative(baseDir, fullPath).replace(/\\/g, '/'),
        signature: `${fileStat.mtimeMs}:${fileStat.size}`,
      })
    }

    return files
  } catch {
    return []
  }
}

function pluginIdFromRelativePath(relativePath: string) {
  return relativePath.split('/')[0] || 'unknown'
}

async function refreshWatcherSnapshot() {
  const watcher = getWatcherState()
  const files = await walkFiles(EXTENSIONS_DEV_ROOT)
  watcher.snapshot = new Map(files.map((file) => [file.relativePath, file.signature]))
}

async function processWatcherCycle() {
  const watcher = getWatcherState()
  if (watcher.running) return
  watcher.running = true

  try {
    const store = await readExtensionsDevStore()
    if (!store.enabled) return

    const files = await walkFiles(EXTENSIONS_DEV_ROOT)
    const nextSnapshot = new Map(files.map((file) => [file.relativePath, file.signature]))
    const changes: Array<{ type: 'added' | 'changed' | 'removed'; relativePath: string }> = []

    for (const [relativePath, signature] of nextSnapshot) {
      const previous = watcher.snapshot.get(relativePath)
      if (!previous) {
        changes.push({ type: 'added', relativePath })
      } else if (previous !== signature) {
        changes.push({ type: 'changed', relativePath })
      }
    }

    for (const relativePath of watcher.snapshot.keys()) {
      if (!nextSnapshot.has(relativePath)) {
        changes.push({ type: 'removed', relativePath })
      }
    }

    if (changes.length > 0) {
      const eventTime = nowIso()
      store.watcherLastEventAt = eventTime

      for (const change of changes.slice(0, 20)) {
        const pluginId = pluginIdFromRelativePath(change.relativePath)
        store.logs.push({
          id: randomUUID(),
          level: change.type === 'removed' ? 'warn' : 'info',
          message:
            change.type === 'removed'
              ? `Removed ${change.relativePath} — watcher marked plugin for reload`
              : `${change.type === 'added' ? 'Added' : 'Changed'} ${change.relativePath} — hot reload signal emitted`,
          timestamp: eventTime,
          pluginId,
          filePath: change.relativePath,
        })

        store.scaffolds = store.scaffolds.map((scaffold) =>
          scaffold.slug === pluginId
            ? {
                ...scaffold,
                updatedAt: eventTime,
                lastReloadAt: eventTime,
              }
            : scaffold,
        )
      }

      store.logs = store.logs.slice(-MAX_LOG_ENTRIES)
      await writeExtensionsDevStore(store)
    }

    watcher.snapshot = nextSnapshot
  } finally {
    watcher.running = false
  }
}

export async function syncExtensionsDevWatcher(enabled?: boolean) {
  const store = await readExtensionsDevStore()
  const shouldRun = enabled ?? store.enabled
  const watcher = getWatcherState()

  if (!shouldRun) {
    if (watcher.interval) {
      clearInterval(watcher.interval)
      watcher.interval = null
    }
    watcher.snapshot = new Map()
    return
  }

  await ensureDevRoot()
  if (!watcher.interval) {
    await refreshWatcherSnapshot()
    watcher.interval = setInterval(() => {
      void processWatcherCycle()
    }, WATCH_INTERVAL_MS)
    await pushLog('success', 'Developer watcher enabled. Monitoring plugin scaffolds for changes.')
  }
}

function buildManifest(slug: string, displayName: string, template: DevTemplateId): ExtensionManifest {
  const permissions =
    template === 'integration'
      ? ['filesystem', 'network']
      : template === 'skill'
        ? ['filesystem']
        : []

  return {
    name: slug,
    displayName,
    version: '0.1.0',
    description: `${displayName} plugin scaffold for Mission Control.`,
    entry: 'src/index.ts',
    template,
    permissions,
  }
}

function validateSemver(version: string) {
  return /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(version)
}

export function validateManifestInput(input: unknown): ManifestValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      valid: false,
      errors: ['Manifest must be a JSON object.'],
      warnings: [],
      manifest: null,
    }
  }

  const value = input as Record<string, unknown>
  const errors: string[] = []
  const warnings: string[] = []

  const name = typeof value.name === 'string' ? value.name.trim() : ''
  const displayName = typeof value.displayName === 'string' ? value.displayName.trim() : ''
  const version = typeof value.version === 'string' ? value.version.trim() : ''
  const description = typeof value.description === 'string' ? value.description.trim() : ''
  const entry = typeof value.entry === 'string' ? value.entry.trim() : ''
  const templateValue = value.template
  const template: DevTemplateId =
    templateValue === 'skill' || templateValue === 'integration' || templateValue === 'basic'
      ? templateValue
      : 'basic'
  const permissions = Array.isArray(value.permissions)
    ? value.permissions.map((item) => String(item)).filter(Boolean)
    : []

  if (!name) errors.push('Missing required field: name.')
  if (name && !/^[a-z0-9-]+$/.test(name)) {
    errors.push('name must be lowercase kebab-case using letters, numbers, and hyphens only.')
  }
  if (!displayName) warnings.push('displayName is missing — the UI will fall back to name.')
  if (!version) errors.push('Missing required field: version.')
  if (version && !validateSemver(version)) {
    errors.push('version must look like semver, for example 0.1.0.')
  }
  if (!description) warnings.push('description is empty — the marketplace card will look unfinished.')
  if (!entry) errors.push('Missing required field: entry.')
  if (entry.startsWith('/') || /^[A-Za-z]:\\/.test(entry) || entry.includes('..')) {
    errors.push('entry must be a relative path inside the plugin folder.')
  }
  if (typeof value.name !== 'string' && typeof value.id === 'string') {
    warnings.push('Manifest uses id without name — prefer a canonical name field.')
  }
  if (permissions.length === 0) {
    warnings.push('permissions is empty — add explicit permissions if the plugin touches network or filesystem APIs.')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    manifest: {
      name: name || 'invalid-plugin',
      displayName: displayName || name || 'Invalid Plugin',
      version: version || '0.0.0',
      description,
      entry: entry || 'src/index.ts',
      template,
      permissions,
    },
  }
}

async function readManifestFromDisk(manifestPath: string): Promise<ManifestValidationResult> {
  try {
    const raw = await readFile(manifestPath, 'utf-8')
    const result = validateManifestInput(JSON.parse(raw))
    if (!result.manifest) {
      return result
    }

    const pluginRoot = path.dirname(path.dirname(manifestPath))
    const entryPath = path.join(pluginRoot, result.manifest.entry)
    try {
      await stat(entryPath)
    } catch {
      result.errors.push(`entry file does not exist: ${result.manifest.entry}`)
      result.valid = false
    }

    return result
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Failed to read manifest'],
      warnings: [],
      manifest: null,
    }
  }
}

async function countFiles(rootPath: string) {
  const files = await walkFiles(rootPath)
  return files.length
}

function scaffoldReadme(displayName: string, slug: string, template: DevTemplateId) {
  return `# ${displayName}

Local developer scaffold for \`${slug}\`.

## Template

- ${template}

## Getting started

1. Edit \`.codex-plugin/plugin.json\`
2. Update \`src/index.ts\`
3. Keep Developer Mode on in Mission Control to watch for reload events
`
}

function scaffoldIndexSource(displayName: string, template: DevTemplateId) {
  const action =
    template === 'integration'
      ? 'handles external events'
      : template === 'skill'
        ? 'registers prompt-driven workflows'
        : 'implements local extension behavior'

  return `export function activate() {
  return {
    name: '${displayName}',
    status: 'ready',
    summary: '${displayName} ${action}.',
  }
}
`
}

function scaffoldPackageJson(slug: string, displayName: string) {
  return JSON.stringify(
    {
      name: slug,
      version: '0.1.0',
      private: true,
      description: `${displayName} local extension scaffold`,
      main: 'src/index.ts',
      scripts: {
        build: 'echo "Replace with your plugin build step"',
        dev: 'echo "Developer mode watcher is active from Mission Control"',
      },
    },
    null,
    2,
  )
}

function scaffoldSkillDoc(displayName: string) {
  return `# ${displayName} Skill

Describe the workflow, guardrails, and expected outputs for this skill plugin.
`
}

function scaffoldHookSource() {
  return `export async function onEvent(event) {
  return {
    ok: true,
    summary: \`Handled \${event?.type || 'unknown'}\`,
  }
}
`
}

export async function createExtensionScaffold(name: string, template: DevTemplateId = 'basic') {
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error('Plugin name is required.')
  }

  const slug = normalizeSlug(trimmedName)
  if (!slug) {
    throw new Error('Plugin name must contain letters or numbers.')
  }

  await ensureDevRoot()
  const rootPath = path.join(EXTENSIONS_DEV_ROOT, slug)
  const manifestDir = path.join(rootPath, '.codex-plugin')
  const manifestPath = path.join(manifestDir, 'plugin.json')

  try {
    await stat(rootPath)
    throw new Error(`A scaffold for ${slug} already exists.`)
  } catch (error) {
    if (error instanceof Error && !/ENOENT/i.test(error.message)) {
      throw error
    }
  }

  const displayName = trimmedName
  const manifest = buildManifest(slug, displayName, template)

  await mkdir(manifestDir, { recursive: true })
  await mkdir(path.join(rootPath, 'src'), { recursive: true })
  if (template === 'skill') {
    await mkdir(path.join(rootPath, 'skills'), { recursive: true })
  }
  if (template === 'integration') {
    await mkdir(path.join(rootPath, 'hooks'), { recursive: true })
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  await writeFile(path.join(rootPath, 'README.md'), scaffoldReadme(displayName, slug, template))
  await writeFile(path.join(rootPath, 'package.json'), scaffoldPackageJson(slug, displayName))
  await writeFile(path.join(rootPath, 'src', 'index.ts'), scaffoldIndexSource(displayName, template))

  if (template === 'skill') {
    await writeFile(path.join(rootPath, 'skills', 'README.md'), scaffoldSkillDoc(displayName))
  }
  if (template === 'integration') {
    await writeFile(path.join(rootPath, 'hooks', 'index.ts'), scaffoldHookSource())
  }

  const createdAt = nowIso()
  const scaffold: ExtensionDevScaffold = {
    id: randomUUID(),
    name: displayName,
    slug,
    template,
    rootPath,
    manifestPath,
    createdAt,
    updatedAt: createdAt,
    lastValidationAt: createdAt,
  }

  const store = await readExtensionsDevStore()
  store.scaffolds = [scaffold, ...store.scaffolds.filter((item) => item.slug !== slug)]
  await writeExtensionsDevStore(store)
  await pushLog('success', `Generated ${template} scaffold for ${displayName}.`, { pluginId: slug })
  await syncExtensionsDevWatcher(store.enabled)
  return scaffold
}

export async function setDeveloperMode(enabled: boolean) {
  const store = await readExtensionsDevStore()
  store.enabled = enabled
  if (!enabled) {
    store.watcherLastEventAt = null
  }
  await writeExtensionsDevStore(store)
  await syncExtensionsDevWatcher(enabled)
  if (!enabled) {
    await pushLog('warn', 'Developer watcher disabled.')
  }
}

export async function clearDeveloperLogs() {
  const store = await readExtensionsDevStore()
  store.logs = []
  await writeExtensionsDevStore(store)
}

export async function validateManifestForPlugin(pluginId?: string, manifestText?: string) {
  if (manifestText?.trim()) {
    let parsed: unknown
    try {
      parsed = JSON.parse(manifestText)
    } catch {
      const result = {
        valid: false,
        errors: ['Manifest JSON could not be parsed.'],
        warnings: [],
        manifest: null,
      } satisfies ManifestValidationResult
      await pushLog('error', result.errors[0])
      return result
    }

    const result = validateManifestInput(parsed)
    await pushLog(
      result.valid ? 'success' : 'error',
      result.valid
        ? 'Manifest validation passed for pasted JSON.'
        : `Manifest validation failed: ${result.errors[0]}`,
    )
    return result
  }

  if (!pluginId) {
    throw new Error('Plugin ID or manifest JSON is required for validation.')
  }

  const store = await readExtensionsDevStore()
  const scaffold = store.scaffolds.find((item) => item.slug === pluginId)
  if (!scaffold) {
    throw new Error('Scaffold not found.')
  }

  const result = await readManifestFromDisk(scaffold.manifestPath)
  const validatedAt = nowIso()
  await updateScaffold(pluginId, (current) => ({
    ...current,
    updatedAt: validatedAt,
    lastValidationAt: validatedAt,
  }))
  await pushLog(
    result.valid ? 'success' : 'error',
    result.valid
      ? `Manifest validation passed for ${pluginId}.`
      : `Manifest validation failed for ${pluginId}: ${result.errors[0]}`,
    { pluginId },
  )
  return result
}

export async function getExtensionDevPayload(): Promise<ExtensionDevPayload> {
  const store = await readExtensionsDevStore()
  await syncExtensionsDevWatcher(store.enabled)
  const watcher = getWatcherState()

  const scaffolds = await Promise.all(
    store.scaffolds.map(async (scaffold) => {
      const [validation, fileCount] = await Promise.all([
        readManifestFromDisk(scaffold.manifestPath),
        countFiles(scaffold.rootPath),
      ])

      return {
        ...scaffold,
        fileCount,
        manifestValid: validation.valid,
        manifestErrors: validation.errors,
        manifestWarnings: validation.warnings,
      } satisfies ExtensionDevScaffoldSummary
    }),
  )

  return {
    enabled: store.enabled,
    watcher: {
      active: !!watcher.interval && store.enabled,
      rootPath: EXTENSIONS_DEV_ROOT,
      watchedPlugins: scaffolds.length,
      lastEventAt: store.watcherLastEventAt,
    },
    templates: TEMPLATE_OPTIONS,
    scaffolds,
    logs: [...store.logs].sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    ),
  }
}

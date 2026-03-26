import { NextRequest, NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/sanitize-error'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'
import {
  decryptSecretValue,
  encryptSecretValue,
  isSecretEncryptionAvailable,
  UNENCRYPTED_STORAGE_WARNING,
} from '@/lib/secret-encryption'
import { validateManagedInstanceUrl } from '@/lib/url-validator'

const INSTANCES_FILE = path.join(DATA_DIR, 'instances.json')

export interface Instance {
  id: string
  name: string
  url: string
  /** Encrypted at rest — never sent to client */
  password: string
  enabled: boolean
  color: string
  addedAt: string
  lastSeen?: string
  status?: 'online' | 'offline' | 'error'
  statusMessage?: string
  health?: {
    mode?: string
    model?: string
    uptime?: string
    agents?: number
    checkedAt: string
  }
}

interface InstancesConfig {
  instances: Instance[]
  _warning?: string
}

const INSTANCE_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#f97316', '#6366f1',
]

async function readInstances(): Promise<InstancesConfig> {
  try {
    const text = await readFile(INSTANCES_FILE, 'utf-8')
    const parsed = JSON.parse(text)
    return {
      instances: Array.isArray(parsed?.instances) ? parsed.instances : [],
      _warning: typeof parsed?._warning === 'string' ? parsed._warning : undefined,
    }
  } catch {
    return { instances: [] }
  }
}

async function writeInstances(config: InstancesConfig) {
  await mkdir(path.dirname(INSTANCES_FILE), { recursive: true })
  const payload: InstancesConfig = {
    instances: config.instances,
  }

  if (!isSecretEncryptionAvailable()) {
    payload._warning = UNENCRYPTED_STORAGE_WARNING
  }

  await writeFile(INSTANCES_FILE, JSON.stringify(payload, null, 2))
}

/** Build Basic auth header matching openclaw.ts contract */
function buildAuth(password: string): string {
  const plainPassword = decryptSecretValue(password)
  return 'Basic ' + Buffer.from(':' + plainPassword).toString('base64')
}

/** Run a command on a remote OpenClaw instance using the correct {cmd, arg} contract */
async function remoteRunCommand(
  instanceUrl: string,
  auth: string,
  cmd: string,
  arg?: string,
  timeoutMs = 8000
): Promise<{ ok: boolean; output?: string; error?: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${instanceUrl}/setup/api/console/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ cmd, arg: arg || '' }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    return await res.json()
  } catch (err) {
    clearTimeout(timeout)
    return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' }
  }
}

/** Probe a single OpenClaw instance for health */
async function probeInstance(instance: Instance): Promise<Instance> {
  const updated = { ...instance }
  const checkedAt = new Date().toISOString()

  try {
    const auth = buildAuth(instance.password)

    // Hit the OpenClaw setup API to check connectivity
    const result = await remoteRunCommand(instance.url, auth, 'openclaw.status')

    if (!result.ok) {
      updated.status = 'error'
      updated.statusMessage = result.error || 'Status check failed'
      updated.health = { checkedAt }
      return updated
    }

    const output = result.output || ''

    // Parse mode from status output
    let mode = 'unknown'
    let model = ''
    const modeMatch = output.match(/mode[:\s]+(\w+)/i)
    if (modeMatch) mode = modeMatch[1].toLowerCase()
    const modelMatch = output.match(/model[:\s]+([^\n,]+)/i)
    if (modelMatch) model = modelMatch[1].trim()

    // Try to get agent count
    let agents = 0
    try {
      const agentResult = await remoteRunCommand(instance.url, auth, 'openclaw.sessions', undefined, 5000)
      if (agentResult.ok && agentResult.output) {
        agents = agentResult.output.split('\n').filter((l: string) => l.trim()).length
      }
    } catch {
      // Non-critical — skip agent count
    }

    updated.status = 'online'
    updated.statusMessage = undefined
    updated.lastSeen = checkedAt
    updated.health = { mode, model, agents, checkedAt }
  } catch (err) {
    updated.status = 'offline'
    updated.statusMessage = err instanceof Error ? err.message : 'Connection failed'
    updated.health = { checkedAt }
  }

  return updated
}

// GET — list instances, optionally with fresh health checks
export async function GET(request: NextRequest) {
  try {
    const config = await readInstances()
    const refresh = request.nextUrl.searchParams.get('refresh') === 'true'

    if (refresh && config.instances.length > 0) {
      // Probe all enabled instances in parallel
      const probes = config.instances.map(inst =>
        inst.enabled ? probeInstance(inst) : Promise.resolve(inst)
      )
      config.instances = await Promise.all(probes)
      await writeInstances(config)
    }

    // Strip passwords from response
    const safeInstances = config.instances.map(({ password: _pw, ...rest }) => rest)
    return NextResponse.json({ instances: safeInstances })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to read instances') },
      { status: 500 }
    )
  }
}

// POST — add, update, delete, test instances
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    let body: {
      action: string
      instance?: Partial<Instance>
      instanceId?: string
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const config = await readInstances()

    // ─── Add instance ───────────────────────────────────
    if (body.action === 'add' && body.instance) {
      const { name, url, password } = body.instance
      if (!name || !url || !password) {
        return NextResponse.json({ error: 'Name, URL, and password are required' }, { status: 400 })
      }
      const urlError = validateManagedInstanceUrl(url)
      if (urlError) {
        return NextResponse.json({ error: urlError }, { status: 400 })
      }

      // Normalize URL — strip trailing slash
      const normalizedUrl = url.replace(/\/+$/, '')

      const inst: Instance = {
        id: `inst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        url: normalizedUrl,
        password: encryptSecretValue(password),
        enabled: true,
        color: body.instance.color || INSTANCE_COLORS[config.instances.length % INSTANCE_COLORS.length],
        addedAt: new Date().toISOString(),
      }

      // Test connectivity before adding
      const probed = await probeInstance(inst)
      config.instances.push(probed)
      await writeInstances(config)

      const { password: _pw, ...safe } = probed
      return NextResponse.json({ ok: true, instance: safe })
    }

    // ─── Update instance ────────────────────────────────
    if (body.action === 'update' && body.instanceId && body.instance) {
      const idx = config.instances.findIndex(i => i.id === body.instanceId)
      if (idx === -1) return NextResponse.json({ error: 'Instance not found' }, { status: 404 })

      const updates = body.instance
      if (updates.name) config.instances[idx].name = updates.name
      if (updates.url) {
        const urlError = validateManagedInstanceUrl(updates.url)
        if (urlError) {
          return NextResponse.json({ error: urlError }, { status: 400 })
        }
        config.instances[idx].url = updates.url.replace(/\/+$/, '')
      }
      if (updates.password) config.instances[idx].password = encryptSecretValue(updates.password)
      if (updates.color) config.instances[idx].color = updates.color
      if (typeof updates.enabled === 'boolean') config.instances[idx].enabled = updates.enabled

      await writeInstances(config)
      const { password: _pw, ...safe } = config.instances[idx]
      return NextResponse.json({ ok: true, instance: safe })
    }

    // ─── Delete instance ────────────────────────────────
    if (body.action === 'delete' && body.instanceId) {
      config.instances = config.instances.filter(i => i.id !== body.instanceId)
      await writeInstances(config)
      return NextResponse.json({ ok: true })
    }

    // ─── Toggle enable/disable ──────────────────────────
    if (body.action === 'toggle' && body.instanceId) {
      const inst = config.instances.find(i => i.id === body.instanceId)
      if (!inst) return NextResponse.json({ error: 'Instance not found' }, { status: 404 })
      inst.enabled = !inst.enabled
      await writeInstances(config)
      const { password: _pw, ...safe } = inst
      return NextResponse.json({ ok: true, instance: safe })
    }

    // ─── Test connection ────────────────────────────────
    if (body.action === 'test' && body.instanceId) {
      const inst = config.instances.find(i => i.id === body.instanceId)
      if (!inst) return NextResponse.json({ error: 'Instance not found' }, { status: 404 })

      const probed = await probeInstance(inst)
      const idx = config.instances.findIndex(i => i.id === body.instanceId)
      config.instances[idx] = probed
      await writeInstances(config)

      const { password: _pw, ...safe } = probed
      return NextResponse.json({ ok: true, instance: safe })
    }

    // ─── Test a new connection (before adding) ──────────
    if (body.action === 'test-new' && body.instance) {
      const { url, password } = body.instance
      if (!url || !password) {
        return NextResponse.json({ error: 'URL and password are required' }, { status: 400 })
      }
      const urlError = validateManagedInstanceUrl(url)
      if (urlError) {
        return NextResponse.json({ error: urlError }, { status: 400 })
      }

      const temp: Instance = {
        id: 'test',
        name: 'Test',
        url: url.replace(/\/+$/, ''),
        password: encryptSecretValue(password),
        enabled: true,
        color: '#888',
        addedAt: new Date().toISOString(),
      }

      const probed = await probeInstance(temp)
      return NextResponse.json({
        ok: probed.status === 'online',
        status: probed.status,
        health: probed.health,
        statusMessage: probed.statusMessage,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to save instance') },
      { status: 500 }
    )
  }
}

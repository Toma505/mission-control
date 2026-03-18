/**
 * Server-side OpenClaw API client.
 * Talks to the OpenClaw gateway via the /setup/api proxy endpoints.
 * All secrets stay server-side — never exposed to the browser.
 */

import { getEffectiveConfig, isAppConfigured } from './connection-config'

// ─── Response cache (avoids burning tokens on every refresh) ─────
const cache = new Map<string, { data: any; expires: number }>()
const CACHE_TTL = 30_000 // 30 seconds

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() < entry.expires) return entry.data as T
  return null
}

function setCache(key: string, data: any) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL })
}

async function getAuth(): Promise<{ url: string; header: string }> {
  const config = await getEffectiveConfig()
  return {
    url: config.openclawUrl,
    header: 'Basic ' + Buffer.from(':' + config.setupPassword).toString('base64'),
  }
}

async function setupFetch(path: string, options?: RequestInit): Promise<Response> {
  const { url, header } = await getAuth()
  return fetch(`${url}/setup/api${path}`, {
    ...options,
    headers: {
      Authorization: header,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    cache: 'no-store',
  })
}

export async function runCommand(cmd: string, arg?: string): Promise<{ ok: boolean; output?: string; error?: string }> {
  const res = await setupFetch('/console/run', {
    method: 'POST',
    body: JSON.stringify({ cmd, arg: arg || '' }),
  })
  return res.json()
}

// ─── Public API ─────────────────────────────────────────────

export async function getOpenClawStatus(): Promise<{
  configured: boolean
  gatewayTarget: string
  openclawVersion: string
}> {
  const res = await setupFetch('/status')
  if (!res.ok) throw new Error(`OpenClaw status fetch failed: ${res.status}`)
  return res.json()
}

export async function getOpenClawHealth(): Promise<string> {
  const cached = getCached<string>('health')
  if (cached !== null) return cached
  const result = await runCommand('openclaw.health')
  if (!result.ok) throw new Error(result.error || 'Health check failed')
  const output = result.output || ''
  setCache('health', output)
  return output
}

export async function getOpenClawSystemStatus(): Promise<string> {
  const cached = getCached<string>('systemStatus')
  if (cached !== null) return cached
  const result = await runCommand('openclaw.status')
  if (!result.ok) throw new Error(result.error || 'Status check failed')
  const output = result.output || ''
  setCache('systemStatus', output)
  return output
}

export async function getOpenClawConfig(): Promise<{
  ok: boolean
  path: string
  exists: boolean
  content: string
}> {
  const cached = getCached<any>('config')
  if (cached !== null) return cached
  const res = await setupFetch('/config/raw')
  if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`)
  const data = await res.json()
  setCache('config', data)
  return data
}

export async function getOpenClawVersion(): Promise<string> {
  const result = await runCommand('openclaw.version')
  if (!result.ok) throw new Error(result.error || 'Version check failed')
  return result.output?.trim() || 'Unknown'
}

export async function getOpenClawLogs(lines: number = 50): Promise<string> {
  const result = await runCommand('openclaw.logs.tail', String(lines))
  if (!result.ok) throw new Error(result.error || 'Log fetch failed')
  return result.output || ''
}

export async function getOpenClawPlugins(): Promise<string> {
  const result = await runCommand('openclaw.plugins.list')
  if (!result.ok) throw new Error(result.error || 'Plugin list failed')
  return result.output || ''
}

export async function getOpenClawDevices(): Promise<string> {
  const result = await runCommand('openclaw.devices.list')
  if (!result.ok) throw new Error(result.error || 'Device list failed')
  return result.output || ''
}

// ─── Parsed helpers ─────────────────────────────────────────

export interface ParsedStatus {
  version: string
  gateway: string
  agents: string
  sessions: string
  channels: string
  heartbeat: string
  memory: string
  update: string
}

export function parseStatusOutput(raw: string): ParsedStatus {
  const get = (label: string): string => {
    const regex = new RegExp(`│\\s*${label}\\s*│\\s*(.+?)\\s*│`, 'i')
    const match = raw.match(regex)
    return match ? match[1].trim() : ''
  }

  return {
    version: get('Channel'),
    gateway: get('Gateway'),
    agents: get('Agents'),
    sessions: get('Sessions'),
    channels: '',
    heartbeat: get('Heartbeat'),
    memory: get('Memory'),
    update: get('Update'),
  }
}

export interface ParsedHealth {
  discord: { status: string; botName: string; latency: string }
  agents: string
  heartbeat: string
  sessions: { key: string; age: string }[]
}

export function parseHealthOutput(raw: string): ParsedHealth {
  const discordMatch = raw.match(/Discord:\s*(\w+)\s*\((@\w+)\)\s*\((\d+ms)\)/)
  const agentsMatch = raw.match(/Agents:\s*(.+)/)
  const heartbeatMatch = raw.match(/Heartbeat interval:\s*(.+)/)

  const sessions: { key: string; age: string }[] = []
  const sessionRegex = /- (agent:\S+)\s+\((\d+m) ago\)/g
  let m
  while ((m = sessionRegex.exec(raw)) !== null) {
    sessions.push({ key: m[1], age: m[2] + ' ago' })
  }

  return {
    discord: {
      status: discordMatch?.[1] || 'unknown',
      botName: discordMatch?.[2] || 'unknown',
      latency: discordMatch?.[3] || 'unknown',
    },
    agents: agentsMatch?.[1] || 'unknown',
    heartbeat: heartbeatMatch?.[1] || 'unknown',
    sessions,
  }
}

export async function isConfigured(): Promise<boolean> {
  return isAppConfigured()
}

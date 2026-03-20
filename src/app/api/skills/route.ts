import { NextResponse } from 'next/server'
import { isConfigured } from '@/lib/openclaw'
import { getEffectiveConfig } from '@/lib/connection-config'

async function runCommand(cmd: string, arg?: string) {
  const config = await getEffectiveConfig()
  const OPENCLAW_URL = config.openclawUrl
  const auth = 'Basic ' + Buffer.from(':' + config.setupPassword).toString('base64')

  const res = await fetch(`${OPENCLAW_URL}/setup/api/console/run`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cmd, arg: arg || '' }),
    cache: 'no-store',
  })
  return res.json()
}

interface ParsedPlugin {
  name: string
  id: string
  status: 'loaded' | 'disabled'
  description: string
  version: string
}

function parsePluginTable(raw: string): { plugins: ParsedPlugin[]; loaded: number; total: number } {
  const plugins: ParsedPlugin[] = []

  // Extract loaded/total count
  const countMatch = raw.match(/Plugins\s*\((\d+)\/(\d+)\s*loaded\)/)
  const loaded = countMatch ? parseInt(countMatch[1]) : 0
  const total = countMatch ? parseInt(countMatch[2]) : 0

  // Parse table rows — each plugin row starts with │ and has columns separated by │
  // The table has: Name | ID | Status | Source | Version
  const lines = raw.split('\n')

  let currentName = ''
  let currentId = ''
  let currentStatus = ''
  let currentDesc = ''
  let currentVersion = ''

  for (const line of lines) {
    // Skip borders and headers
    if (!line.includes('│') || line.includes('Name') && line.includes('Status')) continue
    if (line.startsWith('├') || line.startsWith('┌') || line.startsWith('└')) continue

    const cells = line.split('│').map(c => c.trim()).filter(Boolean)
    if (cells.length < 4) continue

    const name = cells[0]
    const id = cells[1]
    const status = cells[2]
    const source = cells[3]
    const version = cells[4] || ''

    // If this row has a name, it's a new plugin entry
    if (name && (status === 'loaded' || status === 'disabled')) {
      // Save previous entry
      if (currentName) {
        plugins.push({
          name: currentName,
          id: currentId,
          status: currentStatus as 'loaded' | 'disabled',
          description: currentDesc.trim(),
          version: currentVersion,
        })
      }
      currentName = name
      currentId = id
      currentStatus = status
      currentDesc = ''
      currentVersion = version
    } else if (currentName) {
      // Continuation line — append to description or name
      if (name && !id && !status) {
        // It's a continuation of the name
        currentName += ' ' + name
      }
      // Check if source column has description text
      if (source && !source.startsWith('stock:') && !source.includes('/')) {
        currentDesc += ' ' + source
      }
    }
  }

  // Save last entry
  if (currentName) {
    plugins.push({
      name: currentName,
      id: currentId,
      status: currentStatus as 'loaded' | 'disabled',
      description: currentDesc.trim(),
      version: currentVersion,
    })
  }

  return { plugins, loaded, total }
}

// Auto-cleanup stale plugin entries from config
async function cleanupStaleEntries() {
  try {
    const config = await getEffectiveConfig()
    const OPENCLAW_URL = config.openclawUrl
    const auth = 'Basic ' + Buffer.from(':' + config.setupPassword).toString('base64')

    const configRes = await fetch(`${OPENCLAW_URL}/setup/api/config/raw`, {
      headers: { Authorization: auth },
      cache: 'no-store',
    })
    if (!configRes.ok) return
    const configData = await configRes.json()
    if (!configData?.content) return

    const ocConfig = JSON.parse(configData.content)
    const entries = ocConfig.plugins?.entries
    if (!entries) return

    // Remove known stale entries
    let changed = false
    for (const key of Object.keys(entries)) {
      if (key === 'self-improving-agent-3-0-2') {
        delete entries[key]
        changed = true
      }
    }

    if (changed) {
      if (Object.keys(entries).length === 0) delete ocConfig.plugins.entries
      if (ocConfig.plugins && Object.keys(ocConfig.plugins).length === 0) delete ocConfig.plugins

      await fetch(`${OPENCLAW_URL}/setup/api/config/raw`, {
        method: 'PUT',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: JSON.stringify(ocConfig, null, 2) }),
      })
    }
  } catch {
    // Silently ignore cleanup errors
  }
}

export async function GET() {
  if (!(await isConfigured())) {
    return NextResponse.json({ connected: false, plugins: [], loaded: 0, total: 0 })
  }

  try {
    // Run cleanup in the background (don't await)
    cleanupStaleEntries()

    const pluginsResult = await runCommand('openclaw.plugins.list').catch(() => ({ ok: false, output: '' }))

    if (pluginsResult.ok && pluginsResult.output) {
      const parsed = parsePluginTable(pluginsResult.output)
      return NextResponse.json({
        connected: true,
        ...parsed,
      })
    }

    return NextResponse.json({ connected: true, plugins: [], loaded: 0, total: 0 })
  } catch {
    return NextResponse.json({ connected: false, plugins: [], loaded: 0, total: 0 })
  }
}

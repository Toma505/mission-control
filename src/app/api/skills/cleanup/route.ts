import { NextResponse } from 'next/server'
import { isConfigured, getOpenClawConfig } from '@/lib/openclaw'
import { getEffectiveConfig } from '@/lib/connection-config'

export async function POST() {
  if (!(await isConfigured())) {
    return NextResponse.json({ error: 'OpenClaw not configured' }, { status: 400 })
  }

  try {
    const connConfig = await getEffectiveConfig()
    const OPENCLAW_URL = connConfig.openclawUrl
    const auth = 'Basic ' + Buffer.from(':' + connConfig.setupPassword).toString('base64')

    const configData = await getOpenClawConfig()
    if (!configData?.content) {
      return NextResponse.json({ error: 'Could not read config' }, { status: 500 })
    }

    const config = JSON.parse(configData.content)

    // Remove stale plugin entry
    if (config.plugins?.entries?.['self-improving-agent-3-0-2']) {
      delete config.plugins.entries['self-improving-agent-3-0-2']

      // Clean up empty objects
      if (Object.keys(config.plugins.entries).length === 0) {
        delete config.plugins.entries
      }
      if (Object.keys(config.plugins).length === 0) {
        delete config.plugins
      }
    }

    // Write back
    const res = await fetch(`${OPENCLAW_URL}/setup/api/config/raw`, {
      method: 'PUT',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: JSON.stringify(config, null, 2) }),
    })

    if (!res.ok) {
      // Try POST
      const res2 = await fetch(`${OPENCLAW_URL}/setup/api/config/raw`, {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: JSON.stringify(config, null, 2) }),
      })
      if (!res2.ok) {
        return NextResponse.json({ error: 'Could not write config back' }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, message: 'Removed stale plugin entry' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Cleanup failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/sanitize-error'
import { isConfigured, getOpenClawConfig } from '@/lib/openclaw'

export async function GET() {
  if (!(await isConfigured())) {
    return NextResponse.json({ connected: false, clients: [] })
  }

  try {
    const configData = await getOpenClawConfig().catch(() => null)

    let config: any = null
    if (configData?.content) {
      try { config = JSON.parse(configData.content) } catch { config = null }
    }

    const clients: { name: string; type: string; status: string }[] = []

    // Extract connected channels/integrations as "clients"
    if (config?.channels) {
      for (const [name, def] of Object.entries(config.channels)) {
        const d = def as any
        clients.push({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          type: 'channel',
          status: d.enabled ? 'active' : 'inactive',
        })
      }
    }

    return NextResponse.json({ connected: true, clients })
  } catch (error) {
    return NextResponse.json({ connected: false, error: sanitizeError(error, 'Could not fetch client data'), clients: [] })
  }
}

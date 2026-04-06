import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { sanitizeError } from '@/lib/sanitize-error'
import { isConfigured, getOpenClawConfig } from '@/lib/openclaw'
import { DATA_DIR } from '@/lib/connection-config'
import { isLegacyDemoClients } from '@/lib/legacy-demo-data'

async function readLocalClients() {
  try {
    const text = await readFile(path.join(DATA_DIR, 'clients.json'), 'utf-8')
    const data = JSON.parse(text)
    const clients = Array.isArray(data) ? data : []
    return isLegacyDemoClients(clients) ? [] : clients
  } catch { return [] }
}

export async function GET() {
  if (!(await isConfigured())) {
    const clients = await readLocalClients()
    return NextResponse.json({ connected: false, clients })
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

    const localClients = await readLocalClients()
    const finalClients = clients.length > localClients.length ? clients : localClients.length > 0 ? localClients : clients
    return NextResponse.json({ connected: true, clients: finalClients })
  } catch (error) {
    const clients = await readLocalClients()
    return NextResponse.json({ connected: false, error: sanitizeError(error, 'Could not fetch client data'), clients })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { DATA_DIR } from '@/lib/connection-config'
import { isAuthorized } from '@/lib/api-auth'

const WEBHOOKS_FILE = path.join(DATA_DIR, 'webhooks.json')

export interface WebhookConfig {
  id: string
  name: string
  url: string
  type: 'slack' | 'discord' | 'generic'
  events: string[]
  enabled: boolean
  createdAt: string
  lastFired?: string
  lastStatus?: number
}

const VALID_EVENTS = [
  'alert.triggered',
  'budget.exceeded',
  'budget.warning',
  'agent.offline',
  'mode.changed',
  'throttle.activated',
]

async function readWebhooks(): Promise<WebhookConfig[]> {
  try {
    const text = await readFile(WEBHOOKS_FILE, 'utf-8')
    return JSON.parse(text)
  } catch {
    return []
  }
}

async function writeWebhooks(webhooks: WebhookConfig[]) {
  await mkdir(path.dirname(WEBHOOKS_FILE), { recursive: true })
  await writeFile(WEBHOOKS_FILE, JSON.stringify(webhooks, null, 2))
}

function formatSlackPayload(event: string, message: string) {
  const emoji = event.includes('budget') ? ':money_with_wings:' : event.includes('agent') ? ':robot_face:' : ':bell:'
  return {
    text: `${emoji} *Mission Control* — ${message}`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `${emoji} *Mission Control Alert*\n${message}` },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Event: \`${event}\` · ${new Date().toLocaleString()}` }],
      },
    ],
  }
}

function formatDiscordPayload(event: string, message: string) {
  const color = event.includes('exceeded') ? 0xef4444 : event.includes('warning') ? 0xf59e0b : 0x3b82f6
  return {
    embeds: [{
      title: 'Mission Control Alert',
      description: message,
      color,
      footer: { text: `Event: ${event}` },
      timestamp: new Date().toISOString(),
    }],
  }
}

function formatGenericPayload(event: string, message: string) {
  return {
    event,
    message,
    source: 'mission-control',
    timestamp: new Date().toISOString(),
  }
}

/** Fire a webhook for a given event */
export async function fireWebhooks(event: string, message: string) {
  const webhooks = await readWebhooks()
  const matching = webhooks.filter(w => w.enabled && w.events.includes(event))

  for (const webhook of matching) {
    let payload: unknown
    switch (webhook.type) {
      case 'slack':
        payload = formatSlackPayload(event, message)
        break
      case 'discord':
        payload = formatDiscordPayload(event, message)
        break
      default:
        payload = formatGenericPayload(event, message)
    }

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      webhook.lastFired = new Date().toISOString()
      webhook.lastStatus = res.status
    } catch {
      webhook.lastFired = new Date().toISOString()
      webhook.lastStatus = 0
    }
  }

  if (matching.length > 0) {
    await writeWebhooks(webhooks)
  }
}

/** GET /api/webhooks — list all webhook configs */
export async function GET() {
  const webhooks = await readWebhooks()
  return NextResponse.json({ webhooks, events: VALID_EVENTS })
}

/** POST /api/webhooks — create, update, delete, toggle, or test a webhook */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { action } = body

  if (action === 'create') {
    const { name, url, type, events } = body
    if (!url || !name) {
      return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 })
    }

    const webhooks = await readWebhooks()
    const webhook: WebhookConfig = {
      id: crypto.randomBytes(8).toString('hex'),
      name,
      url,
      type: type || 'generic',
      events: (events || []).filter((e: string) => VALID_EVENTS.includes(e)),
      enabled: true,
      createdAt: new Date().toISOString(),
    }
    webhooks.push(webhook)
    await writeWebhooks(webhooks)
    return NextResponse.json({ ok: true, webhook })
  }

  if (action === 'toggle') {
    const webhooks = await readWebhooks()
    const webhook = webhooks.find(w => w.id === body.webhookId)
    if (!webhook) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    webhook.enabled = !webhook.enabled
    await writeWebhooks(webhooks)
    return NextResponse.json({ ok: true, webhook })
  }

  if (action === 'delete') {
    let webhooks = await readWebhooks()
    webhooks = webhooks.filter(w => w.id !== body.webhookId)
    await writeWebhooks(webhooks)
    return NextResponse.json({ ok: true })
  }

  if (action === 'test') {
    const webhooks = await readWebhooks()
    const webhook = webhooks.find(w => w.id === body.webhookId)
    if (!webhook) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let payload: unknown
    switch (webhook.type) {
      case 'slack':
        payload = formatSlackPayload('test', 'This is a test notification from Mission Control.')
        break
      case 'discord':
        payload = formatDiscordPayload('test', 'This is a test notification from Mission Control.')
        break
      default:
        payload = formatGenericPayload('test', 'This is a test notification from Mission Control.')
    }

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      webhook.lastFired = new Date().toISOString()
      webhook.lastStatus = res.status
      await writeWebhooks(webhooks)
      return NextResponse.json({ ok: true, status: res.status })
    } catch (err) {
      return NextResponse.json({ ok: false, error: 'Request failed' }, { status: 502 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

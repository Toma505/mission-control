import { NextResponse } from 'next/server'
import { getEffectiveConfig } from '@/lib/connection-config'

async function getAuth() {
  const config = await getEffectiveConfig()
  return {
    url: config.openclawUrl,
    header: 'Basic ' + Buffer.from(':' + config.setupPassword).toString('base64'),
  }
}

const MODES = {
  best: {
    label: 'Best',
    description: 'Premium quality — Opus 4.6 for everything',
    model: {
      primary: 'anthropic/claude-opus-4-6',
      fallbacks: ['openrouter/google/gemini-3.1-pro'],
    },
  },
  standard: {
    label: 'Standard',
    description: 'Balanced — Sonnet 4.6 with Gemini fallback',
    model: {
      primary: 'anthropic/claude-sonnet-4-6',
      fallbacks: ['openrouter/google/gemini-3.1-pro'],
    },
  },
  budget: {
    label: 'Budget',
    description: 'Save 80%+ — Deepseek & nano models',
    model: {
      primary: 'openrouter/deepseek/deepseek-chat-v3-0324',
      fallbacks: ['openrouter/openai/gpt-4.1-nano', 'openrouter/google/gemini-2.5-flash'],
    },
  },
  auto: {
    label: 'Auto',
    description: 'Smart per-task routing — prompt decides the model',
    model: {
      primary: 'anthropic/claude-sonnet-4-6',
      fallbacks: ['openrouter/google/gemini-3.1-pro', 'openrouter/deepseek/deepseek-chat-v3-0324'],
    },
  },
} as const

type ModeName = keyof typeof MODES

function detectMode(config: Record<string, unknown>): ModeName {
  const agents = config.agents as Record<string, unknown> | undefined
  const defaults = agents?.defaults as Record<string, unknown> | undefined
  const model = defaults?.model as Record<string, unknown> | undefined
  const primary = model?.primary as string | undefined

  if (!primary) return 'standard'
  if (primary.includes('anthropic/claude-opus')) return 'best'
  if (primary.includes('zhipu/glm-5') && !primary.includes('turbo')) return 'budget'
  if (primary.includes('moonshot/') || primary.includes('deepseek/')) return 'budget'

  // Auto and Standard both use Sonnet — check fallbacks to distinguish
  if (primary.includes('anthropic/claude-sonnet')) {
    const fallbacks = model?.fallbacks as string[] | undefined
    if (fallbacks && fallbacks.length >= 2) return 'auto'
    return 'standard'
  }

  if (primary.includes('openrouter/')) return 'budget'
  return 'standard'
}

export async function GET() {
  const { url: OPENCLAW_URL, header } = await getAuth()
  if (!OPENCLAW_URL) {
    return NextResponse.json({ connected: false, mode: 'best', modes: MODES })
  }

  try {
    const res = await fetch(`${OPENCLAW_URL}/setup/api/config/raw`, {
      headers: { Authorization: header },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error('Config fetch failed')
    const data = await res.json()
    const config = JSON.parse(data.content)
    const mode = detectMode(config)
    const agents = config.agents as Record<string, unknown>
    const defaults = agents?.defaults as Record<string, unknown>
    const model = defaults?.model as Record<string, unknown>

    return NextResponse.json({
      connected: true,
      mode,
      currentModel: model?.primary || 'unknown',
      modes: MODES,
    })
  } catch {
    return NextResponse.json({ connected: false, mode: 'best', modes: MODES })
  }
}

export async function POST(request: Request) {
  const { url: OPENCLAW_URL, header } = await getAuth()
  if (!OPENCLAW_URL) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  try {
    const { mode } = (await request.json()) as { mode: string }
    if (!MODES[mode as ModeName]) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    }

    const selectedMode = MODES[mode as ModeName]

    // Fetch current config
    const configRes = await fetch(`${OPENCLAW_URL}/setup/api/config/raw`, {
      headers: { Authorization: header },
      cache: 'no-store',
    })
    if (!configRes.ok) throw new Error('Config fetch failed')
    const configData = await configRes.json()
    const config = JSON.parse(configData.content)

    // Update model — only write fields OpenClaw expects (primary + fallbacks)
    if (!config.agents) config.agents = {}
    if (!config.agents.defaults) config.agents.defaults = {}
    config.agents.defaults.model = { ...selectedMode.model }
    if (!config.meta) config.meta = {}
    config.meta.lastTouchedAt = new Date().toISOString()

    // Save config
    const saveRes = await fetch(`${OPENCLAW_URL}/setup/api/config/raw`, {
      method: 'POST',
      headers: { Authorization: header, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: JSON.stringify(config, null, 2) }),
    })
    if (!saveRes.ok) {
      const errBody = await saveRes.text().catch(() => 'no body')
      throw new Error(`Config save failed (${saveRes.status}): ${errBody}`)
    }

    return NextResponse.json({
      ok: true,
      mode,
      currentModel: selectedMode.model.primary,
    })
  } catch (error) {
    // Sanitize internal errors — don't leak raw HTML or server details to the client
    let message = 'Could not update the AI mode'
    if (error instanceof Error) {
      if (error.message.includes('Config fetch failed')) {
        message = 'Could not read config from OpenClaw. Make sure the instance is running.'
      } else if (error.message.includes('Config save failed')) {
        message = 'Could not save config to OpenClaw. The server may be temporarily unavailable.'
      } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        message = 'Could not reach OpenClaw. Check your connection settings.'
      }
    }
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

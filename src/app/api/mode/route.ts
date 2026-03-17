import { NextResponse } from 'next/server'

const OPENCLAW_URL = process.env.OPENCLAW_API_URL || ''
const OPENCLAW_PASSWORD = process.env.OPENCLAW_SETUP_PASSWORD || ''

function authHeader(): string {
  return 'Basic ' + Buffer.from(':' + OPENCLAW_PASSWORD).toString('base64')
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
    description: 'Save 80%+ — GLM-5 & open-source models',
    model: {
      primary: 'openrouter/zhipu/glm-5',
      fallbacks: ['openrouter/moonshot/kimi-k2.5', 'openrouter/openai/gpt-4.1-mini'],
    },
  },
  auto: {
    label: 'Auto',
    description: 'Smart per-task routing — prompt decides the model',
    model: {
      primary: 'anthropic/claude-sonnet-4-6',
      fallbacks: ['openrouter/google/gemini-3.1-pro', 'openrouter/zhipu/glm-5-turbo'],
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
  if (!OPENCLAW_URL || !OPENCLAW_PASSWORD) {
    return NextResponse.json({ connected: false, mode: 'best', modes: MODES })
  }

  try {
    const res = await fetch(`${OPENCLAW_URL}/setup/api/config/raw`, {
      headers: { Authorization: authHeader() },
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
  if (!OPENCLAW_URL || !OPENCLAW_PASSWORD) {
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
      headers: { Authorization: authHeader() },
      cache: 'no-store',
    })
    if (!configRes.ok) throw new Error('Config fetch failed')
    const configData = await configRes.json()
    const config = JSON.parse(configData.content)

    // Update model — only write fields OpenClaw expects (primary + fallbacks)
    config.agents.defaults.model = { ...selectedMode.model }
    config.meta.lastTouchedAt = new Date().toISOString()

    // Save config
    const saveRes = await fetch(`${OPENCLAW_URL}/setup/api/config/raw`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

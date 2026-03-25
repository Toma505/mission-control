import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { DATA_DIR, getEffectiveConfig } from '@/lib/connection-config'
import { isAuthorized } from '@/lib/api-auth'

const PRESETS_FILE = path.join(DATA_DIR, 'model-presets.json')

export interface ModelPreset {
  id: string
  name: string
  description: string
  model: string
  fallbacks: string[]
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  isBuiltIn: boolean
  createdAt: string
}

const BUILT_IN_PRESETS: ModelPreset[] = [
  {
    id: 'preset-fast-cheap',
    name: 'Fast & Cheap',
    description: 'Optimized for speed and low cost. Great for simple tasks and high-volume operations.',
    model: 'deepseek/deepseek-chat-v3-0324',
    fallbacks: ['google/gemini-2.0-flash-001', 'openai/gpt-4o-mini'],
    isBuiltIn: true,
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'preset-balanced',
    name: 'Balanced',
    description: 'Good balance between quality, speed, and cost. Recommended for most workloads.',
    model: 'anthropic/claude-sonnet-4-6',
    fallbacks: ['openai/gpt-4o', 'google/gemini-2.5-pro-preview-06-05'],
    isBuiltIn: true,
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'preset-max-quality',
    name: 'Maximum Quality',
    description: 'Best available models for complex reasoning, analysis, and creative work.',
    model: 'anthropic/claude-opus-4-6',
    fallbacks: ['openai/o3', 'google/gemini-2.5-pro-preview-06-05'],
    isBuiltIn: true,
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'preset-code-expert',
    name: 'Code Expert',
    description: 'Tuned for software engineering — code generation, review, and debugging.',
    model: 'anthropic/claude-sonnet-4-6',
    fallbacks: ['deepseek/deepseek-chat-v3-0324', 'openai/gpt-4o'],
    isBuiltIn: true,
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'preset-long-context',
    name: 'Long Context',
    description: 'Models with large context windows for processing long documents or codebases.',
    model: 'google/gemini-2.5-pro-preview-06-05',
    fallbacks: ['anthropic/claude-sonnet-4-6', 'openai/gpt-4o'],
    isBuiltIn: true,
    createdAt: '2025-01-01T00:00:00Z',
  },
]

async function readPresets(): Promise<ModelPreset[]> {
  try {
    const text = await readFile(PRESETS_FILE, 'utf-8')
    const custom: ModelPreset[] = JSON.parse(text)
    return [...BUILT_IN_PRESETS, ...custom]
  } catch {
    return [...BUILT_IN_PRESETS]
  }
}

async function writeCustomPresets(presets: ModelPreset[]) {
  await mkdir(path.dirname(PRESETS_FILE), { recursive: true })
  const custom = presets.filter(p => !p.isBuiltIn)
  await writeFile(PRESETS_FILE, JSON.stringify(custom, null, 2))
}

export async function GET() {
  const presets = await readPresets()
  return NextResponse.json({ presets })
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { action } = body

  if (action === 'create') {
    const { name, description, model, fallbacks, temperature, maxTokens, systemPrompt } = body
    if (!name || !model) {
      return NextResponse.json({ error: 'Name and model are required' }, { status: 400 })
    }

    const preset: ModelPreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      description: description || '',
      model,
      fallbacks: fallbacks || [],
      temperature,
      maxTokens,
      systemPrompt,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    }

    const all = await readPresets()
    all.push(preset)
    await writeCustomPresets(all)
    return NextResponse.json({ ok: true, preset })
  }

  if (action === 'delete') {
    const { presetId } = body
    const all = await readPresets()
    const target = all.find(p => p.id === presetId)
    if (!target) return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    if (target.isBuiltIn) return NextResponse.json({ error: 'Cannot delete built-in presets' }, { status: 400 })

    const filtered = all.filter(p => p.id !== presetId)
    await writeCustomPresets(filtered)
    return NextResponse.json({ ok: true })
  }

  if (action === 'apply') {
    const { presetId } = body
    const all = await readPresets()
    const preset = all.find(p => p.id === presetId)
    if (!preset) return NextResponse.json({ error: 'Preset not found' }, { status: 404 })

    // Apply to OpenClaw by updating agent config
    try {
      const effective = await getEffectiveConfig()
      if (!effective.openclawUrl) return NextResponse.json({ error: 'OpenClaw not connected' }, { status: 400 })

      const auth = 'Basic ' + Buffer.from(':' + effective.setupPassword).toString('base64')
      const configRes = await fetch(`${effective.openclawUrl}/setup/api/config/raw`, {
        headers: { Authorization: auth },
        cache: 'no-store',
      })
      if (!configRes.ok) return NextResponse.json({ error: 'Could not read OpenClaw config' }, { status: 502 })

      const configData = await configRes.json()
      const config = JSON.parse(configData.content)
      if (!config.agents) config.agents = {}
      if (!config.agents.defaults) config.agents.defaults = {}
      config.agents.defaults.model = {
        primary: preset.model,
        fallbacks: preset.fallbacks,
      }

      const saveRes = await fetch(`${effective.openclawUrl}/setup/api/config/raw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ content: JSON.stringify(config, null, 2) }),
      })

      if (!saveRes.ok) return NextResponse.json({ error: 'Failed to save config' }, { status: 502 })

      return NextResponse.json({ ok: true, applied: preset.name, model: preset.model })
    } catch {
      return NextResponse.json({ error: 'Failed to apply preset' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

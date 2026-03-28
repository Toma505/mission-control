import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveConfig } from '@/lib/connection-config'
import {
  createTemplateId,
  readTemplateStore,
  sanitizeTemplateList,
  type AgentTemplate,
  writeTemplateStore,
} from '@/lib/agent-templates-store'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { isConfigured } from '@/lib/openclaw'

type CreateOrUpdatePayload = {
  action?: 'save'
  id?: string
  name: string
  description: string
  systemPrompt: string
  recommendedModel: string
  suggestedTools?: string[]
  suggestedPlugins?: string[]
}

type DeletePayload = {
  action: 'delete'
  templateId: string
}

type ClonePayload = {
  action: 'clone'
  templateId: string
}

type DeployPayload = {
  action: 'deploy'
  templateId: string
  agentName?: string
}

function buildTemplatePayload(body: CreateOrUpdatePayload, now: string, existing?: AgentTemplate): AgentTemplate {
  return {
    id: existing?.id || body.id || createTemplateId(),
    name: body.name.trim(),
    description: body.description.trim(),
    systemPrompt: body.systemPrompt.trim(),
    recommendedModel: body.recommendedModel.trim(),
    suggestedTools: sanitizeTemplateList(body.suggestedTools),
    suggestedPlugins: sanitizeTemplateList(body.suggestedPlugins),
    builtIn: existing?.builtIn ?? false,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }
}

function slugifyAgentName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'agent'
}

function ensureAgentName(name: string, existingNames: Set<string>) {
  const base = slugifyAgentName(name)
  if (!existingNames.has(base)) return base

  let index = 2
  while (existingNames.has(`${base}-${index}`)) {
    index += 1
  }

  return `${base}-${index}`
}

async function deployTemplate(template: AgentTemplate, requestedName?: string) {
  const effective = await getEffectiveConfig()
  if (!effective.openclawUrl || !effective.setupPassword) {
    return NextResponse.json({ error: 'OpenClaw not connected' }, { status: 400 })
  }

  const auth = 'Basic ' + Buffer.from(':' + effective.setupPassword).toString('base64')
  const configRes = await fetch(`${effective.openclawUrl}/setup/api/config/raw`, {
    headers: { Authorization: auth },
    cache: 'no-store',
  })

  if (!configRes.ok) {
    return NextResponse.json({ error: 'Could not read OpenClaw config' }, { status: 502 })
  }

  const configData = await configRes.json()
  const config = JSON.parse(configData.content || '{}')
  if (!config.agents) config.agents = {}
  if (!config.agents.agents || typeof config.agents.agents !== 'object') {
    config.agents.agents = {}
  }

  const agentDefs = config.agents.agents as Record<string, unknown>
  const existingNames = new Set(Object.keys(agentDefs))
  const agentName = ensureAgentName(requestedName || template.name, existingNames)

  agentDefs[agentName] = {
    description: template.description,
    system_prompt: template.systemPrompt,
    enabled: true,
    model: {
      primary: template.recommendedModel,
      fallbacks: [],
    },
    meta: {
      source: 'template',
      templateId: template.id,
      suggestedTools: template.suggestedTools,
      suggestedPlugins: template.suggestedPlugins,
      deployedAt: new Date().toISOString(),
    },
  }

  const saveRes = await fetch(`${effective.openclawUrl}/setup/api/config/raw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth,
    },
    body: JSON.stringify({ content: JSON.stringify(config, null, 2) }),
  })

  if (!saveRes.ok) {
    return NextResponse.json({ error: 'Failed to save template deployment' }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    agentName,
    template: template.name,
  })
}

export async function GET() {
  const store = await readTemplateStore()
  const connected = await isConfigured()
  return NextResponse.json({
    templates: store.templates,
    connected,
  })
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json() as CreateOrUpdatePayload | DeletePayload | ClonePayload | DeployPayload
    const store = await readTemplateStore()
    const now = new Date().toISOString()

    if (body.action === 'delete') {
      const existing = store.templates.find((template) => template.id === body.templateId)
      if (!existing) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }
      if (existing.builtIn) {
        return NextResponse.json({ error: 'Built-in templates cannot be deleted' }, { status: 400 })
      }

      store.templates = store.templates.filter((template) => template.id !== body.templateId)
      await writeTemplateStore(store)
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'clone') {
      const source = store.templates.find((template) => template.id === body.templateId)
      if (!source) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }

      const clone: AgentTemplate = {
        ...source,
        id: createTemplateId(),
        name: `${source.name} Copy`,
        builtIn: false,
        createdAt: now,
        updatedAt: now,
      }

      store.templates.unshift(clone)
      await writeTemplateStore(store)
      return NextResponse.json({ ok: true, template: clone })
    }

    if (body.action === 'deploy') {
      const template = store.templates.find((entry) => entry.id === body.templateId)
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }
      return deployTemplate(template, body.agentName)
    }

    if (!body.name?.trim() || !body.systemPrompt?.trim() || !body.recommendedModel?.trim()) {
      return NextResponse.json({ error: 'Name, system prompt, and recommended model are required' }, { status: 400 })
    }

    if (body.id) {
      const existing = store.templates.find((template) => template.id === body.id)
      if (!existing) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }
      const next = buildTemplatePayload(body, now, existing)
      store.templates = store.templates.map((template) => (template.id === body.id ? next : template))
      await writeTemplateStore(store)
      return NextResponse.json({ ok: true, template: next })
    }

    const created = buildTemplatePayload(body, now)
    store.templates.unshift(created)
    await writeTemplateStore(store)
    return NextResponse.json({ ok: true, template: created })
  } catch {
    return NextResponse.json({ error: 'Failed to update templates' }, { status: 500 })
  }
}

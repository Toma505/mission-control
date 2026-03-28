import { NextRequest, NextResponse } from 'next/server'
import {
  buildPromptVersion,
  createPromptId,
  filterPrompts,
  getPromptCategories,
  getPromptTags,
  PROMPTS_FILE,
  readPromptStore,
  type PromptTemplate,
  writePromptStore,
} from '@/lib/prompt-library-store'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'

type SavePayload = {
  action?: 'save'
  id?: string
  name: string
  description?: string
  category?: string
  content: string
  tags?: string[]
}

type DuplicatePayload = {
  action: 'duplicate'
  id: string
}

type ImportPayload = {
  action: 'import'
  prompts: PromptTemplate[]
  mode?: 'replace' | 'merge'
}

function normalizeTags(tags: string[] | undefined) {
  return Array.isArray(tags)
    ? [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]
    : []
}

function buildPromptPayload(body: SavePayload, now: string, existing?: PromptTemplate): PromptTemplate {
  const name = body.name.trim()
  const description = (body.description || '').trim()
  const category = (body.category || 'General').trim() || 'General'
  const content = body.content.trim()
  const tags = normalizeTags(body.tags)
  const version = buildPromptVersion({ name, description, category, content, tags }, now)

  if (existing) {
    const changed =
      existing.name !== name ||
      existing.description !== description ||
      existing.category !== category ||
      existing.content !== content ||
      JSON.stringify(existing.tags) !== JSON.stringify(tags)

    return {
      ...existing,
      name,
      description,
      category,
      content,
      tags,
      variables: version.variables,
      updatedAt: now,
      versions: changed ? [...existing.versions, version] : existing.versions,
    }
  }

  return {
    id: body.id || createPromptId(),
    name,
    description,
    category,
    content,
    tags,
    variables: version.variables,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
    versions: [version],
  }
}

export async function GET(request: NextRequest) {
  const store = await readPromptStore()
  const category = request.nextUrl.searchParams.get('category') || ''
  const tag = request.nextUrl.searchParams.get('tag') || ''
  const search = request.nextUrl.searchParams.get('q') || ''
  const format = request.nextUrl.searchParams.get('format')

  if (format === 'export') {
    return new NextResponse(JSON.stringify(store, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="mission-control-prompts.json"`,
      },
    })
  }

  const prompts = filterPrompts(store.prompts, search, category, tag)

  return NextResponse.json({
    prompts,
    categories: getPromptCategories(store.prompts),
    tags: getPromptTags(store.prompts),
    file: PROMPTS_FILE,
  })
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json() as SavePayload | DuplicatePayload | ImportPayload
    const store = await readPromptStore()
    const now = new Date().toISOString()

    if (body.action === 'duplicate') {
      const source = store.prompts.find((prompt) => prompt.id === body.id)
      if (!source) {
        return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
      }

      const duplicateVersion = buildPromptVersion(
        {
          name: `${source.name} Copy`,
          description: source.description,
          category: source.category,
          content: source.content,
          tags: source.tags,
        },
        now,
      )

      const duplicate: PromptTemplate = {
        ...source,
        id: createPromptId(),
        name: `${source.name} Copy`,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
        versions: [duplicateVersion],
      }

      store.prompts.unshift(duplicate)
      await writePromptStore(store)
      return NextResponse.json({ ok: true, prompt: duplicate })
    }

    if (body.action === 'import') {
      const imported = Array.isArray(body.prompts) ? body.prompts : []
      const normalized = imported.map((prompt) => ({
        ...buildPromptPayload(prompt, prompt.updatedAt || now),
        id: prompt.id || createPromptId(),
        usageCount: Number.isFinite(prompt.usageCount) ? prompt.usageCount : 0,
        createdAt: prompt.createdAt || now,
        updatedAt: prompt.updatedAt || now,
        versions: Array.isArray(prompt.versions) && prompt.versions.length > 0
          ? prompt.versions
          : [buildPromptVersion(prompt, prompt.updatedAt || now)],
      }))
      const nextPrompts = body.mode === 'replace'
        ? normalized
        : [
            ...normalized,
            ...store.prompts.filter(
              (existing) => !normalized.some((incoming) => incoming.id === existing.id),
            ),
          ]

      store.prompts = nextPrompts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      await writePromptStore(store)
      return NextResponse.json({ ok: true, imported: normalized.length })
    }

    if (!body.name?.trim() || !body.content?.trim()) {
      return NextResponse.json({ error: 'name and content required' }, { status: 400 })
    }

    if (body.id) {
      const existing = store.prompts.find((prompt) => prompt.id === body.id)
      if (!existing) {
        return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
      }
      const updated = buildPromptPayload(body, now, existing)
      store.prompts = store.prompts.map((prompt) => (prompt.id === body.id ? updated : prompt))
      await writePromptStore(store)
      return NextResponse.json({ ok: true, prompt: updated })
    }

    const created = buildPromptPayload(body, now)
    store.prompts.unshift(created)
    await writePromptStore(store)
    return NextResponse.json({ ok: true, prompt: created })
  } catch {
    return NextResponse.json({ error: 'Failed to save prompt' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const { id } = await request.json() as { id?: string }
    const store = await readPromptStore()
    const prompt = store.prompts.find((entry) => entry.id === id)
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    prompt.usageCount += 1
    prompt.updatedAt = prompt.updatedAt || new Date().toISOString()
    await writePromptStore(store)
    return NextResponse.json({ ok: true, usageCount: prompt.usageCount })
  } catch {
    return NextResponse.json({ error: 'Failed to update prompt usage' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const { id } = await request.json() as { id?: string }
    const store = await readPromptStore()
    const filtered = store.prompts.filter((prompt) => prompt.id !== id)

    if (filtered.length === store.prompts.length) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    await writePromptStore({ prompts: filtered })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete prompt' }, { status: 500 })
  }
}

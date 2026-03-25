import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'

const PROMPTS_FILE = path.join(DATA_DIR, 'prompt-library.json')

export interface PromptTemplate {
  id: string
  name: string
  description: string
  category: string
  content: string
  variables: string[]
  tags: string[]
  usageCount: number
  createdAt: string
  updatedAt: string
}

async function readPrompts(): Promise<PromptTemplate[]> {
  try {
    const text = await readFile(PROMPTS_FILE, 'utf-8')
    return JSON.parse(text)
  } catch {
    return []
  }
}

async function writePrompts(prompts: PromptTemplate[]) {
  await mkdir(path.dirname(PROMPTS_FILE), { recursive: true })
  await writeFile(PROMPTS_FILE, JSON.stringify(prompts, null, 2))
}

/** GET — list all prompts, optionally filter by category or tag */
export async function GET(request: NextRequest) {
  const prompts = await readPrompts()
  const category = request.nextUrl.searchParams.get('category')
  const tag = request.nextUrl.searchParams.get('tag')
  const search = request.nextUrl.searchParams.get('q')

  let filtered = prompts
  if (category) filtered = filtered.filter(p => p.category === category)
  if (tag) filtered = filtered.filter(p => p.tags.includes(tag))
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q)
    )
  }

  const categories = [...new Set(prompts.map(p => p.category))].sort()
  const allTags = [...new Set(prompts.flatMap(p => p.tags))].sort()

  return NextResponse.json({ prompts: filtered, categories, tags: allTags })
}

/** POST — create or update a prompt */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json()
    const { id, name, description, category, content, tags } = body

    if (!name || !content) {
      return NextResponse.json({ error: 'name and content required' }, { status: 400 })
    }

    // Extract {{variables}} from content
    const varMatches = (content as string).match(/\{\{(\w+)\}\}/g) || []
    const variables: string[] = [...new Set(varMatches.map((v: string) => v.replace(/[{}]/g, '')))]

    const prompts = await readPrompts()
    const now = new Date().toISOString()

    if (id) {
      // Update existing
      const idx = prompts.findIndex(p => p.id === id)
      if (idx === -1) return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
      prompts[idx] = {
        ...prompts[idx],
        name,
        description: description || '',
        category: category || 'General',
        content,
        variables,
        tags: tags || [],
        updatedAt: now,
      }
    } else {
      // Create new
      prompts.push({
        id: `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        description: description || '',
        category: category || 'General',
        content,
        variables,
        tags: tags || [],
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      })
    }

    await writePrompts(prompts)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save prompt' }, { status: 500 })
  }
}

/** PATCH — increment usage count */
export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const { id } = await request.json()
    const prompts = await readPrompts()
    const prompt = prompts.find(p => p.id === id)
    if (!prompt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    prompt.usageCount++
    await writePrompts(prompts)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

/** DELETE — remove a prompt */
export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const { id } = await request.json()
    const prompts = await readPrompts()
    const filtered = prompts.filter(p => p.id !== id)
    if (filtered.length === prompts.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    await writePrompts(filtered)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

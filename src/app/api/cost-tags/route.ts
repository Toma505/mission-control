import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'

const TAGS_FILE = path.join(DATA_DIR, 'cost-tags.json')

export interface CostTag {
  id: string
  name: string
  color: string
  description: string
  createdAt: string
}

export interface TaggedSession {
  sessionKey: string
  tagId: string
  assignedAt: string
  notes?: string
}

interface CostTagsData {
  tags: CostTag[]
  assignments: TaggedSession[]
}

async function readData(): Promise<CostTagsData> {
  try {
    const text = await readFile(TAGS_FILE, 'utf-8')
    return JSON.parse(text)
  } catch {
    return { tags: [], assignments: [] }
  }
}

async function writeData(data: CostTagsData) {
  await mkdir(path.dirname(TAGS_FILE), { recursive: true })
  await writeFile(TAGS_FILE, JSON.stringify(data, null, 2))
}

const TAG_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#f97316', '#ef4444', '#84cc16', '#6366f1',
]

/** GET — list tags and their assignments with cost summaries */
export async function GET() {
  const data = await readData()

  // Build summary per tag
  const summary = data.tags.map(tag => {
    const assigned = data.assignments.filter(a => a.tagId === tag.id)
    return {
      ...tag,
      sessionCount: assigned.length,
      sessions: assigned,
    }
  })

  return NextResponse.json({ tags: summary, assignments: data.assignments })
}

/** POST — create a tag or assign a tag to a session */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json()
    const data = await readData()

    if (body.action === 'assign') {
      // Assign tag to session
      const { tagId, sessionKey, notes } = body
      if (!tagId || !sessionKey) {
        return NextResponse.json({ error: 'tagId and sessionKey required' }, { status: 400 })
      }

      // Remove existing assignment of same tag to same session
      data.assignments = data.assignments.filter(
        a => !(a.tagId === tagId && a.sessionKey === sessionKey)
      )
      data.assignments.push({
        sessionKey,
        tagId,
        assignedAt: new Date().toISOString(),
        notes,
      })

      await writeData(data)
      return NextResponse.json({ ok: true })
    }

    // Create new tag
    const { name, color, description } = body
    if (!name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }

    const tag: CostTag = {
      id: `tag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      color: color || TAG_COLORS[data.tags.length % TAG_COLORS.length],
      description: description || '',
      createdAt: new Date().toISOString(),
    }

    data.tags.push(tag)
    await writeData(data)
    return NextResponse.json({ ok: true, tag })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

/** DELETE — remove a tag or unassign */
export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json()
    const data = await readData()

    if (body.action === 'unassign') {
      data.assignments = data.assignments.filter(
        a => !(a.tagId === body.tagId && a.sessionKey === body.sessionKey)
      )
    } else {
      // Delete tag and all its assignments
      data.tags = data.tags.filter(t => t.id !== body.id)
      data.assignments = data.assignments.filter(a => a.tagId !== body.id)
    }

    await writeData(data)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

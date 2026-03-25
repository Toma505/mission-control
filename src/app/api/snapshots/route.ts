import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { DATA_DIR } from '@/lib/connection-config'
import { isAuthorized } from '@/lib/api-auth'

const SNAPSHOTS_FILE = path.join(DATA_DIR, 'config-snapshots.json')

export interface ConfigSnapshot {
  id: string
  name: string
  createdAt: string
  data: {
    budget?: Record<string, unknown>
    mode?: string
    openclawUrl?: string
  }
}

async function readSnapshots(): Promise<ConfigSnapshot[]> {
  try {
    const text = await readFile(SNAPSHOTS_FILE, 'utf-8')
    return JSON.parse(text)
  } catch {
    return []
  }
}

async function writeSnapshots(snapshots: ConfigSnapshot[]) {
  await mkdir(path.dirname(SNAPSHOTS_FILE), { recursive: true })
  await writeFile(SNAPSHOTS_FILE, JSON.stringify(snapshots, null, 2))
}

/** GET /api/snapshots — list all saved config snapshots */
export async function GET() {
  const snapshots = await readSnapshots()
  return NextResponse.json({ snapshots })
}

/** POST /api/snapshots — create, restore, or delete a snapshot */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { action } = body

  if (action === 'create') {
    const { name } = body
    const snapshots = await readSnapshots()

    // Read current config state
    let budget: Record<string, unknown> = {}
    let mode = 'standard'
    let openclawUrl = ''

    try {
      const budgetText = await readFile(path.join(DATA_DIR, 'budget.json'), 'utf-8')
      budget = JSON.parse(budgetText)
    } catch {}

    try {
      const connText = await readFile(path.join(DATA_DIR, 'connection.json'), 'utf-8')
      const conn = JSON.parse(connText)
      openclawUrl = conn.openclawUrl || ''
    } catch {}

    try {
      const modeText = await readFile(path.join(DATA_DIR, 'mode.json'), 'utf-8')
      const modeData = JSON.parse(modeText)
      mode = modeData.mode || 'standard'
    } catch {}

    const snapshot: ConfigSnapshot = {
      id: crypto.randomBytes(8).toString('hex'),
      name: name || `Snapshot ${new Date().toLocaleDateString()}`,
      createdAt: new Date().toISOString(),
      data: { budget, mode, openclawUrl },
    }

    snapshots.push(snapshot)
    await writeSnapshots(snapshots)

    return NextResponse.json({ ok: true, snapshot })
  }

  if (action === 'restore') {
    const { snapshotId } = body
    const snapshots = await readSnapshots()
    const snapshot = snapshots.find(s => s.id === snapshotId)
    if (!snapshot) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    }

    // Restore budget
    if (snapshot.data.budget) {
      await mkdir(DATA_DIR, { recursive: true })
      await writeFile(path.join(DATA_DIR, 'budget.json'), JSON.stringify(snapshot.data.budget, null, 2))
    }

    // Restore mode
    if (snapshot.data.mode) {
      await writeFile(path.join(DATA_DIR, 'mode.json'), JSON.stringify({ mode: snapshot.data.mode }, null, 2))
    }

    return NextResponse.json({ ok: true, restored: snapshot.name })
  }

  if (action === 'delete') {
    const { snapshotId } = body
    let snapshots = await readSnapshots()
    snapshots = snapshots.filter(s => s.id !== snapshotId)
    await writeSnapshots(snapshots)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'
import { isAuthorized } from '@/lib/api-auth'

const AUDIT_FILE = path.join(DATA_DIR, 'audit-log.json')

export interface AuditEntry {
  id: string
  timestamp: string
  action: string
  category: 'mode' | 'budget' | 'config' | 'backup' | 'webhook' | 'alert' | 'license' | 'preset' | 'system'
  details: string
  previous?: string
}

function readLog(): AuditEntry[] {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return []
    return JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function writeLog(entries: AuditEntry[]) {
  fs.mkdirSync(path.dirname(AUDIT_FILE), { recursive: true })
  fs.writeFileSync(AUDIT_FILE, JSON.stringify(entries, null, 2))
}

/** Append a new audit entry — exported for use by other routes */
export function appendAudit(action: string, category: AuditEntry['category'], details: string, previous?: string) {
  const entries = readLog()
  entries.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    action,
    category,
    details,
    previous,
  })
  // Keep last 500 entries
  writeLog(entries.slice(0, 500))
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const limit = parseInt(searchParams.get('limit') || '100', 10)

  let entries = readLog()
  if (category) {
    entries = entries.filter(e => e.category === category)
  }

  return NextResponse.json({ entries: entries.slice(0, limit) })
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  writeLog([])
  return NextResponse.json({ ok: true })
}

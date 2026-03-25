import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'
import { isAuthorized } from '@/lib/api-auth'

const SHORTCUTS_FILE = path.join(DATA_DIR, 'shortcuts.json')

export interface ShortcutBinding {
  id: string
  label: string
  description: string
  keys: string   // e.g. "Ctrl+K", "Ctrl+Shift+B"
  action: string // e.g. "command-palette", "navigate:/costs"
}

const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  { id: 'command-palette', label: 'Command Palette', description: 'Open quick search', keys: 'Ctrl+K', action: 'command-palette' },
  { id: 'nav-dashboard', label: 'Go to Dashboard', description: 'Navigate to dashboard', keys: 'Ctrl+1', action: 'navigate:/' },
  { id: 'nav-costs', label: 'Go to Costs', description: 'Navigate to cost controls', keys: 'Ctrl+2', action: 'navigate:/costs' },
  { id: 'nav-agents', label: 'Go to Agents', description: 'Navigate to agents', keys: 'Ctrl+3', action: 'navigate:/agents' },
  { id: 'nav-alerts', label: 'Go to Alerts', description: 'Navigate to alerts', keys: 'Ctrl+4', action: 'navigate:/alerts' },
  { id: 'nav-analytics', label: 'Go to Analytics', description: 'Navigate to usage analytics', keys: 'Ctrl+5', action: 'navigate:/analytics' },
  { id: 'switch-best', label: 'Switch to Best Mode', description: 'Set AI to highest quality', keys: 'Ctrl+Shift+1', action: 'mode:best' },
  { id: 'switch-budget', label: 'Switch to Budget Mode', description: 'Set AI to lowest cost', keys: 'Ctrl+Shift+2', action: 'mode:budget' },
  { id: 'refresh', label: 'Refresh Data', description: 'Force refresh all data', keys: 'Ctrl+R', action: 'refresh' },
]

function readShortcuts(): ShortcutBinding[] {
  try {
    if (!fs.existsSync(SHORTCUTS_FILE)) return DEFAULT_SHORTCUTS
    const custom = JSON.parse(fs.readFileSync(SHORTCUTS_FILE, 'utf-8')) as ShortcutBinding[]
    // Merge: custom overrides defaults by id, add any new defaults
    const customMap = new Map(custom.map(s => [s.id, s]))
    return DEFAULT_SHORTCUTS.map(d => customMap.get(d.id) || d)
  } catch {
    return DEFAULT_SHORTCUTS
  }
}

function writeShortcuts(shortcuts: ShortcutBinding[]) {
  fs.mkdirSync(path.dirname(SHORTCUTS_FILE), { recursive: true })
  fs.writeFileSync(SHORTCUTS_FILE, JSON.stringify(shortcuts, null, 2))
}

export async function GET() {
  return NextResponse.json({ shortcuts: readShortcuts(), defaults: DEFAULT_SHORTCUTS })
}

export async function PUT(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { shortcuts } = await req.json()
    if (!Array.isArray(shortcuts)) {
      return NextResponse.json({ error: 'Invalid shortcuts array' }, { status: 400 })
    }
    writeShortcuts(shortcuts)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

// Reset to defaults
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  writeShortcuts(DEFAULT_SHORTCUTS)
  return NextResponse.json({ ok: true, shortcuts: DEFAULT_SHORTCUTS })
}

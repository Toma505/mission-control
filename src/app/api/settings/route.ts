import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'

import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { DEFAULT_SETTINGS, normalizeSettings } from '@/lib/app-settings'
import { DATA_DIR } from '@/lib/connection-config'
import { sanitizeError } from '@/lib/sanitize-error'

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')
const DEFAULT_SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')

async function readSeedSettings() {
  try {
    const raw = await readFile(DEFAULT_SETTINGS_FILE, 'utf-8')
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return DEFAULT_SETTINGS
  }
}

async function readSettings() {
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf-8')
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return readSeedSettings()
  }
}

async function writeSettings(settings: unknown) {
  await mkdir(path.dirname(SETTINGS_FILE), { recursive: true })
  await writeFile(SETTINGS_FILE, JSON.stringify(normalizeSettings(settings), null, 2))
}

export async function GET() {
  try {
    return NextResponse.json({ settings: await readSettings() })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to load settings.') },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    await writeSettings(body)
    return NextResponse.json({ ok: true, settings: await readSettings() })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to save settings.') },
      { status: 500 },
    )
  }
}

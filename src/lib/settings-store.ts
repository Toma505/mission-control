import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from '@/lib/app-settings'
import { DATA_DIR } from '@/lib/connection-config'

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')
const DEFAULT_SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')

export async function readSeedSettings(): Promise<Settings> {
  try {
    const raw = await readFile(DEFAULT_SETTINGS_FILE, 'utf-8')
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function readSettings(): Promise<Settings> {
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf-8')
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return readSeedSettings()
  }
}

export async function writeSettings(settings: unknown): Promise<Settings> {
  const normalized = normalizeSettings(settings)
  await mkdir(path.dirname(SETTINGS_FILE), { recursive: true })
  await writeFile(SETTINGS_FILE, JSON.stringify(normalized, null, 2))
  return normalized
}

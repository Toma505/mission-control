import { readFile } from 'fs/promises'
import path from 'path'

import { DATA_DIR } from '@/lib/connection-config'

export type ChangelogEntry = {
  version: string
  date: string
  added: string[]
  improved: string[]
  fixed: string[]
}

type ChangelogStore = {
  entries: ChangelogEntry[]
}

const CHANGELOG_FILE = path.join(DATA_DIR, 'changelog.json')
const DEFAULT_CHANGELOG_FILE = path.join(process.cwd(), 'data', 'changelog.json')

function normalizeEntries(input: unknown): ChangelogEntry[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((entry) => typeof entry === 'object' && entry !== null)
    .map((entry) => {
      const value = entry as Partial<ChangelogEntry>
      return {
        version: String(value.version || '').trim(),
        date: String(value.date || '').trim(),
        added: Array.isArray(value.added) ? value.added.map(String).filter(Boolean) : [],
        improved: Array.isArray(value.improved) ? value.improved.map(String).filter(Boolean) : [],
        fixed: Array.isArray(value.fixed) ? value.fixed.map(String).filter(Boolean) : [],
      }
    })
    .filter((entry) => entry.version && entry.date)
}

export async function readChangelogStore(): Promise<ChangelogStore> {
  for (const filePath of [CHANGELOG_FILE, DEFAULT_CHANGELOG_FILE]) {
    try {
      const raw = JSON.parse(await readFile(filePath, 'utf-8')) as Partial<ChangelogStore> | ChangelogEntry[]
      if (Array.isArray(raw)) {
        return { entries: normalizeEntries(raw) }
      }

      return {
        entries: normalizeEntries(raw.entries),
      }
    } catch {
      // keep going
    }
  }

  return { entries: [] }
}

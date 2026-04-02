import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

import { DATA_DIR } from '@/lib/connection-config'

export interface ChangelogGroups {
  added: string[]
  improved: string[]
  fixed: string[]
}

export interface ChangelogEntry {
  version: string
  date: string
  title: string
  summary: string
  changes: ChangelogGroups
}

const CHANGELOG_FILE = path.join(DATA_DIR, 'changelog.json')
const DEFAULT_CHANGELOG_FILE = path.join(process.cwd(), 'data', 'changelog.json')

function normalizeGroup(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

function normalizeEntry(input: unknown): ChangelogEntry | null {
  if (!input || typeof input !== 'object') return null
  const value = input as Partial<ChangelogEntry> & { changes?: Partial<ChangelogGroups> }
  if (typeof value.version !== 'string' || !value.version.trim()) return null

  return {
    version: value.version.trim(),
    date: typeof value.date === 'string' && value.date ? value.date : new Date().toISOString().slice(0, 10),
    title: typeof value.title === 'string' && value.title ? value.title : `Mission Control ${value.version.trim()}`,
    summary: typeof value.summary === 'string' ? value.summary : '',
    changes: {
      added: normalizeGroup(value.changes?.added),
      improved: normalizeGroup(value.changes?.improved),
      fixed: normalizeGroup(value.changes?.fixed),
    },
  }
}

export function compareVersions(a: string, b: string) {
  const normalize = (value: string) =>
    value
      .replace(/^v/i, '')
      .split('.')
      .map((part) => Number(part) || 0)

  const left = normalize(a)
  const right = normalize(b)
  const maxLength = Math.max(left.length, right.length)

  for (let index = 0; index < maxLength; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) {
      return difference
    }
  }

  return 0
}

function sortEntries(entries: ChangelogEntry[]) {
  return [...entries].sort((a, b) => {
    const versionDifference = compareVersions(b.version, a.version)
    if (versionDifference !== 0) return versionDifference
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })
}

export async function readSeedChangelog(): Promise<ChangelogEntry[]> {
  try {
    const raw = await readFile(DEFAULT_CHANGELOG_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return sortEntries(parsed.map(normalizeEntry).filter((entry): entry is ChangelogEntry => Boolean(entry)))
  } catch {
    return []
  }
}

export async function readChangelogEntries(): Promise<ChangelogEntry[]> {
  try {
    const raw = await readFile(CHANGELOG_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return readSeedChangelog()
    return sortEntries(parsed.map(normalizeEntry).filter((entry): entry is ChangelogEntry => Boolean(entry)))
  } catch {
    return readSeedChangelog()
  }
}

export async function writeChangelogEntries(entries: ChangelogEntry[]) {
  await mkdir(path.dirname(CHANGELOG_FILE), { recursive: true })
  await writeFile(CHANGELOG_FILE, JSON.stringify(sortEntries(entries), null, 2))
}

export async function appendChangelogEntry(input: unknown) {
  const entry = normalizeEntry(input)
  if (!entry) {
    throw new Error('Invalid changelog entry')
  }

  const existing = await readChangelogEntries()
  const deduped = existing.filter((item) => item.version !== entry.version)
  const nextEntries = sortEntries([entry, ...deduped])
  await writeChangelogEntries(nextEntries)
  return nextEntries
}

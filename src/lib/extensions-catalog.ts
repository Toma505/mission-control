import catalog from '../../data/extensions-catalog.json'

export type ExtensionSource = 'openclaw' | 'marketplace' | 'npm'

export interface ExtensionCatalogEntry {
  id: string
  name: string
  description: string
  author: string
  version: string
  category: string
  tags: string[]
  homepage?: string
  npmPackage?: string
}

const catalogEntries = catalog as ExtensionCatalogEntry[]

export function normalizeExtensionKey(value: string) {
  return value.trim().toLowerCase().replace(/^@/, '').replace(/\s+/g, '-')
}

export function getExtensionsCatalog(): ExtensionCatalogEntry[] {
  return [...catalogEntries].sort((a, b) => a.name.localeCompare(b.name))
}

export function findCatalogEntry(entries: ExtensionCatalogEntry[], value: string) {
  const normalized = normalizeExtensionKey(value)
  return entries.find((entry) => {
    const keys = [entry.id, entry.name, entry.npmPackage].filter(Boolean) as string[]
    return keys.some((key) => normalizeExtensionKey(key) === normalized)
  })
}

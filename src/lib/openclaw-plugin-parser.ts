export interface ParsedOpenClawPlugin {
  name: string
  id: string
  version: string
  enabled: boolean
}

function normalizePluginKey(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, '').replace(/\s+/g, '-')
}

function canonicalizeInstalledPluginName(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const stockMatch = trimmed.match(/^stock:([a-z0-9-]+)(?:\/index\.ts)?$/i)
  if (stockMatch) {
    return stockMatch[1].toLowerCase()
  }

  const scopedMatch = trimmed.match(/^@[^/]+\/([a-z0-9-]+)$/i)
  if (scopedMatch) {
    return scopedMatch[1].toLowerCase()
  }

  if (/[\\/_-]$/.test(trimmed)) return null

  const cleaned = trimmed.replace(/[,:;]+$/, '')
  if (!cleaned || cleaned !== cleaned.toLowerCase()) return null
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleaned)) return null

  return cleaned
}

function looksLikeVersion(value: string): boolean {
  return /\d+\.\d+/.test(value) || value === 'unknown'
}

function finalizeParsedPlugins(plugins: ParsedOpenClawPlugin[]): ParsedOpenClawPlugin[] {
  const ignored = new Set(['name', 'id', 'version', 'enabled', 'disabled'])
  const deduped = new Map<string, ParsedOpenClawPlugin>()

  for (const plugin of plugins) {
    const canonicalName = canonicalizeInstalledPluginName(plugin.name)
    if (!canonicalName) continue

    const normalized = normalizePluginKey(canonicalName)
    if (ignored.has(normalized)) continue
    if (deduped.has(normalized)) continue

    deduped.set(normalized, {
      ...plugin,
      id: normalized,
      name: canonicalName,
      version: plugin.version || 'unknown',
    })
  }

  return [...deduped.values()]
}

export function titleCaseFromPluginId(value: string): string {
  return value
    .split(/[-_/]/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function parseOpenClawPlugins(raw: string): {
  plugins: ParsedOpenClawPlugin[]
  loaded: number
  total: number
} {
  const plugins: ParsedOpenClawPlugin[] = []
  const countMatch = raw.match(/Plugins\s*\((\d+)\/(\d+)\s*loaded\)/i)
  const loadedFromHeader = countMatch ? parseInt(countMatch[1], 10) : 0
  const totalFromHeader = countMatch ? parseInt(countMatch[2], 10) : 0

  for (const line of raw.split('\n')) {
    if (!line.includes('|') && !line.includes('│') && !line.includes('â”‚')) continue

    const columns = line
      .split(/\||│|â”‚/)
      .map(part => part.trim())
      .filter(Boolean)

    if (columns.length < 5) continue
    if (/^name$/i.test(columns[0]) && /^id$/i.test(columns[1])) continue

    const sourceColumn = columns[3]
    const idColumn = columns[1]
    const pluginName = canonicalizeInstalledPluginName(sourceColumn) || canonicalizeInstalledPluginName(idColumn)
    if (!pluginName) continue

    const versionColumn = looksLikeVersion(columns[4]) ? columns[4] : 'unknown'
    const enabledColumn = columns[2] || 'enabled'

    plugins.push({
      id: normalizePluginKey(pluginName),
      name: pluginName,
      version: versionColumn,
      enabled: /loaded|enabled|true/i.test(enabledColumn),
    })
  }

  let finalized = finalizeParsedPlugins(plugins)

  if (finalized.length === 0) {
    const listRegex = /[-•â€¢]\s*(\S+)(?:@(\S+))?\s*(?:\((\w+)\))?/g
    let match: RegExpExecArray | null
    while ((match = listRegex.exec(raw)) !== null) {
      finalized.push({
        id: normalizePluginKey(match[1]),
        name: match[1],
        version: match[2] || 'unknown',
        enabled: match[3] !== 'disabled',
      })
    }
    finalized = finalizeParsedPlugins(finalized)
  }

  if (finalized.length === 0) {
    const lines = raw
      .split('\n')
      .map(line => line.trim())
      .filter(line =>
        line &&
        !line.startsWith('â”€') &&
        !line.startsWith('─') &&
        !line.startsWith('=')
      )

    for (const line of lines) {
      const tokens = line.split(/\s+/)
      const nameToken = tokens.find(token => canonicalizeInstalledPluginName(token))
      if (!nameToken) continue

      const versionToken = tokens.find(token => looksLikeVersion(token)) || 'unknown'
      finalized.push({
        id: normalizePluginKey(nameToken),
        name: nameToken,
        version: versionToken,
        enabled: !tokens.some(token => /disabled|false/i.test(token)),
      })
    }
    finalized = finalizeParsedPlugins(finalized)
  }

  return {
    plugins: finalized,
    loaded: loadedFromHeader || finalized.filter(plugin => plugin.enabled).length,
    total: totalFromHeader || finalized.length,
  }
}

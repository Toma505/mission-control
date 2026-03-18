import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { DATA_DIR } from '@/lib/connection-config'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

interface CostRow {
  date: string
  type: string
  cost: number
  model: string
}

interface TokenRow {
  date: string
  model: string
  input: number
  cacheWrite: number
  cacheRead: number
  output: number
}

// ─── Anthropic CSV parsers ──────────────────────────────

function parseAnthropicCostCsv(text: string): CostRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const rows: CostRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 8) continue
    // CSV: usage_date_utc, model, workspace, api_key, usage_type, context_window, token_type, cost_usd
    const date = cols[0]?.trim()
    const model = cols[1]?.trim()
    const tokenType = cols[6]?.trim()
    const cost = parseFloat(cols[7]?.trim() || '0')

    const typeMap: Record<string, string> = {
      input_no_cache: 'Input (no cache)',
      input_cache_read: 'Cache read',
      input_cache_write_5m: 'Cache write',
      output: 'Output',
    }

    rows.push({ date, model, type: typeMap[tokenType] || tokenType, cost })
  }
  return rows
}

function parseAnthropicTokenCsv(text: string): TokenRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const rows: TokenRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 11) continue
    rows.push({
      date: cols[0]?.trim(),
      model: cols[1]?.trim(),
      input: parseInt(cols[6]?.trim() || '0'),
      cacheWrite: parseInt(cols[7]?.trim() || '0'),
      cacheRead: parseInt(cols[9]?.trim() || '0'),
      output: parseInt(cols[10]?.trim() || '0'),
    })
  }
  return rows
}

// ─── OpenAI CSV parsers ─────────────────────────────────

function parseOpenAiCostCsv(text: string): CostRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  // Detect header columns
  const header = lines[0].toLowerCase()
  const cols0 = lines[0].split(',')
  const dateIdx = cols0.findIndex((c) => /date/.test(c.toLowerCase()))
  const modelIdx = cols0.findIndex((c) => /model|snapshot/.test(c.toLowerCase()))
  const costIdx = cols0.findIndex((c) => /cost|amount|usd/.test(c.toLowerCase()))
  const typeIdx = cols0.findIndex((c) => /operation|type|category/.test(c.toLowerCase()))

  if (dateIdx === -1 || costIdx === -1) return []

  const rows: CostRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const date = cols[dateIdx]?.trim()
    const model = modelIdx >= 0 ? cols[modelIdx]?.trim() : 'Unknown'
    const cost = parseFloat(cols[costIdx]?.trim() || '0')
    const type = typeIdx >= 0 ? cols[typeIdx]?.trim() : 'Usage'

    if (date && !isNaN(cost)) {
      rows.push({ date, model: model || 'Unknown', type, cost })
    }
  }
  return rows
}

function parseOpenAiTokenCsv(text: string): TokenRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const cols0 = lines[0].split(',')
  const dateIdx = cols0.findIndex((c) => /date/.test(c.toLowerCase()))
  const modelIdx = cols0.findIndex((c) => /model|snapshot/.test(c.toLowerCase()))
  const inputIdx = cols0.findIndex((c) => /input|prompt|context/.test(c.toLowerCase()))
  const outputIdx = cols0.findIndex((c) => /output|completion|generated/.test(c.toLowerCase()))

  if (dateIdx === -1) return []

  const rows: TokenRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    rows.push({
      date: cols[dateIdx]?.trim(),
      model: modelIdx >= 0 ? cols[modelIdx]?.trim() : 'Unknown',
      input: inputIdx >= 0 ? parseInt(cols[inputIdx]?.trim() || '0') : 0,
      cacheWrite: 0,
      cacheRead: 0,
      output: outputIdx >= 0 ? parseInt(cols[outputIdx]?.trim() || '0') : 0,
    })
  }
  return rows
}

// ─── Helpers ────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function groupCostsByDate(rows: CostRow[]) {
  const byDate: Record<string, { breakdown: { type: string; cost: number }[]; total: number }> = {}
  for (const row of rows) {
    if (!byDate[row.date]) byDate[row.date] = { breakdown: [], total: 0 }
    const existing = byDate[row.date].breakdown.find((b) => b.type === row.type)
    if (existing) {
      existing.cost += row.cost
    } else {
      byDate[row.date].breakdown.push({ type: row.type, cost: row.cost })
    }
    byDate[row.date].total += row.cost
  }

  const dates = Object.keys(byDate).sort()
  const period = dates.length > 0
    ? `${formatDate(dates[0])}–${formatDate(dates[dates.length - 1])}`
    : 'Unknown period'

  const days = dates.map((date) => ({
    date: formatDate(date),
    breakdown: byDate[date].breakdown.map((b) => ({ ...b, cost: Math.round(b.cost * 100) / 100 })),
    total: Math.round(byDate[date].total * 100) / 100,
  }))

  // Detect model from first row
  const model = rows[0]?.model || 'Unknown'

  return { period, model, days, updatedAt: new Date().toISOString() }
}

// ─── Route handler ──────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10 MB.' }, { status: 400 })
    }

    const text = await file.text()
    const fileName = file.name.toLowerCase()
    const header = text.split('\n')[0]?.toLowerCase() || ''

    const dataDir = DATA_DIR
    await mkdir(dataDir, { recursive: true })

    // ─── Detect provider ────────────────────────────────
    const isAnthropic = header.includes('workspace') || header.includes('token_type') || header.includes('cost_usd') || fileName.includes('anthropic')
    const isOpenAi = header.includes('snapshot') || header.includes('organization') || fileName.includes('openai') || fileName.includes('open_ai')

    // ─── Detect cost vs token ───────────────────────────
    const isCostFile = header.includes('cost') || header.includes('amount') || header.includes('usd') || fileName.includes('cost')
    const isTokenFile = header.includes('token') || header.includes('usage_input') || fileName.includes('token') || fileName.includes('usage')

    // ─── Anthropic cost CSV ─────────────────────────────
    if (isAnthropic && isCostFile) {
      const rows = parseAnthropicCostCsv(text)
      const costData = groupCostsByDate(rows)
      await writeFile(path.join(dataDir, 'anthropic-costs.json'), JSON.stringify(costData, null, 2))
      return NextResponse.json({ ok: true, type: 'costs', provider: 'anthropic', days: costData.days.length, total: costData.days.reduce((s, d) => s + d.total, 0) })
    }

    // ─── Anthropic token CSV ────────────────────────────
    if (isAnthropic && isTokenFile) {
      const rows = parseAnthropicTokenCsv(text)
      const tokenData = {
        rows: rows.map((r) => ({ ...r, date: formatDate(r.date) })),
        updatedAt: new Date().toISOString(),
      }
      await writeFile(path.join(dataDir, 'anthropic-tokens.json'), JSON.stringify(tokenData, null, 2))
      return NextResponse.json({ ok: true, type: 'tokens', provider: 'anthropic', rows: rows.length })
    }

    // ─── OpenAI cost CSV ────────────────────────────────
    if (isOpenAi && isCostFile) {
      const rows = parseOpenAiCostCsv(text)
      const costData = groupCostsByDate(rows)
      await writeFile(path.join(dataDir, 'openai-costs.json'), JSON.stringify(costData, null, 2))
      return NextResponse.json({ ok: true, type: 'costs', provider: 'openai', days: costData.days.length, total: costData.days.reduce((s, d) => s + d.total, 0) })
    }

    // ─── OpenAI token CSV ───────────────────────────────
    if (isOpenAi && isTokenFile) {
      const rows = parseOpenAiTokenCsv(text)
      const tokenData = {
        rows: rows.map((r) => ({ ...r, date: formatDate(r.date) })),
        updatedAt: new Date().toISOString(),
      }
      await writeFile(path.join(dataDir, 'openai-tokens.json'), JSON.stringify(tokenData, null, 2))
      return NextResponse.json({ ok: true, type: 'tokens', provider: 'openai', rows: rows.length })
    }

    // ─── Fallback: try to auto-detect ───────────────────
    if (isCostFile) {
      // Default to Anthropic format if we can't determine provider
      const rows = parseAnthropicCostCsv(text)
      if (rows.length > 0) {
        const costData = groupCostsByDate(rows)
        await writeFile(path.join(dataDir, 'anthropic-costs.json'), JSON.stringify(costData, null, 2))
        return NextResponse.json({ ok: true, type: 'costs', provider: 'anthropic', days: costData.days.length, total: costData.days.reduce((s, d) => s + d.total, 0) })
      }
    }

    if (isTokenFile) {
      const rows = parseAnthropicTokenCsv(text)
      if (rows.length > 0) {
        const tokenData = {
          rows: rows.map((r) => ({ ...r, date: formatDate(r.date) })),
          updatedAt: new Date().toISOString(),
        }
        await writeFile(path.join(dataDir, 'anthropic-tokens.json'), JSON.stringify(tokenData, null, 2))
        return NextResponse.json({ ok: true, type: 'tokens', provider: 'anthropic', rows: rows.length })
      }
    }

    // Build a specific error message based on what we could detect
    const parts: string[] = []
    if (!isAnthropic && !isOpenAi) {
      parts.push('Could not detect the provider (Anthropic or OpenAI) from the CSV headers or filename.')
    }
    if (!isCostFile && !isTokenFile) {
      parts.push('Could not determine if this is a cost or token CSV.')
    }
    if (isAnthropic || isOpenAi) {
      // We detected provider but parsing returned zero rows
      parts.push(`The file was detected as ${isAnthropic ? 'Anthropic' : 'OpenAI'} but could not parse any data rows. The format may have changed.`)
    }
    parts.push('Expected a cost or token CSV exported from console.anthropic.com or platform.openai.com.')

    return NextResponse.json({ error: parts.join(' ') }, { status: 400 })
  } catch (error) {
    let message = 'Upload failed'
    if (error instanceof Error) {
      if (error.message.includes('FormData') || error.message.includes('formData')) {
        message = 'Could not read the uploaded file. Try selecting the file again.'
      } else if (error.message.includes('ENOSPC') || error.message.includes('EDQUOT')) {
        message = 'Disk is full. Free up space and try again.'
      } else if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
        message = 'Permission denied writing data. Check that the app has write access to its data directory.'
      }
      // Default case intentionally uses generic 'Upload failed' — never leak raw error.message
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

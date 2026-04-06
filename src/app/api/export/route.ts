import { NextRequest, NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/sanitize-error'
import { getLocalApiOrigin } from '@/lib/local-api-origin'

type ExportType = 'costs' | 'usage' | 'operations' | 'all'
type ExportFormat = 'csv' | 'pdf'
type ExportRange = '7d' | '30d' | '90d'

type ExportRow = Record<string, string | number | boolean | null>
type ProviderCostDay = {
  date: string
  total: number
  breakdown: { type: string; cost: number }[]
}
type ProviderCostRecord = {
  days?: ProviderCostDay[]
}

const VALID_TYPES = new Set<ExportType>(['costs', 'usage', 'operations', 'all'])
const VALID_FORMATS = new Set<ExportFormat>(['csv', 'pdf'])
const VALID_RANGES = new Set<ExportRange>(['7d', '30d', '90d'])

function getDaysForRange(range: ExportRange) {
  switch (range) {
    case '7d':
      return 7
    case '90d':
      return 90
    default:
      return 30
  }
}

function parseDateLabel(label: string | undefined | null) {
  if (!label) return null
  const parsed = new Date(label)
  if (!Number.isNaN(parsed.getTime())) return parsed

  const fallback = new Date(`${label} ${new Date().getFullYear()}`)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function isWithinRange(label: string | undefined | null, days: number) {
  const parsed = parseDateLabel(label)
  if (!parsed) return true
  return parsed.getTime() >= Date.now() - days * 24 * 60 * 60 * 1000
}

async function fetchJson(origin: string, pathname: string) {
  const response = await fetch(`${origin}${pathname}`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Export source failed: ${pathname}`)
  }
  return response.json()
}

function escapeHtml(value: string | number | boolean | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isProviderCostRecord(value: unknown): value is ProviderCostRecord {
  return typeof value === 'object' && value !== null
}

function getProviderCostEntries(providerCosts: unknown): Array<[string, ProviderCostRecord]> {
  if (!providerCosts || typeof providerCosts !== 'object') return []

  return Object.entries(providerCosts).flatMap(([provider, value]) => (
    isProviderCostRecord(value) ? [[provider, value]] : []
  ))
}

function escapeCsv(value: string | number | boolean | null | undefined) {
  const stringValue = value == null ? '' : String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

function toCsv(rows: ExportRow[]) {
  if (rows.length === 0) return 'section,message\r\nempty,No export data available\r\n'

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key))
      return set
    }, new Set<string>()),
  )

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
  ]

  return `${lines.join('\r\n')}\r\n`
}

function renderSection(title: string, rows: ExportRow[]) {
  if (rows.length === 0) {
    return `<section><h2>${escapeHtml(title)}</h2><p>No data available for this section.</p></section>`
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key))
      return set
    }, new Set<string>()),
  )

  const head = headers.map((header) => `<th>${escapeHtml(header.replace(/_/g, ' '))}</th>`).join('')
  const body = rows.map((row) => (
    `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join('')}</tr>`
  )).join('')

  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>
  `
}

function renderHtmlReport(type: ExportType, range: ExportRange, sections: { title: string; rows: ExportRow[] }[]) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Mission Control Export</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            margin: 32px;
            color: #111827;
            background: #ffffff;
          }
          h1, h2 {
            margin: 0 0 12px;
          }
          p {
            color: #4b5563;
            margin: 0 0 24px;
          }
          section {
            margin-top: 28px;
            break-inside: avoid;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th, td {
            padding: 8px 10px;
            border: 1px solid #e5e7eb;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f3f4f6;
            text-transform: capitalize;
          }
          @media print {
            body { margin: 18px; }
          }
        </style>
      </head>
      <body>
        <h1>Mission Control Export</h1>
        <p>Type: ${escapeHtml(type)} - Range: ${escapeHtml(range)} - Generated: ${escapeHtml(new Date().toLocaleString())}</p>
        ${sections.map((section) => renderSection(section.title, section.rows)).join('')}
        <script>
          window.addEventListener('load', () => {
            window.print()
          })
        </script>
      </body>
    </html>
  `
}

export async function GET(request: NextRequest) {
  const requestedType = request.nextUrl.searchParams.get('type')
  const requestedFormat = request.nextUrl.searchParams.get('format')
  const requestedRange = request.nextUrl.searchParams.get('range')

  if (!requestedType && !requestedFormat && !requestedRange) {
    return NextResponse.json({
      ok: true,
      message: 'Mission Control exports require a type, format, and range. The app normally supplies these automatically.',
      defaults: {
        type: 'all',
        format: 'csv',
        range: '30d',
      },
      options: {
        types: Array.from(VALID_TYPES),
        formats: Array.from(VALID_FORMATS),
        ranges: Array.from(VALID_RANGES),
      },
      exampleUrl: '/api/export?type=all&format=csv&range=30d',
    })
  }

  const type = (requestedType || 'all') as ExportType
  const format = (requestedFormat || 'csv') as ExportFormat
  const range = (requestedRange || '30d') as ExportRange

  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid export type', type, validTypes: Array.from(VALID_TYPES) }, { status: 400 })
  }
  if (!VALID_FORMATS.has(format)) {
    return NextResponse.json({ error: 'Invalid export format', format, validFormats: Array.from(VALID_FORMATS) }, { status: 400 })
  }
  if (!VALID_RANGES.has(range)) {
    return NextResponse.json({ error: 'Invalid export range', range, validRanges: Array.from(VALID_RANGES) }, { status: 400 })
  }

  const origin = getLocalApiOrigin(request)
  const rangeDays = getDaysForRange(range)
  const sections: { title: string; rows: ExportRow[] }[] = []

  try {
    if (type === 'costs' || type === 'all') {
      const costs = await fetchJson(origin, '/api/costs')
      const rows: ExportRow[] = []

      if (costs.anthropicCosts?.days) {
        for (const day of costs.anthropicCosts.days.filter((entry: { date: string }) => isWithinRange(entry.date, rangeDays))) {
          rows.push({
            section: 'costs',
            provider: 'anthropic',
            date: day.date,
            total: day.total,
            details: day.breakdown.map((item: { type: string; cost: number }) => `${item.type}: $${item.cost.toFixed(2)}`).join(' | '),
          })
        }
      }

      for (const [provider, providerData] of getProviderCostEntries(costs.providerCosts)) {
        for (const day of (providerData.days || []).filter((entry) => isWithinRange(entry.date, rangeDays))) {
          rows.push({
            section: 'costs',
            provider,
            date: day.date,
            total: day.total,
            details: day.breakdown.map((item) => `${item.type}: $${item.cost.toFixed(2)}`).join(' | '),
          })
        }
      }

      if (costs.openrouter) {
        rows.push({
          section: 'costs',
          provider: 'openrouter',
          date: 'current',
          total: costs.openrouter.usageMonthly ?? 0,
          details: `Remaining: $${(costs.openrouter.remaining ?? 0).toFixed(2)}`,
        })
      }

      if (costs.railway && !costs.railway.error) {
        rows.push({
          section: 'costs',
          provider: 'railway',
          date: 'current',
          total: costs.railway.estimated?.total ?? 0,
          details: `Plan: ${costs.railway.plan || 'unknown'}`,
        })
      }

      for (const subscription of costs.subscriptions || []) {
        rows.push({
          section: 'costs',
          provider: subscription.provider,
          date: subscription.cycle,
          total: subscription.cost,
          details: subscription.name,
        })
      }

      sections.push({ title: 'Costs', rows })
    }

    if (type === 'usage' || type === 'all') {
      const [agents, uptime] = await Promise.all([
        fetchJson(origin, '/api/agents'),
        fetchJson(origin, `/api/agents/uptime?range=${range}`),
      ])

      const uptimeByAgent = new Map(
        (uptime.agents || []).map((agent: { name: string; uptimePercentage: number }) => [agent.name, agent.uptimePercentage]),
      )

      const rows: ExportRow[] = (agents.agents || []).map((agent: { name: string; model: string; enabled: boolean; description: string }) => ({
        section: 'usage',
        agent: agent.name,
        model: agent.model,
        enabled: agent.enabled,
        uptime_percentage: uptimeByAgent.get(agent.name) ?? 0,
        description: agent.description || '',
      }))

      for (const session of agents.sessions || []) {
        rows.push({
          section: 'usage',
          agent: session.key,
          model: 'session',
          enabled: true,
          uptime_percentage: null,
          description: session.age,
        })
      }

      sections.push({ title: 'Usage', rows })
    }

    if (type === 'operations' || type === 'all') {
      const operations = await fetchJson(origin, '/api/operations')
      const rows: ExportRow[] = (operations.jobs || [])
        .filter((job: { status?: { startedAt?: string } }) => isWithinRange(job.status?.startedAt, rangeDays))
        .map((job: { id: string; address: string; status: { status?: string; step?: string; startedAt?: string }; costs: { total?: number } }) => ({
          section: 'operations',
          job_id: job.id,
          address: job.address,
          status: job.status?.status || '',
          step: job.status?.step || '',
          started_at: job.status?.startedAt || '',
          total_cost: job.costs?.total || 0,
        }))

      sections.push({ title: 'Operations', rows })
    }
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to build export') },
      { status: 500 },
    )
  }

  if (format === 'csv') {
    const csv = toCsv(sections.flatMap((section) => section.rows))
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="mission-control-${type}-${range}.csv"`,
      },
    })
  }

  const html = renderHtmlReport(type, range, sections)
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}

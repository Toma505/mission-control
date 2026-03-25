import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'

const REPORTS_FILE = path.join(DATA_DIR, 'scheduled-reports.json')
const REPORTS_DIR = path.join(DATA_DIR, 'reports')

export interface ScheduledReport {
  id: string
  name: string
  frequency: 'daily' | 'weekly' | 'monthly'
  format: 'csv' | 'json'
  includes: string[]  // which data to include
  enabled: boolean
  lastRun?: string
  nextRun?: string
  createdAt: string
}

const REPORT_SECTIONS = [
  { id: 'costs', label: 'Cost Summary' },
  { id: 'tokens', label: 'Token Usage by Model' },
  { id: 'budget', label: 'Budget Status' },
  { id: 'alerts', label: 'Alert History' },
  { id: 'sessions', label: 'Session Activity' },
]

async function readReports(): Promise<ScheduledReport[]> {
  try {
    const text = await readFile(REPORTS_FILE, 'utf-8')
    return JSON.parse(text)
  } catch {
    return []
  }
}

async function writeReports(reports: ScheduledReport[]) {
  await mkdir(path.dirname(REPORTS_FILE), { recursive: true })
  await writeFile(REPORTS_FILE, JSON.stringify(reports, null, 2))
}

function computeNextRun(frequency: string): string {
  const now = new Date()
  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1)
      now.setHours(8, 0, 0, 0)
      break
    case 'weekly':
      now.setDate(now.getDate() + (7 - now.getDay()))
      now.setHours(8, 0, 0, 0)
      break
    case 'monthly':
      now.setMonth(now.getMonth() + 1, 1)
      now.setHours(8, 0, 0, 0)
      break
  }
  return now.toISOString()
}

/** GET — list scheduled reports and available sections */
export async function GET() {
  const reports = await readReports()
  return NextResponse.json({ reports, sections: REPORT_SECTIONS })
}

/** POST — create a scheduled report or generate one now */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json()

    if (body.action === 'generate') {
      // Generate a report on demand
      const reports = await readReports()
      const report = reports.find(r => r.id === body.id)
      if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

      const data = await gatherReportData(report.includes)
      const filename = `report_${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.${report.format}`

      await mkdir(REPORTS_DIR, { recursive: true })
      const filePath = path.join(REPORTS_DIR, filename)

      if (report.format === 'json') {
        await writeFile(filePath, JSON.stringify(data, null, 2))
      } else {
        await writeFile(filePath, convertToCSV(data))
      }

      // Update lastRun
      report.lastRun = new Date().toISOString()
      report.nextRun = computeNextRun(report.frequency)
      await writeReports(reports)

      return NextResponse.json({ ok: true, filename, path: filePath })
    }

    // Create new scheduled report
    const { name, frequency, format, includes } = body
    if (!name || !frequency || !includes?.length) {
      return NextResponse.json({ error: 'name, frequency, and includes required' }, { status: 400 })
    }

    const reports = await readReports()
    const newReport: ScheduledReport = {
      id: `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      frequency,
      format: format || 'csv',
      includes,
      enabled: true,
      nextRun: computeNextRun(frequency),
      createdAt: new Date().toISOString(),
    }

    reports.push(newReport)
    await writeReports(reports)
    return NextResponse.json({ ok: true, report: newReport })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

/** PATCH — toggle enabled */
export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const { id } = await request.json()
    const reports = await readReports()
    const report = reports.find(r => r.id === id)
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    report.enabled = !report.enabled
    await writeReports(reports)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

/** DELETE — remove a scheduled report */
export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const { id } = await request.json()
    const reports = await readReports()
    await writeReports(reports.filter(r => r.id !== id))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// ─── Data gathering ────────────────────────────────────

async function gatherReportData(includes: string[]) {
  const data: Record<string, unknown> = { generatedAt: new Date().toISOString() }

  for (const section of includes) {
    try {
      switch (section) {
        case 'costs': {
          const budgetText = await readFile(path.join(DATA_DIR, 'budget.json'), 'utf-8').catch(() => '{}')
          data.costs = JSON.parse(budgetText)
          break
        }
        case 'budget': {
          const budgetText = await readFile(path.join(DATA_DIR, 'budget.json'), 'utf-8').catch(() => '{}')
          data.budget = JSON.parse(budgetText)
          break
        }
        case 'alerts': {
          const alertsText = await readFile(path.join(DATA_DIR, 'alerts.json'), 'utf-8').catch(() => '{"history":[]}')
          const alerts = JSON.parse(alertsText)
          data.alerts = alerts.history || []
          break
        }
        case 'tokens': {
          data.tokens = { note: 'Token data from live OpenRouter API — see costs section' }
          break
        }
        case 'sessions': {
          data.sessions = { note: 'Session data requires live OpenClaw connection' }
          break
        }
      }
    } catch {}
  }

  return data
}

function convertToCSV(data: Record<string, unknown>): string {
  const lines: string[] = ['Section,Key,Value']

  for (const [section, value] of Object.entries(data)) {
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((item, i) => {
          if (typeof item === 'object') {
            Object.entries(item as Record<string, unknown>).forEach(([k, v]) => {
              lines.push(`${section}[${i}],${k},"${String(v).replace(/"/g, '""')}"`)
            })
          } else {
            lines.push(`${section},${i},"${String(item).replace(/"/g, '""')}"`)
          }
        })
      } else {
        Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
          lines.push(`${section},${k},"${String(v).replace(/"/g, '""')}"`)
        })
      }
    } else {
      lines.push(`${section},value,"${String(value).replace(/"/g, '""')}"`)
    }
  }

  return lines.join('\n')
}

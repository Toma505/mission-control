import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { sanitizeError } from '@/lib/sanitize-error'
import { isConfigured, getOpenClawLogs, getOpenClawSystemStatus, parseStatusOutput } from '@/lib/openclaw'
import { DATA_DIR } from '@/lib/connection-config'

async function readLocalRecaps() {
  try {
    const text = await readFile(path.join(DATA_DIR, 'weekly-recaps.json'), 'utf-8')
    const data = JSON.parse(text)
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

export async function GET() {
  if (!(await isConfigured())) {
    const recaps = await readLocalRecaps()
    return NextResponse.json({ connected: false, recaps })
  }

  try {
    const [logsRaw, statusRaw] = await Promise.all([
      getOpenClawLogs(200).catch(() => ''),
      getOpenClawSystemStatus().catch(() => ''),
    ])

    const status = parseStatusOutput(statusRaw)
    const logLines = logsRaw.split('\n').filter((l) => l.trim())

    // If there are enough logs, generate a summary recap
    const recaps: { period: string; summary: string; stats: Record<string, string> }[] = []

    if (logLines.length > 0) {
      // Count log levels
      let errors = 0, warns = 0, infos = 0
      for (const line of logLines) {
        if (/error/i.test(line)) errors++
        else if (/warn/i.test(line)) warns++
        else infos++
      }

      recaps.push({
        period: 'Recent Activity',
        summary: `${logLines.length} log entries captured. ${errors} errors, ${warns} warnings, ${infos} info messages.`,
        stats: {
          'Total Events': String(logLines.length),
          'Errors': String(errors),
          'Warnings': String(warns),
          'Sessions': status.sessions || '0',
          'Memory': status.memory || 'unknown',
          'Heartbeat': status.heartbeat || 'unknown',
        },
      })
    }

    const finalRecaps = recaps.length > 0 ? recaps : await readLocalRecaps()
    return NextResponse.json({ connected: true, recaps: finalRecaps })
  } catch (error) {
    const recaps = await readLocalRecaps()
    return NextResponse.json({ connected: false, error: sanitizeError(error, 'Could not fetch weekly recaps'), recaps })
  }
}

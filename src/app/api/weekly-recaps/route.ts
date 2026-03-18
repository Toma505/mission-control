import { NextResponse } from 'next/server'
import { isConfigured, getOpenClawLogs, getOpenClawSystemStatus, parseStatusOutput } from '@/lib/openclaw'

export async function GET() {
  if (!(await isConfigured())) {
    return NextResponse.json({ connected: false, recaps: [] })
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

    return NextResponse.json({ connected: true, recaps })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ connected: false, error: message, recaps: [] })
  }
}

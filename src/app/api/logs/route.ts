import { NextResponse } from 'next/server'
import { isConfigured, getOpenClawLogs } from '@/lib/openclaw'

export async function GET() {
  if (!(await isConfigured())) {
    return NextResponse.json({ connected: false, logs: [] })
  }

  try {
    const raw = await getOpenClawLogs(100)

    // Parse log lines into structured entries
    const logs = raw
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        // Try to parse timestamp and level from common log formats
        // e.g. "2026-03-15T10:30:00Z [INFO] Message here"
        // or "INFO: Message here"
        // or just plain text
        const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s*/)
        const levelMatch = line.match(/\[(INFO|WARN|ERROR|DEBUG)\]|\b(INFO|WARN|ERROR|DEBUG):/i)

        const timestamp = timestampMatch?.[1] || ''
        const level = (levelMatch?.[1] || levelMatch?.[2] || 'info').toLowerCase()
        const message = line
          .replace(timestampMatch?.[0] || '', '')
          .replace(levelMatch?.[0] || '', '')
          .trim()

        return { timestamp, level, message, raw: line }
      })
      .filter((l) => l.message)

    return NextResponse.json({ connected: true, logs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ connected: false, error: message, logs: [] })
  }
}

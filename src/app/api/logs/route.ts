import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { sanitizeError } from '@/lib/sanitize-error'
import { isConfigured, getOpenClawLogs } from '@/lib/openclaw'
import { DATA_DIR } from '@/lib/connection-config'

async function readLocalActivitiesAsLogs() {
  try {
    const text = await readFile(path.join(DATA_DIR, 'activities.json'), 'utf-8')
    const data = JSON.parse(text)
    if (!Array.isArray(data)) return []
    return data.map((a: any) => ({
      timestamp: a.timestamp || a.createdAt || '',
      level: a.type === 'error' ? 'error' : a.type === 'alert' ? 'warn' : 'info',
      message: [a.action, a.details, a.description, a.title, a.message].filter(Boolean).join(' — ') || '',
      raw: `${a.timestamp || ''} [${(a.type || 'info').toUpperCase()}] ${a.action || ''} ${a.details || ''}`,
    }))
  } catch { return [] }
}

export async function GET() {
  if (!(await isConfigured())) {
    const logs = await readLocalActivitiesAsLogs()
    return NextResponse.json({ connected: false, logs })
  }

  try {
    const raw = await getOpenClawLogs(100)

    // Parse log lines into structured entries
    const logs = raw
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
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

    const finalLogs = logs.length > 0 ? logs : await readLocalActivitiesAsLogs()
    return NextResponse.json({ connected: true, logs: finalLogs })
  } catch (error) {
    const logs = await readLocalActivitiesAsLogs()
    if (logs.length > 0) {
      return NextResponse.json({ connected: true, logs })
    }
    return NextResponse.json({ connected: false, error: sanitizeError(error, 'Could not fetch logs'), logs })
  }
}

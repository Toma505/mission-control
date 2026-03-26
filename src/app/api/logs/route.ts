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

    return data.map((activity: any) => ({
      timestamp: activity.timestamp || activity.createdAt || '',
      level: activity.type === 'error' ? 'error' : activity.type === 'alert' ? 'warn' : 'info',
      message: [activity.action, activity.details, activity.description, activity.title, activity.message].filter(Boolean).join(' - ') || '',
      raw: `${activity.timestamp || ''} [${(activity.type || 'info').toUpperCase()}] ${activity.action || ''} ${activity.details || ''}`,
    }))
  } catch {
    return []
  }
}

export async function GET() {
  if (!(await isConfigured())) {
    const logs = await readLocalActivitiesAsLogs()
    return NextResponse.json({ connected: false, logs })
  }

  try {
    const raw = await getOpenClawLogs(100)

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
      .filter((entry) => entry.message)

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

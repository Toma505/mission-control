import { NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/sanitize-error'
import { isConfigured, getOpenClawConfig } from '@/lib/openclaw'

export async function GET() {
  if (!(await isConfigured())) {
    return NextResponse.json({ connected: false, jobs: [] })
  }

  try {
    const configData = await getOpenClawConfig().catch(() => null)

    let config: any = null
    if (configData?.content) {
      try { config = JSON.parse(configData.content) } catch { config = null }
    }

    const jobs: any[] = []

    // Look for scheduled tasks / cron definitions in config
    // OpenClaw may store these under various keys
    const cronSources = [
      config?.cron,
      config?.schedules,
      config?.scheduled_tasks,
      config?.tasks,
      config?.automations,
    ]

    for (const source of cronSources) {
      if (!source) continue
      if (Array.isArray(source)) {
        for (const job of source) {
          jobs.push({
            name: job.name || job.task || 'Unnamed',
            schedule: job.schedule || job.cron || job.interval || '',
            description: job.description || '',
            enabled: job.enabled !== false,
            lastRun: job.last_run || job.lastRun || null,
          })
        }
      } else if (typeof source === 'object') {
        for (const [name, def] of Object.entries(source)) {
          const d = def as any
          jobs.push({
            name: d.name || name,
            schedule: d.schedule || d.cron || d.interval || '',
            description: d.description || '',
            enabled: d.enabled !== false,
            lastRun: d.last_run || d.lastRun || null,
          })
        }
      }
    }

    return NextResponse.json({ connected: true, jobs })
  } catch (error) {
    return NextResponse.json({ connected: false, error: sanitizeError(error, 'Could not fetch cron job data'), jobs: [] })
  }
}

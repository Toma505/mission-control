import { NextResponse } from 'next/server'
import {
  isConfigured,
  getOpenClawStatus,
  getOpenClawHealth,
  getOpenClawSystemStatus,
  getOpenClawConfig,
  parseStatusOutput,
  parseHealthOutput,
} from '@/lib/openclaw'

export async function GET() {
  if (!(await isConfigured())) {
    return NextResponse.json(
      { connected: false, error: 'OpenClaw is not configured yet. Complete setup in Mission Control to continue.' },
      { status: 200 }
    )
  }

  try {
    const [setupStatus, healthRaw, statusRaw, configData] = await Promise.all([
      getOpenClawStatus().catch(() => null),
      getOpenClawHealth().catch(() => ''),
      getOpenClawSystemStatus().catch(() => ''),
      getOpenClawConfig().catch(() => null),
    ])

    const health = parseHealthOutput(healthRaw)
    const status = parseStatusOutput(statusRaw)

    // Parse config JSON
    let config = null
    if (configData?.content) {
      try {
        config = JSON.parse(configData.content)
      } catch {
        config = null
      }
    }

    // Extract key info
    const agentModel = config?.agents?.defaults?.model?.primary || 'unknown'
    const channels = config?.channels || {}
    const enabledChannels = Object.entries(channels)
      .filter(([, v]: [string, any]) => v?.enabled)
      .map(([k]) => k)

    return NextResponse.json({
      connected: true,
      version: setupStatus?.openclawVersion || status.version || 'Unknown',
      gateway: {
        target: setupStatus?.gatewayTarget || '',
        status: setupStatus?.configured ? 'online' : 'offline',
      },
      agent: {
        model: agentModel,
        info: status.agents,
        heartbeat: status.heartbeat || health.heartbeat,
      },
      discord: health.discord,
      sessions: health.sessions,
      channels: enabledChannels,
      memory: status.memory,
      update: status.update,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ connected: false, error: message }, { status: 200 })
  }
}

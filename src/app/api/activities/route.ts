import { NextResponse } from 'next/server'
import {
  isConfigured,
  getOpenClawHealth,
  getOpenClawSystemStatus,
  getOpenClawConfig,
  parseHealthOutput,
  parseStatusOutput,
} from '@/lib/openclaw'

interface Session {
  key: string
  kind: string
  age: string
  model: string
  tokens: string
}

function parseSessionsFromStatus(raw: string): Session[] {
  const sessions: Session[] = []
  // Match session table rows
  const regex = /│\s*(agent:\S+)\s*│\s*(\w+)\s*│\s*(\S+ ago)\s*│\s*(\S+)\s*│\s*(.+?)\s*│/g
  let m
  while ((m = regex.exec(raw)) !== null) {
    sessions.push({
      key: m[1],
      kind: m[2],
      age: m[3],
      model: m[4],
      tokens: m[5].trim(),
    })
  }
  return sessions
}

function parseChannelsFromStatus(raw: string): { name: string; enabled: boolean; state: string }[] {
  const channels: { name: string; enabled: boolean; state: string }[] = []
  const regex = /│\s*(\w+)\s*│\s*(ON|OFF)\s*│\s*(\w+)\s*│/g
  let m
  while ((m = regex.exec(raw)) !== null) {
    if (m[1] !== 'Channel') {
      channels.push({ name: m[1], enabled: m[2] === 'ON', state: m[3] })
    }
  }
  return channels
}

export async function GET() {
  try {
    if (!(await isConfigured())) {
      return NextResponse.json({
        connected: false,
        status: {
          online: false,
          value: 'Not Connected',
          subtitle: 'Complete setup to connect your OpenClaw instance',
        },
        sessions: [],
        channels: [],
        activities: [],
        commits: [],
        agent: null,
      })
    }

    const [healthRaw, statusRaw, configData] = await Promise.all([
      getOpenClawHealth().catch(() => ''),
      getOpenClawSystemStatus().catch(() => ''),
      getOpenClawConfig().catch(() => null),
    ])

    // If all three calls returned empty, OpenClaw is unreachable
    const reachable = !!(healthRaw || statusRaw || configData)

    const health = parseHealthOutput(healthRaw)
    const parsedStatus = parseStatusOutput(statusRaw)
    const sessions = parseSessionsFromStatus(statusRaw)
    const channels = parseChannelsFromStatus(statusRaw)

    // Parse config
    let config: any = null
    if (configData?.content) {
      try { config = JSON.parse(configData.content) } catch {}
    }

    const agentModel = config?.agents?.defaults?.model?.primary || 'unknown'
    const isOnline = reachable && health.discord.status === 'ok'

    // Build real activities from sessions
    const activities = sessions.map((s, i) => {
      const isMain = s.key === 'agent:main:main'
      const isChannel = s.key.includes('channel:')
      const isDirect = s.key.includes('direct:') && !isMain

      return {
        id: String(i + 1),
        type: isMain ? 'agent' : isChannel ? 'channel' : 'direct',
        title: isMain ? 'Main Agent Session' : isChannel ? 'Discord Channel Session' : 'Discord DM Session',
        description: `${s.model} · ${s.tokens} · ${s.kind}`,
        status: s.age.includes('6h') || s.age.includes('5h') ? 'IN_PROGRESS' : 'COMPLETED',
        timestamp: new Date(Date.now() - parseAge(s.age)).toISOString(),
      }
    })

    // Build status
    const status = {
      online: isOnline,
      value: isOnline ? 'Online' : reachable ? 'Offline' : 'Unreachable',
      subtitle: isOnline ? `${health.discord.botName} · ${health.discord.latency}` : reachable ? 'Agent offline' : 'Could not connect to OpenClaw',
      version: parsedStatus.version,
      update: parsedStatus.update,
      heartbeat: health.heartbeat || parsedStatus.heartbeat,
      agents: parsedStatus.agents,
      memory: parsedStatus.memory,
      sessionCount: sessions.length,
      model: agentModel,
    }

    return NextResponse.json({
      connected: reachable,
      status,
      sessions,
      channels,
      activities,
      commits: [], // No mock commits — empty until real git integration
      agent: reachable ? {
        model: agentModel,
        heartbeat: health.heartbeat || parsedStatus.heartbeat,
        sessions: sessions.length,
        discord: health.discord,
      } : null,
    })
  } catch (error) {
    let subtitle = 'Could not connect to OpenClaw'
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        subtitle = 'Connection refused — OpenClaw may not be running'
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        subtitle = 'Server not found — check your connection settings'
      } else if (error.message.includes('Timeout') || error.message.includes('AbortError')) {
        subtitle = 'Connection timed out — OpenClaw may be starting up'
      }
    }
    return NextResponse.json({
      connected: false,
      status: { online: false, value: 'Unreachable', subtitle },
      sessions: [],
      channels: [],
      activities: [],
      commits: [],
      agent: null,
    })
  }
}

function parseAge(age: string): number {
  const match = age.match(/(\d+)(m|h|d)\s*ago/)
  if (!match) return 0
  const num = parseInt(match[1])
  switch (match[2]) {
    case 'm': return num * 60 * 1000
    case 'h': return num * 3600 * 1000
    case 'd': return num * 86400 * 1000
    default: return 0
  }
}

import { NextResponse } from 'next/server'
import {
  isConfigured,
  getOpenClawConfig,
  getOpenClawHealth,
  getOpenClawSystemStatus,
  parseHealthOutput,
  parseStatusOutput,
} from '@/lib/openclaw'

export async function GET() {
  if (!(await isConfigured())) {
    return NextResponse.json({ connected: false, agents: [], sessions: [] })
  }

  try {
    const [configData, healthRaw, statusRaw] = await Promise.all([
      getOpenClawConfig().catch(() => null),
      getOpenClawHealth().catch(() => ''),
      getOpenClawSystemStatus().catch(() => ''),
    ])

    let config: any = null
    if (configData?.content) {
      try { config = JSON.parse(configData.content) } catch { config = null }
    }

    const health = parseHealthOutput(healthRaw)
    const status = parseStatusOutput(statusRaw)

    // Extract agent definitions from config
    const agents: any[] = []
    if (config?.agents) {
      const defaults = config.agents.defaults || {}
      const agentDefs = config.agents.agents || config.agents.list || {}

      // If agents is an object keyed by name
      if (typeof agentDefs === 'object' && !Array.isArray(agentDefs)) {
        for (const [name, def] of Object.entries(agentDefs)) {
          const d = def as any
          agents.push({
            name,
            model: d.model?.primary || defaults.model?.primary || 'unknown',
            description: d.description || d.system_prompt?.substring(0, 100) || '',
            enabled: d.enabled !== false,
          })
        }
      }

      // If no individual agents defined, show the default agent
      if (agents.length === 0 && defaults.model?.primary) {
        agents.push({
          name: 'default',
          model: defaults.model.primary,
          description: 'Default agent configuration',
          enabled: true,
        })
      }
    }

    // Extract sessions
    const sessions = health.sessions.map((s) => ({
      key: s.key,
      age: s.age,
    }))

    return NextResponse.json({
      connected: true,
      agents,
      sessions,
      agentInfo: status.agents,
      memory: status.memory,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ connected: false, error: message, agents: [], sessions: [] })
  }
}

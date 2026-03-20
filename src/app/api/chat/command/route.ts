import { NextRequest, NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/sanitize-error'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { isConfigured, runCommand, getOpenClawHealth, getOpenClawSystemStatus, getOpenClawLogs, getOpenClawPlugins } from '@/lib/openclaw'
import { matchCommand } from '@/lib/commands'
import { getEffectiveConfig } from '@/lib/connection-config'

/**
 * Command execution API.
 * Parses natural language or slash commands and executes them against MC/OpenClaw.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()
  if (!(await isConfigured())) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  try {
    let body: { input: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { input } = body
    if (!input?.trim()) {
      return NextResponse.json({ error: 'No input provided' }, { status: 400 })
    }

    const match = matchCommand(input)
    if (!match) {
      return NextResponse.json({
        isCommand: false,
        message: null,
      })
    }

    const { command, params } = match
    let result: { ok: boolean; message: string; data?: Record<string, unknown> }

    switch (command.id) {
      case 'switch-mode':
        result = await executeModeSwitchCommand(params.mode, request)
        break
      case 'get-mode':
        result = await executeGetModeCommand()
        break
      case 'list-sessions':
        result = await executeListSessionsCommand()
        break
      case 'agent-health':
        result = await executeHealthCommand()
        break
      case 'get-costs':
        result = await executeGetCostsCommand()
        break
      case 'set-budget':
        result = await executeSetBudgetCommand(params.amount, request)
        break
      case 'system-status':
        result = await executeSystemStatusCommand()
        break
      case 'view-logs':
        result = await executeLogsCommand(params.lines)
        break
      case 'list-plugins':
        result = await executePluginsCommand()
        break
      case 'run-command':
        result = await executeRawCommand(params.raw)
        break
      default:
        result = { ok: false, message: `Unknown command: ${command.id}` }
    }

    return NextResponse.json({
      isCommand: true,
      commandId: command.id,
      commandName: command.name,
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Command execution failed') },
      { status: 500 }
    )
  }
}

// ─── Command executors ──────────────────────────────────

async function executeModeSwitchCommand(
  mode: string,
  request: NextRequest
): Promise<{ ok: boolean; message: string; data?: Record<string, unknown> }> {
  const validModes = ['best', 'standard', 'budget', 'auto']
  if (!validModes.includes(mode)) {
    return { ok: false, message: `Invalid mode "${mode}". Choose: ${validModes.join(', ')}` }
  }

  try {
    // Call the mode API internally
    const config = await getEffectiveConfig()
    const auth = 'Basic ' + Buffer.from(':' + config.setupPassword).toString('base64')

    // Fetch current config
    const configRes = await fetch(`${config.openclawUrl}/setup/api/config/raw`, {
      headers: { Authorization: auth },
      cache: 'no-store',
    })
    if (!configRes.ok) throw new Error('Config fetch failed')
    const configData = await configRes.json()
    const ocConfig = JSON.parse(configData.content)

    const MODES: Record<string, { primary: string; fallbacks: string[] }> = {
      best: { primary: 'anthropic/claude-opus-4-6', fallbacks: ['openrouter/google/gemini-3.1-pro'] },
      standard: { primary: 'anthropic/claude-sonnet-4-6', fallbacks: ['openrouter/google/gemini-3.1-pro'] },
      budget: { primary: 'openrouter/deepseek/deepseek-chat-v3-0324', fallbacks: ['openrouter/openai/gpt-4.1-nano', 'openrouter/google/gemini-2.5-flash'] },
      auto: { primary: 'anthropic/claude-sonnet-4-6', fallbacks: ['openrouter/google/gemini-3.1-pro', 'openrouter/deepseek/deepseek-chat-v3-0324'] },
    }

    if (!ocConfig.agents) ocConfig.agents = {}
    if (!ocConfig.agents.defaults) ocConfig.agents.defaults = {}
    ocConfig.agents.defaults.model = { ...MODES[mode] }
    if (!ocConfig.meta) ocConfig.meta = {}
    ocConfig.meta.lastTouchedAt = new Date().toISOString()

    const saveRes = await fetch(`${config.openclawUrl}/setup/api/config/raw`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: JSON.stringify(ocConfig, null, 2) }),
    })
    if (!saveRes.ok) throw new Error('Config save failed')

    return {
      ok: true,
      message: `Switched to **${mode}** mode. Primary model: \`${MODES[mode].primary}\``,
      data: { mode, model: MODES[mode].primary },
    }
  } catch {
    return { ok: false, message: `Failed to switch to ${mode} mode. Check your OpenClaw connection.` }
  }
}

async function executeGetModeCommand(): Promise<{ ok: boolean; message: string; data?: Record<string, unknown> }> {
  try {
    const res = await fetch(`${(await getEffectiveConfig()).openclawUrl}/setup/api/config/raw`, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(':' + (await getEffectiveConfig()).setupPassword).toString('base64'),
      },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error()
    const data = await res.json()
    const config = JSON.parse(data.content)
    const model = config?.agents?.defaults?.model?.primary || 'unknown'
    const fallbacks = config?.agents?.defaults?.model?.fallbacks || []

    // Detect mode
    let mode = 'standard'
    if (model.includes('opus')) mode = 'best'
    else if (model.includes('deepseek') || model.includes('openrouter/')) mode = 'budget'
    else if (fallbacks.length >= 2) mode = 'auto'

    return {
      ok: true,
      message: `**Current mode:** ${mode}\n**Model:** \`${model}\`\n**Fallbacks:** ${fallbacks.length > 0 ? fallbacks.map((f: string) => `\`${f}\``).join(', ') : 'none'}`,
      data: { mode, model, fallbacks },
    }
  } catch {
    return { ok: false, message: 'Could not fetch current mode.' }
  }
}

async function executeListSessionsCommand(): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await runCommand('openclaw.sessions')
    if (!result.ok) return { ok: false, message: result.error || 'Could not list sessions' }
    return {
      ok: true,
      message: result.output
        ? `**Active Sessions:**\n\`\`\`\n${result.output}\n\`\`\``
        : 'No active sessions found.',
    }
  } catch {
    return { ok: false, message: 'Failed to list sessions.' }
  }
}

async function executeHealthCommand(): Promise<{ ok: boolean; message: string }> {
  try {
    const health = await getOpenClawHealth()
    return {
      ok: true,
      message: `**Agent Health:**\n\`\`\`\n${health}\n\`\`\``,
    }
  } catch {
    return { ok: false, message: 'Agent health check failed. The agent may be offline.' }
  }
}

async function executeGetCostsCommand(): Promise<{ ok: boolean; message: string; data?: Record<string, unknown> }> {
  try {
    // Fetch from our own costs API
    const config = await getEffectiveConfig()
    if (!config.openrouterApiKey) {
      return { ok: true, message: 'No OpenRouter API key configured — cost tracking unavailable.' }
    }

    const orRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${config.openrouterApiKey}` },
      cache: 'no-store',
    })

    if (!orRes.ok) return { ok: false, message: 'Could not fetch cost data from OpenRouter.' }
    const orData = await orRes.json()
    const usage = orData.data?.usage ?? 0
    const limit = orData.data?.limit ?? null
    const remaining = limit !== null ? limit - usage : null

    let msg = `**Cost Summary:**\n`
    msg += `• Total usage: **$${usage.toFixed(2)}**\n`
    if (limit !== null) {
      msg += `• Credit limit: **$${limit.toFixed(2)}**\n`
      msg += `• Remaining: **$${(remaining ?? 0).toFixed(2)}** (${((remaining ?? 0) / limit * 100).toFixed(0)}%)\n`
    }

    return { ok: true, message: msg, data: { usage, limit, remaining } }
  } catch {
    return { ok: false, message: 'Failed to fetch cost data.' }
  }
}

async function executeSetBudgetCommand(
  amount: string,
  request: NextRequest
): Promise<{ ok: boolean; message: string }> {
  const value = parseFloat(amount)
  if (isNaN(value) || value <= 0) {
    return { ok: false, message: `Invalid budget amount: "${amount}". Please provide a positive number.` }
  }

  try {
    // Call our budget API
    const baseUrl = request.nextUrl.origin
    const token = request.headers.get('x-mc-token') || ''
    const res = await fetch(`${baseUrl}/api/budget`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-mc-token': token,
      },
      body: JSON.stringify({ dailyLimit: value }),
    })

    if (!res.ok) throw new Error()
    return {
      ok: true,
      message: `Daily budget set to **$${value.toFixed(2)}**.`,
    }
  } catch {
    return { ok: false, message: 'Failed to set budget.' }
  }
}

async function executeSystemStatusCommand(): Promise<{ ok: boolean; message: string }> {
  try {
    const status = await getOpenClawSystemStatus()
    return {
      ok: true,
      message: `**System Status:**\n\`\`\`\n${status}\n\`\`\``,
    }
  } catch {
    return { ok: false, message: 'Could not fetch system status.' }
  }
}

async function executeLogsCommand(lines: string): Promise<{ ok: boolean; message: string }> {
  try {
    const count = Math.min(parseInt(lines) || 30, 100)
    const logs = await getOpenClawLogs(count)
    return {
      ok: true,
      message: logs
        ? `**Recent Logs** (${count} lines):\n\`\`\`\n${logs}\n\`\`\``
        : 'No logs available.',
    }
  } catch {
    return { ok: false, message: 'Could not fetch logs.' }
  }
}

async function executePluginsCommand(): Promise<{ ok: boolean; message: string }> {
  try {
    const plugins = await getOpenClawPlugins()
    return {
      ok: true,
      message: plugins
        ? `**Installed Plugins:**\n\`\`\`\n${plugins}\n\`\`\``
        : 'No plugins installed.',
    }
  } catch {
    return { ok: false, message: 'Could not list plugins.' }
  }
}

async function executeRawCommand(raw: string): Promise<{ ok: boolean; message: string }> {
  if (!raw.trim()) {
    return { ok: false, message: 'No command specified. Usage: `/run <command> [args]`' }
  }

  const parts = raw.trim().split(/\s+/)
  const cmd = parts[0]
  const arg = parts.slice(1).join(' ')

  try {
    const result = await runCommand(cmd, arg || undefined)
    if (!result.ok) {
      return { ok: false, message: result.error || `Command failed: ${cmd}` }
    }
    return {
      ok: true,
      message: result.output
        ? `**\`${cmd}\`:**\n\`\`\`\n${result.output}\n\`\`\``
        : `Command \`${cmd}\` executed successfully (no output).`,
    }
  } catch {
    return { ok: false, message: `Failed to execute: ${cmd}` }
  }
}

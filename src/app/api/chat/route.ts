import { NextRequest, NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/sanitize-error'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { isConfigured, runCommand } from '@/lib/openclaw'
import { getEffectiveConfig } from '@/lib/connection-config'

/**
 * Chat API — sends messages to OpenClaw agents and retrieves responses.
 *
 * GET  — list sessions or fetch session history
 * POST — send a message to an agent session
 */

async function setupFetch(path: string, options?: RequestInit): Promise<Response> {
  const config = await getEffectiveConfig()
  const auth = 'Basic ' + Buffer.from(':' + config.setupPassword).toString('base64')
  return fetch(`${config.openclawUrl}/setup/api${path}`, {
    ...options,
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    cache: 'no-store',
  })
}

const DEMO_SESSIONS = [
  { key: 'agent:default:main', agent: 'default', age: '2h ago', status: 'active' },
  { key: 'agent:scout:research', agent: 'scout', age: '5h ago', status: 'idle' },
]

const DEMO_HISTORY: Record<string, { role: 'user' | 'assistant' | 'system'; content: string }[]> = {
  'agent:default:main': [
    { role: 'user', content: "Research trending AI topics for this week's video" },
    {
      role: 'assistant',
      content: "I found 5 trending topics:\n\n1. **Claude 4 release** — Anthropic's latest model with extended thinking\n2. **OpenAI Codex CLI** — New terminal-based coding agent\n3. **Google Gemini 2.5 Flash** — Fast and cheap multimodal model\n4. **Local LLMs hitting GPT-4 level** — Llama 3.3 benchmarks\n5. **AI agent frameworks** — CrewAI vs LangGraph comparison\n\nShall I draft outlines for any of these?",
    },
    { role: 'user', content: 'Draft an outline for topic 1' },
    {
      role: 'assistant',
      content: "Here's a script outline for 'Claude 4 Release':\n\n**Hook:** \"Anthropic just mass-deployed a model that thinks before it speaks\"\n\n**Section 1: What changed**\n- Extended thinking (chain-of-thought visible)\n- 200k context window\n- Tool use improvements\n\n**Section 2: Real-world testing**\n- Coding benchmarks vs GPT-4o\n- Cost comparison ($3/MTok vs $15/MTok)\n- Speed test results\n\n**Section 3: Who should switch**\n- Best for: complex reasoning, long documents\n- Skip if: simple tasks, budget-constrained\n\n**CTA:** Link to OpenRouter for testing",
    },
  ],
}

const DEMO_SESSION_KEYS = new Set([
  ...DEMO_SESSIONS.map(session => session.key),
  ...Object.keys(DEMO_HISTORY),
])

function demoSessionsResponse() {
  return NextResponse.json({
    sessions: DEMO_SESSIONS,
    demo: true,
  })
}

function demoHistoryResponse(sessionKey: string) {
  return NextResponse.json({
    messages: DEMO_HISTORY[sessionKey] || [],
    demo: true,
  })
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action') || 'sessions'
  const sessionKey = request.nextUrl.searchParams.get('session') || ''
  const configured = await isConfigured()

  if (!configured) {
    if (action === 'sessions') return demoSessionsResponse()
    if (action === 'history' && sessionKey) return demoHistoryResponse(sessionKey)
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  try {
    if (action === 'sessions') {
      // List all active sessions
      const result = await runCommand('openclaw.sessions')
      if (!result.ok) {
        return demoSessionsResponse()
      }

      // Parse session list from output
      const sessions = parseSessionList(result.output || '')
      return NextResponse.json({ sessions, raw: result.output, demo: false })
    }

    if (action === 'history' && sessionKey) {
      // Get chat history for a specific session
      const result = await runCommand('openclaw.sessions.history', sessionKey)
      if (!result.ok) {
        if (DEMO_SESSION_KEYS.has(sessionKey)) {
          return demoHistoryResponse(sessionKey)
        }
        return NextResponse.json({ messages: [], raw: result.error || 'Could not fetch history', demo: false })
      }

      const messages = parseMessages(result.output || '')
      return NextResponse.json({ messages, raw: result.output, demo: false })
    }

    if (action === 'status') {
      // Get session status
      const result = await runCommand('openclaw.sessions.status', sessionKey || undefined)
      return NextResponse.json({ status: result.output, ok: result.ok })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Chat API error') },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()
  if (!(await isConfigured())) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  try {
    let body: { action: string; message?: string; session?: string; agent?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { action, message, session, agent } = body

    if (action === 'send' && message) {
      // Send a message to a session
      const target = session || 'main'
      const arg = `${target} ${message}`
      const result = await runCommand('openclaw.sessions.send', arg)

      if (!result.ok) {
        return NextResponse.json({
          ok: false,
          error: result.error || 'Failed to send message',
        })
      }

      return NextResponse.json({
        ok: true,
        output: result.output,
      })
    }

    if (action === 'spawn') {
      // Spawn a new session
      const agentName = agent || 'default'
      const result = await runCommand('openclaw.sessions.spawn', agentName)

      if (!result.ok) {
        return NextResponse.json({
          ok: false,
          error: result.error || 'Failed to spawn session',
        })
      }

      return NextResponse.json({
        ok: true,
        output: result.output,
        session: result.output?.trim(),
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Chat send error') },
      { status: 500 }
    )
  }
}

// ─── Parsers ─────────────────────────────────────────────

function parseSessionList(raw: string): { key: string; agent: string; age: string; status: string }[] {
  const sessions: { key: string; agent: string; age: string; status: string }[] = []

  // Try table format: │ key │ agent │ age │ status │
  const tableRows = raw.match(/│\s*(\S+)\s*│\s*(\S+)\s*│\s*(.+?)\s*│\s*(\S+)\s*│/g)
  if (tableRows) {
    for (const row of tableRows) {
      const match = row.match(/│\s*(\S+)\s*│\s*(\S+)\s*│\s*(.+?)\s*│\s*(\S+)\s*│/)
      if (match && match[1] !== 'key' && match[1] !== '─') {
        sessions.push({
          key: match[1],
          agent: match[2],
          age: match[3].trim(),
          status: match[4],
        })
      }
    }
    if (sessions.length > 0) return sessions
  }

  // Try list format: - session_key (agent: name, 5m ago)
  const listRegex = /[-•]\s*(\S+)\s*\((?:agent:\s*)?(\S+?)(?:,\s*(.+?))?\)/g
  let m
  while ((m = listRegex.exec(raw)) !== null) {
    sessions.push({
      key: m[1],
      agent: m[2],
      age: m[3] || '',
      status: 'active',
    })
  }

  // If nothing parsed, try line-by-line
  if (sessions.length === 0) {
    const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('─') && !l.startsWith('='))
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('Sessions') && !trimmed.startsWith('No ')) {
        sessions.push({
          key: trimmed.split(/\s+/)[0] || trimmed,
          agent: 'unknown',
          age: '',
          status: 'active',
        })
      }
    }
  }

  return sessions
}

function parseMessages(raw: string): { role: 'user' | 'assistant' | 'system'; content: string; timestamp?: string }[] {
  const messages: { role: 'user' | 'assistant' | 'system'; content: string; timestamp?: string }[] = []

  // Try to parse structured message output
  // Common formats: [timestamp] role: message
  const msgRegex = /(?:\[(.+?)\]\s*)?(user|human|assistant|agent|system|bot):\s*(.+)/gi
  let m
  while ((m = msgRegex.exec(raw)) !== null) {
    const roleStr = m[2].toLowerCase()
    const role: 'user' | 'assistant' | 'system' =
      roleStr === 'user' || roleStr === 'human' ? 'user' :
      roleStr === 'system' ? 'system' : 'assistant'

    messages.push({
      role,
      content: m[3].trim(),
      timestamp: m[1] || undefined,
    })
  }

  // If no structured messages found, treat the whole output as context
  if (messages.length === 0 && raw.trim()) {
    messages.push({
      role: 'system',
      content: raw.trim(),
    })
  }

  return messages
}

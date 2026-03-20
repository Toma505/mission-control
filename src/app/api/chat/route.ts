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

export async function GET(request: NextRequest) {
  if (!(await isConfigured())) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  const action = request.nextUrl.searchParams.get('action') || 'sessions'
  const sessionKey = request.nextUrl.searchParams.get('session') || ''

  try {
    if (action === 'sessions') {
      // List all active sessions
      const result = await runCommand('openclaw.sessions')
      if (!result.ok) {
        return NextResponse.json({ sessions: [], raw: result.error || 'Could not list sessions' })
      }

      // Parse session list from output
      const sessions = parseSessionList(result.output || '')
      return NextResponse.json({ sessions, raw: result.output })
    }

    if (action === 'history' && sessionKey) {
      // Get chat history for a specific session
      const result = await runCommand('openclaw.sessions.history', sessionKey)
      if (!result.ok) {
        return NextResponse.json({ messages: [], raw: result.error || 'Could not fetch history' })
      }

      const messages = parseMessages(result.output || '')
      return NextResponse.json({ messages, raw: result.output })
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

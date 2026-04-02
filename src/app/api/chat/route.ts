import { NextRequest, NextResponse } from 'next/server'

import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { DEMO_HISTORY, DEMO_SESSION_KEYS, DEMO_SESSIONS, parseMessages, parseSessionList } from '@/lib/chat-history'
import { isConfigured, runCommand } from '@/lib/openclaw'
import { sanitizeError } from '@/lib/sanitize-error'

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
      const result = await runCommand('openclaw.sessions')
      if (!result.ok) {
        return demoSessionsResponse()
      }

      const sessions = parseSessionList(result.output || '')
      return NextResponse.json({ sessions, raw: result.output, demo: false })
    }

    if (action === 'history' && sessionKey) {
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
      const result = await runCommand('openclaw.sessions.status', sessionKey || undefined)
      return NextResponse.json({ status: result.output, ok: result.ok })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Chat API error') },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()
  if (!(await isConfigured())) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  try {
    const body = await request.json().catch(() => null) as
      | { action?: string; message?: string; session?: string; agent?: string }
      | null

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { action, message, session, agent } = body

    if (action === 'send' && message) {
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
      { status: 500 },
    )
  }
}

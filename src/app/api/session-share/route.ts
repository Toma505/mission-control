import { NextRequest, NextResponse } from 'next/server'

import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { getAgentIdFromSessionKey, parseMessages } from '@/lib/chat-history'
import { isConfigured, runCommand } from '@/lib/openclaw'
import { getReplaySession, importReplaySession } from '@/lib/replay-store'
import {
  buildReplaySessionFromChatSession,
  buildSharedSessionPayload,
  createDownloadName,
  parseSharedSessionContent,
  renderSharedSessionHtml,
} from '@/lib/session-share'
import { sanitizeError } from '@/lib/sanitize-error'

async function getChatMessages(sessionKey: string) {
  if (!(await isConfigured())) return null

  const result = await runCommand('openclaw.sessions.history', sessionKey)
  if (!result.ok) return null
  return parseMessages(result.output || '')
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const searchParams = request.nextUrl.searchParams
    const source = searchParams.get('source')
    const format = searchParams.get('format') === 'html' ? 'html' : 'json'
    const sessionId = searchParams.get('session') || searchParams.get('id') || ''

    if (!sessionId) {
      return NextResponse.json({ error: 'A session identifier is required.' }, { status: 400 })
    }

    if (source !== 'chat' && source !== 'replay') {
      return NextResponse.json({ error: 'Invalid session source.' }, { status: 400 })
    }

    let session
    if (source === 'chat') {
      const messages = await getChatMessages(sessionId)
      if (!messages || messages.length === 0) {
        return NextResponse.json({ error: 'Chat session not found.' }, { status: 404 })
      }

      const agentId = searchParams.get('agent') || getAgentIdFromSessionKey(sessionId)
      session = buildReplaySessionFromChatSession({
        sessionKey: sessionId,
        agentId,
        messages,
      })
    } else {
      session = await getReplaySession(sessionId)
      if (!session) {
        return NextResponse.json({ error: 'Replay session not found.' }, { status: 404 })
      }
    }

    const payload = buildSharedSessionPayload(source, session)
    const fileName = createDownloadName(session, format)

    if (format === 'html') {
      return new NextResponse(renderSharedSessionHtml(payload), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to export session.') },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const file = (await request.formData()).get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A shared session file is required.' }, { status: 400 })
    }

    const raw = await file.text()
    const session = parseSharedSessionContent(raw)
    const imported = await importReplaySession(session)

    return NextResponse.json({
      ok: true,
      session: {
        id: imported.id,
        sessionKey: imported.sessionKey,
        agentId: imported.agentId,
        instanceId: imported.instanceId,
        model: imported.model,
        taskDescription: imported.taskDescription,
        startedAt: imported.startedAt,
        completedAt: imported.completedAt,
        durationMs: imported.durationMs,
        status: imported.status,
        stepCount: imported.steps.length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to import shared session.') },
      { status: 400 },
    )
  }
}

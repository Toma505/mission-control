import { NextRequest, NextResponse } from 'next/server'

import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import {
  continueAgentConversation,
  createAgentConversation,
  interveneAgentConversation,
  listAgentConversations,
} from '@/lib/agent-chat-store'
import { sanitizeError } from '@/lib/sanitize-error'

export async function GET() {
  try {
    const conversations = await listAgentConversations()
    return NextResponse.json({ conversations })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to load agent conversations.') },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json().catch(() => null) as
      | {
          action?: string
          goal?: string
          conversationId?: string
          message?: string
          agentAId?: string
          agentBId?: string
          instanceAId?: string
          instanceBId?: string
        }
      | null

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    if (body.action === 'create') {
      if (!body.goal?.trim() || !body.agentAId || !body.agentBId || !body.instanceAId || !body.instanceBId) {
        return NextResponse.json({ error: 'Goal, agents, and instances are required.' }, { status: 400 })
      }

      const conversation = await createAgentConversation({
        goal: body.goal.trim(),
        agentA: { agentId: body.agentAId, instanceId: body.instanceAId },
        agentB: { agentId: body.agentBId, instanceId: body.instanceBId },
      })

      return NextResponse.json({ ok: true, conversation })
    }

    if (body.action === 'continue') {
      if (!body.conversationId) {
        return NextResponse.json({ error: 'Conversation id is required.' }, { status: 400 })
      }
      const conversation = await continueAgentConversation(body.conversationId)
      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
      }
      return NextResponse.json({ ok: true, conversation })
    }

    if (body.action === 'intervene') {
      if (!body.conversationId || !body.message?.trim()) {
        return NextResponse.json({ error: 'Conversation id and message are required.' }, { status: 400 })
      }
      const conversation = await interveneAgentConversation(body.conversationId, body.message.trim())
      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
      }
      return NextResponse.json({ ok: true, conversation })
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to update agent chat.') },
      { status: 500 },
    )
  }
}

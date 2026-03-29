import { NextRequest, NextResponse } from 'next/server'

import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import {
  deleteOrchestration,
  getOrchestrationPayload,
  startOrchestration,
} from '@/lib/orchestrations'
import { sanitizeError } from '@/lib/sanitize-error'

export async function GET() {
  try {
    return NextResponse.json(await getOrchestrationPayload())
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to load orchestrations.') },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const action = typeof body.action === 'string' ? body.action : 'run'

    if (action === 'delete') {
      const orchestrationId = String(body.orchestrationId || '').trim()
      if (!orchestrationId) {
        return NextResponse.json({ error: 'Orchestration id is required.' }, { status: 400 })
      }

      const result = await deleteOrchestration(orchestrationId)
      if (result === 'missing') {
        return NextResponse.json({ error: 'Orchestration not found.' }, { status: 404 })
      }
      if (result === 'running') {
        return NextResponse.json(
          { error: 'Running orchestrations cannot be deleted.' },
          { status: 409 },
        )
      }

      return NextResponse.json({
        ok: true,
        payload: await getOrchestrationPayload(),
      })
    }

    const orchestration = await startOrchestration(body)
    return NextResponse.json({
      ok: true,
      orchestration,
      payload: await getOrchestrationPayload(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to launch orchestration.') },
      { status: 500 },
    )
  }
}

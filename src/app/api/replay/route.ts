import { NextRequest, NextResponse } from 'next/server'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { getReplaySession, listReplaySessions } from '@/lib/replay-store'

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  const sessionId = request.nextUrl.searchParams.get('session')

  if (sessionId) {
    const session = await getReplaySession(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Replay session not found' }, { status: 404 })
    }

    return NextResponse.json({ session })
  }

  const sessions = await listReplaySessions()
  return NextResponse.json({ sessions })
}

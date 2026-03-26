/**
 * Returns the session token to the renderer.
 *
 * This endpoint is only accessible from localhost (enforced by middleware).
 * The renderer calls this once on boot and caches the token for all
 * subsequent mutating API calls.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionToken, isTrustedLocalhostRequest, localOnlyResponse } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  if (!isTrustedLocalhostRequest(request)) {
    return localOnlyResponse()
  }

  return NextResponse.json({ token: getSessionToken() })
}

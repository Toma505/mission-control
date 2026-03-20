/**
 * Returns the session token to the renderer.
 *
 * This endpoint is only accessible from localhost (enforced by middleware).
 * The renderer calls this once on boot and caches the token for all
 * subsequent mutating API calls.
 */

import { NextResponse } from 'next/server'
import { getSessionToken } from '@/lib/api-auth'

export async function GET() {
  return NextResponse.json({ token: getSessionToken() })
}

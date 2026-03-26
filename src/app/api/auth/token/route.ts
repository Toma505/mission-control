/**
 * Legacy HTTP bootstrap for the session token.
 *
 * The desktop renderer should retrieve the token via Electron IPC. This route
 * stays opt-in for development troubleshooting only and is disabled by
 * default, even on localhost.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getSessionToken,
  isHttpTokenBootstrapEnabled,
  isTrustedLocalhostRequest,
  localOnlyResponse,
} from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  if (!isTrustedLocalhostRequest(request) || !isHttpTokenBootstrapEnabled()) {
    return localOnlyResponse()
  }

  return NextResponse.json(
    { token: getSessionToken() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

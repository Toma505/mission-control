/**
 * API authentication for the embedded Next.js server.
 *
 * In a desktop Electron app, there is no external API_SECRET — the server
 * is only accessible to the local machine.  We use a per-session random
 * token generated at startup.  Electron injects it via the MC_SESSION_TOKEN
 * environment variable; the renderer sends it on every mutating request.
 *
 * Read endpoints (GET) are unprotected — they only return data to the
 * localhost UI.  Write endpoints (POST/PUT/DELETE) require the token.
 */

import { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'

// ─── Session token ─────────────────────────────────────────
// Priority: env var (set by Electron main process) > generated fallback
// In dev mode a stable token is generated once per server start.
const SESSION_TOKEN: string =
  process.env.MC_SESSION_TOKEN || randomBytes(32).toString('hex')

/** Expose the token so Electron can read it at startup if needed. */
export function getSessionToken(): string {
  return SESSION_TOKEN
}

/**
 * Checks whether a mutating request carries the correct session token.
 *
 * Accepts the token in either:
 *   - `x-mc-token` header  (preferred — set by fetch wrappers)
 *   - `authorization: Bearer <token>` header
 */
export function isAuthorized(request: NextRequest): boolean {
  const headerToken =
    request.headers.get('x-mc-token') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (!headerToken) return false
  return headerToken === SESSION_TOKEN
}

export function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

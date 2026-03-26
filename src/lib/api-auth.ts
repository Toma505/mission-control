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

const TRUSTED_LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

// ─── Session token ─────────────────────────────────────────
type AuthGlobals = typeof globalThis & {
  __mcSessionToken?: string
}

function resolveSessionToken() {
  if (process.env.MC_SESSION_TOKEN) return process.env.MC_SESSION_TOKEN

  const globals = globalThis as AuthGlobals
  if (globals.__mcSessionToken) return globals.__mcSessionToken

  const generated = randomBytes(32).toString('hex')
  globals.__mcSessionToken = generated
  process.env.MC_SESSION_TOKEN = generated
  return generated
}

// Priority: env var (set by Electron main process) > generated fallback.
// In dev mode the generated fallback is stored on globalThis + process.env
// so every route module sees the same token for the lifetime of the server.
const SESSION_TOKEN: string = resolveSessionToken()

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

function getRequestHost(request: NextRequest) {
  const rawHost =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    ''

  return rawHost
    .split(',')[0]
    .trim()
    .replace(/:\d+$/, '')
    .toLowerCase()
}

export function isTrustedLocalhostRequest(request: NextRequest) {
  return TRUSTED_LOCAL_HOSTS.has(getRequestHost(request))
}

export function localOnlyResponse() {
  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })
}

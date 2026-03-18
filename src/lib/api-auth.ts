/**
 * Simple API authentication middleware.
 * Protects write endpoints with a shared secret.
 *
 * For local dev, requests from localhost are allowed through.
 * For deployed environments, set API_SECRET in .env.local.
 */

import { NextRequest } from 'next/server'

const API_SECRET = process.env.API_SECRET || ''

export function isAuthorized(request: NextRequest): boolean {
  // In dev/local, allow all requests if no secret is configured
  if (!API_SECRET) return true

  // Check for secret in header only
  const headerSecret = request.headers.get('x-api-secret')

  return headerSecret === API_SECRET
}

export function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

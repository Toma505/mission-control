import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware handles three things:
 * 1. Redirects unconfigured users to /activate (if unlicensed) or /setup (if licensed)
 * 2. Blocks API requests from non-localhost origins (CSRF protection)
 * 3. Sets security headers on all responses
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ─── Setup / activation redirect for page navigations ───────
  if (
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/setup') &&
    !pathname.startsWith('/activate') &&
    !pathname.startsWith('/_next') &&
    !pathname.includes('.')
  ) {
    try {
      const baseUrl = request.nextUrl.origin
      const res = await fetch(`${baseUrl}/api/connection`, { cache: 'no-store' })
      const data = await res.json()

      if (!data.configured) {
        const destination = await getUnconfiguredDestination(baseUrl)
        return NextResponse.redirect(new URL(destination, request.url))
      }
    } catch {
      try {
        const baseUrl = request.nextUrl.origin
        const destination = await getUnconfiguredDestination(baseUrl)
        return NextResponse.redirect(new URL(destination, request.url))
      } catch {
        return NextResponse.redirect(new URL('/activate', request.url))
      }
    }

    return addSecurityHeaders(NextResponse.next())
  }

  // ─── API security: origin validation ──────────────────────
  if (pathname.startsWith('/api')) {
    // Allow same-origin requests (renderer → embedded server)
    // Block cross-origin requests from external sites (CSRF protection)
    const origin = request.headers.get('origin')

    if (origin) {
      // Browser requests always include Origin on cross-origin POSTs.
      // Only allow requests from the same origin (localhost/127.0.0.1).
      const requestHost = request.headers.get('host') || ''
      let originHost: string
      try {
        originHost = new URL(origin).host
      } catch {
        return new NextResponse(
          JSON.stringify({ error: 'Invalid origin' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (originHost !== requestHost) {
        return new NextResponse(
          JSON.stringify({ error: 'Cross-origin requests are not allowed' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // Non-browser requests (curl, Electron main process) omit Origin.
    // These are allowed through — write endpoints additionally require
    // the session token via isAuthorized() in each route handler.

    return addSecurityHeaders(NextResponse.next())
  }

  return addSecurityHeaders(NextResponse.next())
}

/**
 * Checks license status to decide where unconfigured users should land.
 */
async function getUnconfiguredDestination(baseUrl: string): Promise<string> {
  try {
    const res = await fetch(`${baseUrl}/api/license`, { cache: 'no-store' })
    const data = await res.json()
    return data.licensed ? '/setup' : '/activate'
  } catch {
    return '/activate'
  }
}

/**
 * Adds security headers to responses.
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent the API from being embedded in iframes
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon).*)'],
}

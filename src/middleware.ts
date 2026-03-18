import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware handles two things:
 * 1. Redirects unconfigured users to /activate (if unlicensed) or /setup (if licensed) on first run
 * 2. Blocks API requests from non-localhost origins (security)
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
        // Not configured — check license before deciding where to send them
        const destination = await getUnconfiguredDestination(baseUrl)
        return NextResponse.redirect(new URL(destination, request.url))
      }
    } catch {
      // If the connection API itself is unreachable, check license to decide
      // between /activate and /setup so users don't skip activation
      try {
        const baseUrl = request.nextUrl.origin
        const destination = await getUnconfiguredDestination(baseUrl)
        return NextResponse.redirect(new URL(destination, request.url))
      } catch {
        return NextResponse.redirect(new URL('/activate', request.url))
      }
    }

    return NextResponse.next()
  }

  // ─── API security: localhost only ───────────────────────────
  if (pathname.startsWith('/api')) {
    const host = request.headers.get('host') || ''
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1')

    const origin = request.headers.get('origin') || ''
    const isInternalFetch = origin === '' || origin.includes('localhost') || origin.includes('127.0.0.1')

    if (!isLocalhost && !isInternalFetch) {
      return new NextResponse(
        JSON.stringify({ error: 'Access denied — localhost only' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  return NextResponse.next()
}

/**
 * Checks license status to decide where unconfigured users should land.
 * Licensed users go to /setup; unlicensed users go to /activate first.
 */
async function getUnconfiguredDestination(baseUrl: string): Promise<string> {
  try {
    const res = await fetch(`${baseUrl}/api/license`, { cache: 'no-store' })
    const data = await res.json()
    return data.licensed ? '/setup' : '/activate'
  } catch {
    // If license API is unreachable, default to /activate (safer — don't skip activation)
    return '/activate'
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon).*)'],
}

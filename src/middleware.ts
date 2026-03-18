import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware handles two things:
 * 1. Redirects unconfigured users to /setup on first run
 * 2. Blocks API requests from non-localhost origins (security)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ─── Setup redirect for page navigations ────────────────────
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
        return NextResponse.redirect(new URL('/setup', request.url))
      }
    } catch {
      // If check fails, let user through — they can configure later
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

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon).*)'],
}

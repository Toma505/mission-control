import { NextRequest, NextResponse } from 'next/server'

const LOCAL_API_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])
const PUBLIC_API_ALLOWLIST = new Set([
  '/api/commerce/checkout',
  '/api/commerce/webhook',
  '/api/license-control/activate',
  '/api/license-control/validate',
])

function buildContentSecurityPolicy() {
  const isDev = process.env.NODE_ENV !== 'production'
  const connectSrc = ["'self'"]

  if (isDev) {
    connectSrc.push(
      'http://127.0.0.1:3000',
      'http://localhost:3000',
      'ws://127.0.0.1:3000',
      'ws://localhost:3000',
    )
  }

  // Next.js currently emits inline bootstrap/runtime scripts for this app.
  // Adding a nonce here would cause browsers to ignore 'unsafe-inline',
  // which previously broke activation and app-shell hydration in production.
  // Keep script-src explicit until the app can attach CSP nonces end-to-end.
  const scriptSrc = ["'self'", "'unsafe-inline'"]
  if (isDev) {
    scriptSrc.push("'unsafe-eval'")
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

function addSecurityHeaders(response: NextResponse, contentSecurityPolicy: string) {
  response.headers.set('Content-Security-Policy', contentSecurityPolicy)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

async function getUnconfiguredDestination(baseUrl: string): Promise<string> {
  try {
    const res = await fetch(`${baseUrl}/api/license`, { cache: 'no-store' })
    const data = await res.json()
    return data.licensed ? '/setup' : '/activate'
  } catch {
    return '/activate'
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const contentSecurityPolicy = buildContentSecurityPolicy()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy)

  const continueRequest = () =>
    addSecurityHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
      contentSecurityPolicy,
    )

  if (
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/setup') &&
    !pathname.startsWith('/activate') &&
    !pathname.startsWith('/purchase') &&
    !pathname.startsWith('/download') &&
    !pathname.startsWith('/_next') &&
    !pathname.includes('.')
  ) {
    try {
      const baseUrl = request.nextUrl.origin
      const res = await fetch(`${baseUrl}/api/connection`, { cache: 'no-store' })
      const data = await res.json()

      if (!data.configured) {
        const destination = await getUnconfiguredDestination(baseUrl)
        return addSecurityHeaders(
          NextResponse.redirect(new URL(destination, request.url)),
          contentSecurityPolicy,
        )
      }
    } catch {
      try {
        const baseUrl = request.nextUrl.origin
        const destination = await getUnconfiguredDestination(baseUrl)
        return addSecurityHeaders(
          NextResponse.redirect(new URL(destination, request.url)),
          contentSecurityPolicy,
        )
      } catch {
        return addSecurityHeaders(
          NextResponse.redirect(new URL('/activate', request.url)),
          contentSecurityPolicy,
        )
      }
    }

    return continueRequest()
  }

  if (pathname.startsWith('/api')) {
    const requestHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
    const normalizedHost = requestHost
      .split(',')[0]
      .trim()
      .replace(/:\d+$/, '')
      .toLowerCase()

    if (!LOCAL_API_HOSTS.has(normalizedHost) && !PUBLIC_API_ALLOWLIST.has(pathname)) {
      return addSecurityHeaders(
        new NextResponse(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
        contentSecurityPolicy,
      )
    }

    const origin = request.headers.get('origin')

    if (origin) {
      const requestHostHeader = request.headers.get('host') || ''
      let originHost: string

      try {
        originHost = new URL(origin).host
      } catch {
        return addSecurityHeaders(
          new NextResponse(JSON.stringify({ error: 'Invalid origin' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }),
          contentSecurityPolicy,
        )
      }

      if (originHost !== requestHostHeader) {
        return addSecurityHeaders(
          new NextResponse(JSON.stringify({ error: 'Cross-origin requests are not allowed' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }),
          contentSecurityPolicy,
        )
      }
    }

    return continueRequest()
  }

  return continueRequest()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon).*)'],
}

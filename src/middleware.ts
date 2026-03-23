import { NextRequest, NextResponse } from 'next/server'

function generateNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function buildContentSecurityPolicy(nonce: string) {
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

  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]
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
  const nonce = generateNonce()
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
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
    const origin = request.headers.get('origin')

    if (origin) {
      const requestHost = request.headers.get('host') || ''
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

      if (originHost !== requestHost) {
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

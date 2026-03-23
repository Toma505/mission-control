import { NextRequest, NextResponse } from 'next/server'

declare global {
  // eslint-disable-next-line no-var
  var __mcRateLimitBuckets: Map<string, { count: number; resetAt: number }> | undefined
}

type RateLimitOptions = {
  bucket: string
  max: number
  windowMs: number
  message: string
}

function getRateLimitStore() {
  if (!globalThis.__mcRateLimitBuckets) {
    globalThis.__mcRateLimitBuckets = new Map()
  }

  return globalThis.__mcRateLimitBuckets
}

function pruneExpiredBuckets(now: number) {
  const store = getRateLimitStore()
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) {
      store.delete(key)
    }
  }
}

export function getClientIp(request: NextRequest) {
  const cfIp = request.headers.get('cf-connecting-ip')?.trim()
  if (cfIp) return cfIp

  const forwarded = request.headers.get('x-forwarded-for') || ''
  const firstForwarded = forwarded
    .split(',')
    .map((value) => value.trim())
    .find(Boolean)
  if (firstForwarded) return firstForwarded

  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  return 'unknown'
}

export function rateLimitResponse(message: string, retryAfterSeconds: number) {
  const response = NextResponse.json({ error: message }, { status: 429 })
  response.headers.set('Retry-After', String(Math.max(1, retryAfterSeconds)))
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export function maybeRateLimit(request: NextRequest, options: RateLimitOptions) {
  if (process.env.NODE_ENV !== 'production') {
    return null
  }

  const now = Date.now()
  const store = getRateLimitStore()
  if (store.size > 2000) {
    pruneExpiredBuckets(now)
  }

  const clientIp = getClientIp(request)
  const key = `${options.bucket}:${clientIp}`
  const current = store.get(key)

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs })
    return null
  }

  current.count += 1
  store.set(key, current)

  if (current.count <= options.max) {
    return null
  }

  const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000)
  return rateLimitResponse(options.message, retryAfterSeconds)
}

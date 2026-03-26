import { NextRequest, NextResponse } from 'next/server'
import { isAuthorized, isTrustedLocalhostRequest, localOnlyResponse, unauthorizedResponse } from '@/lib/api-auth'
import { validateExternalUrl } from '@/lib/url-validator'

export async function POST(request: NextRequest) {
  if (!isTrustedLocalhostRequest(request)) return localOnlyResponse()
  if (!isAuthorized(request)) return unauthorizedResponse()

  let body: { openclawUrl?: string; setupPassword?: string; openrouterApiKey?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({
      openclaw: { ok: false, error: 'Invalid request — could not parse form data', version: '' },
      openrouter: { ok: false, error: '', credits: 0 },
    })
  }
  const { openclawUrl, setupPassword, openrouterApiKey } = body

  const results = {
    openclaw: { ok: false, error: '', version: '' },
    openrouter: { ok: false, error: '', credits: 0 },
  }

  // Test OpenClaw connection
  if (openclawUrl && setupPassword) {
    // SSRF protection
    const urlError = validateExternalUrl(openclawUrl)
    if (urlError) {
      results.openclaw.error = urlError
      return NextResponse.json(results)
    }

    try {
      const url = openclawUrl.replace(/\/+$/, '')
      const auth = 'Basic ' + Buffer.from(':' + setupPassword).toString('base64')
      const res = await fetch(`${url}/setup/api/status`, {
        headers: { Authorization: auth },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      })

      if (res.ok) {
        const data = await res.json()
        results.openclaw = { ok: true, error: '', version: data.openclawVersion || 'connected' }
      } else if (res.status === 401) {
        results.openclaw.error = 'Invalid password — check OPENCLAW_SETUP_PASSWORD in your deployment'
      } else if (res.status === 403) {
        results.openclaw.error = 'Access denied — the server rejected the request (HTTP 403)'
      } else if (res.status === 404) {
        results.openclaw.error = 'OpenClaw setup API not found — check that the URL points to an OpenClaw instance'
      } else if (res.status >= 500) {
        results.openclaw.error = `Server error (HTTP ${res.status}) — OpenClaw may be starting up, try again in a moment`
      } else {
        results.openclaw.error = `Unexpected response (HTTP ${res.status}) — verify the URL is correct`
      }
    } catch (e) {
      if (e instanceof Error) {
        if (e.name === 'TimeoutError' || e.name === 'AbortError') {
          results.openclaw.error = 'Connection timed out — check the URL and that your server is running'
        } else if (e.message.includes('ECONNREFUSED')) {
          results.openclaw.error = 'Connection refused — the server is not accepting connections on this URL'
        } else if (e.message.includes('ENOTFOUND') || e.message.includes('getaddrinfo')) {
          results.openclaw.error = 'Server not found — check that the URL is spelled correctly'
        } else if (e.message.includes('certificate') || e.message.includes('SSL') || e.message.includes('CERT')) {
          results.openclaw.error = 'SSL certificate error — the server\'s certificate could not be verified'
        } else {
          results.openclaw.error = 'Could not reach server — verify the URL and that your instance is running'
        }
      } else {
        results.openclaw.error = 'Connection failed — verify the URL and try again'
      }
    }
  }

  // Test OpenRouter API key
  if (openrouterApiKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${openrouterApiKey}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      })

      if (res.ok) {
        const data = await res.json()
        results.openrouter = {
          ok: true,
          error: '',
          credits: data.data?.limit_remaining ?? 0,
        }
      } else {
        results.openrouter.error = 'Invalid API key'
      }
    } catch {
      results.openrouter.error = 'Could not reach OpenRouter'
    }
  }

  return NextResponse.json(results)
}

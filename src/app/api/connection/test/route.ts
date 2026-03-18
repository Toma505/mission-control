import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  const { openclawUrl, setupPassword, openrouterApiKey } = body

  const results = {
    openclaw: { ok: false, error: '', version: '' },
    openrouter: { ok: false, error: '', credits: 0 },
  }

  // Test OpenClaw connection
  if (openclawUrl && setupPassword) {
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
        results.openclaw.error = 'Invalid password'
      } else {
        results.openclaw.error = `Server returned ${res.status}`
      }
    } catch (e) {
      results.openclaw.error = e instanceof Error
        ? (e.name === 'TimeoutError' ? 'Connection timed out' : 'Could not reach server')
        : 'Connection failed'
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

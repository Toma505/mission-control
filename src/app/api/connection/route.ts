import { NextRequest, NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/sanitize-error'
import { isAuthorized, isTrustedLocalhostRequest, localOnlyResponse, unauthorizedResponse } from '@/lib/api-auth'
import { validateExternalUrl } from '@/lib/url-validator'
import {
  isConnectionConfigEncryptionAvailable,
  readConnectionConfig,
  writeConnectionConfig,
} from '@/lib/connection-config'

export async function GET(request: NextRequest) {
  if (!isTrustedLocalhostRequest(request)) return localOnlyResponse()
  if (!isAuthorized(request)) return unauthorizedResponse()

  const encryptionAvailable = isConnectionConfigEncryptionAvailable()

  const config = await readConnectionConfig()

  if (!config) {
    // Check if env vars are set (legacy setup)
    const envConfigured = !!(process.env.OPENCLAW_API_URL && process.env.OPENCLAW_SETUP_PASSWORD)
    return NextResponse.json({
      configured: envConfigured,
      source: envConfigured ? 'env' : 'none',
      openclawUrl: envConfigured ? process.env.OPENCLAW_API_URL : null,
      encryptionAvailable,
    })
  }

  return NextResponse.json({
    configured: true,
    source: 'file',
    openclawUrl: config.openclawUrl,
    hasOpenrouterKey: !!config.openrouterApiKey,
    configuredAt: config.configuredAt,
    encryptionAvailable,
  })
}

export async function POST(request: NextRequest) {
  if (!isTrustedLocalhostRequest(request)) return localOnlyResponse()
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }
    const { openclawUrl, setupPassword, openrouterApiKey, openrouterMgmtKey } = body as {
      openclawUrl?: string; setupPassword?: string; openrouterApiKey?: string; openrouterMgmtKey?: string
    }

    if (!openclawUrl || !setupPassword) {
      return NextResponse.json(
        { error: 'OpenClaw URL and Setup Password are required' },
        { status: 400 }
      )
    }

    // SSRF protection — validate URL before storing
    const urlError = validateExternalUrl(openclawUrl)
    if (urlError) {
      return NextResponse.json({ error: urlError }, { status: 400 })
    }

    // Normalize URL — remove trailing slash
    const normalizedUrl = openclawUrl.replace(/\/+$/, '')

    await writeConnectionConfig({
      openclawUrl: normalizedUrl,
      setupPassword,
      openrouterApiKey: openrouterApiKey || '',
      openrouterMgmtKey: openrouterMgmtKey || '',
      configuredAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to save connection settings') },
      { status: 500 }
    )
  }
}

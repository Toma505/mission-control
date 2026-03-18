import { NextResponse } from 'next/server'
import { readConnectionConfig, writeConnectionConfig } from '@/lib/connection-config'

export async function GET() {
  const config = await readConnectionConfig()

  if (!config) {
    // Check if env vars are set (legacy setup)
    const envConfigured = !!(process.env.OPENCLAW_API_URL && process.env.OPENCLAW_SETUP_PASSWORD)
    return NextResponse.json({
      configured: envConfigured,
      source: envConfigured ? 'env' : 'none',
      openclawUrl: envConfigured ? process.env.OPENCLAW_API_URL : null,
    })
  }

  return NextResponse.json({
    configured: true,
    source: 'file',
    openclawUrl: config.openclawUrl,
    hasOpenrouterKey: !!config.openrouterApiKey,
    configuredAt: config.configuredAt,
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { openclawUrl, setupPassword, openrouterApiKey, openrouterMgmtKey } = body

    if (!openclawUrl || !setupPassword) {
      return NextResponse.json(
        { error: 'OpenClaw URL and Setup Password are required' },
        { status: 400 }
      )
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
      { error: error instanceof Error ? error.message : 'Failed to save connection' },
      { status: 500 }
    )
  }
}

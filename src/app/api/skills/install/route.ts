import { NextRequest, NextResponse } from 'next/server'
import { isConfigured } from '@/lib/openclaw'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { getEffectiveConfig } from '@/lib/connection-config'

async function runCommand(cmd: string, arg?: string) {
  const config = await getEffectiveConfig()
  const OPENCLAW_URL = config.openclawUrl
  const auth = 'Basic ' + Buffer.from(':' + config.setupPassword).toString('base64')

  const res = await fetch(`${OPENCLAW_URL}/setup/api/console/run`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cmd, arg: arg || '' }),
  })
  return res.json()
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  if (!(await isConfigured())) {
    return NextResponse.json({ error: 'OpenClaw not configured' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { skillName } = body

    if (!skillName || typeof skillName !== 'string') {
      return NextResponse.json({ error: 'Skill name is required' }, { status: 400 })
    }

    // Sanitize skill name — only allow safe npm package name chars
    if (!/^[@a-zA-Z0-9._/-]+$/.test(skillName)) {
      return NextResponse.json({ error: 'Invalid skill name' }, { status: 400 })
    }

    // Install via OpenClaw's plugin install command
    const installResult = await runCommand('openclaw.plugins.install', skillName)

    if (installResult.ok) {
      return NextResponse.json({
        ok: true,
        message: `Plugin "${skillName}" installed successfully. The gateway may need a restart.`,
        output: installResult.output,
      })
    }

    return NextResponse.json({
      error: installResult.error || 'Install failed',
      hint: 'The plugin could not be installed automatically. Try running: openclaw plugins install ' + skillName,
    }, { status: 500 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Install failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

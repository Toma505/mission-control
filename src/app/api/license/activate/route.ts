import { NextRequest, NextResponse } from 'next/server'

import {
  getLicenseAuthorityUrl,
  getLocalMachineContext,
  isDesktopLicenseRuntime,
  writeLocalLicenseState,
} from '@/lib/local-license'
import { sanitizeError } from '@/lib/sanitize-error'

export async function POST(request: NextRequest) {
  if (!isDesktopLicenseRuntime()) {
    return NextResponse.json(
      { error: 'Desktop activation is only available inside the Mission Control app.' },
      { status: 400 },
    )
  }

  try {
    const body = await request.json() as {
      key?: string
      email?: string
    }

    const key = body.key?.trim() || ''
    const email = body.email?.trim() || ''
    if (!key || !email) {
      return NextResponse.json({ error: 'License key and email are required.' }, { status: 400 })
    }

    const machine = getLocalMachineContext()
    const response = await fetch(`${getLicenseAuthorityUrl()}/api/license-control/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        email,
        machineId: machine.machineId,
        machineName: machine.machineName,
        platform: machine.platform,
        arch: machine.arch,
        appVersion: machine.appVersion,
      }),
      cache: 'no-store',
    })

    const data = await response.json().catch(() => ({})) as {
      error?: string
      code?: string
      activationId?: string
      leaseValidUntil?: string
    }

    if (!response.ok || !data.leaseValidUntil) {
      return NextResponse.json(
        {
          ok: false,
          error: data.error || 'Activation failed.',
          code: data.code || 'activation_failed',
        },
        { status: response.status >= 400 ? response.status : 400 },
      )
    }

    const now = new Date().toISOString()
    await writeLocalLicenseState({
      key: key.toUpperCase(),
      email,
      machineId: machine.machineId,
      machineName: machine.machineName,
      platform: machine.platform,
      arch: machine.arch,
      appVersion: machine.appVersion,
      activationId: data.activationId || null,
      activatedAt: now,
      lastValidatedAt: now,
      leaseValidUntil: data.leaseValidUntil,
    })

    return NextResponse.json({ ok: true, leaseValidUntil: data.leaseValidUntil })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: sanitizeError(error, 'Failed to activate license') },
      { status: 500 },
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'

import { activateLicenseRegistration } from '@/lib/billing'
import { maybeRateLimit } from '@/lib/request-rate-limit'
import { sanitizeError } from '@/lib/sanitize-error'

export async function POST(request: NextRequest) {
  const limited = maybeRateLimit(request, {
    bucket: 'license-activate',
    max: 15,
    windowMs: 10 * 60 * 1000,
    message: 'Too many activation attempts. Please wait a few minutes and try again.',
  })
  if (limited) return limited

  try {
    const body = await request.json() as {
      key?: string
      email?: string
      machineId?: string
      machineName?: string
      platform?: string
      arch?: string
      appVersion?: string
    }

    const key = body.key?.trim() || ''
    const email = body.email?.trim() || ''
    const machineId = body.machineId?.trim() || ''

    if (!key || !email || !machineId) {
      return NextResponse.json({ error: 'License key, email, and machine id are required.' }, { status: 400 })
    }

    const result = await activateLicenseRegistration({
      licenseKey: key,
      email,
      machineId,
      machineName: body.machineName?.trim() || null,
      platform: body.platform?.trim() || null,
      arch: body.arch?.trim() || null,
      appVersion: body.appVersion?.trim() || null,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.code === 'machine_limit' ? 409 : 400 },
      )
    }

    return NextResponse.json({
      ok: true,
      activationId: result.activation.id,
      licenseKey: result.order.licenseKey,
      leaseValidUntil: result.leaseValidUntil,
      planId: result.order.planId,
      planName: result.order.planName,
      machineLimit: result.order.machineLimit,
      updateExpiresAt: result.order.updateExpiresAt,
    })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to activate license') },
      { status: 500 },
    )
  }
}

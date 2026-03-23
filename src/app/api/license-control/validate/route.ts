import { NextRequest, NextResponse } from 'next/server'

import { renewLicenseLease } from '@/lib/billing'
import { sanitizeError } from '@/lib/sanitize-error'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      key?: string
      machineId?: string
    }

    const key = body.key?.trim() || ''
    const machineId = body.machineId?.trim() || ''

    if (!key || !machineId) {
      return NextResponse.json({ error: 'License key and machine id are required.' }, { status: 400 })
    }

    const result = await renewLicenseLease({
      licenseKey: key,
      machineId,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.code === 'not_registered' ? 409 : 400 },
      )
    }

    return NextResponse.json({
      ok: true,
      activationId: result.activation.id,
      leaseValidUntil: result.leaseValidUntil,
      planId: result.order.planId,
      planName: result.order.planName,
      machineLimit: result.order.machineLimit,
      updateExpiresAt: result.order.updateExpiresAt,
    })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to validate license') },
      { status: 500 },
    )
  }
}

/**
 * Desktop license status endpoint.
 *
 * The packaged app keeps a local leased activation record in license.json.
 * While the lease is valid we trust it locally. Once it expires we renew it
 * against the public license authority on app.orqpilot.com.
 */

import { NextRequest, NextResponse } from 'next/server'

import {
  clearLocalLicenseState,
  getLicenseAuthorityUrl,
  getLocalMachineContext,
  isLeaseValid,
  readLocalLicenseState,
  shouldRefreshLease,
  writeLocalLicenseState,
} from '@/lib/local-license'
import { sanitizeError } from '@/lib/sanitize-error'

const LICENSE_INVALIDATION_CODES = new Set([
  'not_found',
  'email_mismatch',
  'not_fulfilled',
  'refunded',
  'revoked',
  'machine_limit',
  'not_registered',
])

async function bootstrapLegacyLicenseLease(localLicense: Awaited<ReturnType<typeof readLocalLicenseState>>) {
  if (!localLicense?.email) return null

  const machine = getLocalMachineContext()
  const response = await fetch(`${getLicenseAuthorityUrl()}/api/license-control/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key: localLicense.key,
      email: localLicense.email,
      machineId: machine.machineId,
      machineName: machine.machineName,
      platform: machine.platform,
      arch: machine.arch,
      appVersion: machine.appVersion,
    }),
    cache: 'no-store',
  })

  const data = await response.json().catch(() => ({})) as {
    activationId?: string
    leaseValidUntil?: string
    code?: string
    error?: string
  }

  if (!response.ok || !data.leaseValidUntil) {
    return { ok: false as const, response, data }
  }

  const now = new Date().toISOString()
  await writeLocalLicenseState({
    ...localLicense,
    machineId: machine.machineId,
    machineName: machine.machineName,
    platform: machine.platform,
    arch: machine.arch,
    appVersion: machine.appVersion,
    activationId: data.activationId || localLicense.activationId,
    activatedAt: localLicense.activatedAt || now,
    lastValidatedAt: now,
    leaseValidUntil: data.leaseValidUntil,
  })

  return {
    ok: true as const,
    leaseValidUntil: data.leaseValidUntil,
    email: localLicense.email,
  }
}

export async function GET(request: NextRequest) {
  try {
    const localLicense = await readLocalLicenseState()
    if (!localLicense) {
      return NextResponse.json({ licensed: false })
    }

    const leaseStillValid = isLeaseValid(localLicense)
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'
    const refreshDue = shouldRefreshLease(localLicense)

    if (!localLicense.activationId) {
      const bootstrapped = await bootstrapLegacyLicenseLease(localLicense)
      if (bootstrapped?.ok) {
        return NextResponse.json({
          licensed: true,
          email: bootstrapped.email,
          leaseValidUntil: bootstrapped.leaseValidUntil,
          migrated: true,
        })
      }
    }

    if (leaseStillValid && !forceRefresh && !refreshDue) {
      return NextResponse.json({
        licensed: true,
        email: localLicense.email,
        leaseValidUntil: localLicense.leaseValidUntil,
      })
    }

    const machine = getLocalMachineContext()
    const response = await fetch(`${getLicenseAuthorityUrl()}/api/license-control/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: localLicense.key,
        machineId: machine.machineId,
      }),
      cache: 'no-store',
    })

    const data = await response.json().catch(() => ({})) as {
      activationId?: string
      leaseValidUntil?: string
      code?: string
    }

    if (!data.leaseValidUntil) {
      if (data.code === 'not_registered') {
        const bootstrapped = await bootstrapLegacyLicenseLease(localLicense)
        if (bootstrapped?.ok) {
          return NextResponse.json({
            licensed: true,
            email: bootstrapped.email,
            leaseValidUntil: bootstrapped.leaseValidUntil,
            migrated: true,
          })
        }
      }

      if (!response.ok && data.code && LICENSE_INVALIDATION_CODES.has(data.code)) {
        await clearLocalLicenseState()
      }

      if (leaseStillValid && (!data.code || !LICENSE_INVALIDATION_CODES.has(data.code))) {
        return NextResponse.json({
          licensed: true,
          email: localLicense.email,
          leaseValidUntil: localLicense.leaseValidUntil,
          validationDeferred: true,
        })
      }

      return NextResponse.json(
        { licensed: false, code: data.code || 'validation_failed' },
        { status: response.status >= 400 ? response.status : 400 },
      )
    }

    await writeLocalLicenseState({
      ...localLicense,
      machineId: machine.machineId,
      machineName: machine.machineName,
      platform: machine.platform,
      arch: machine.arch,
      appVersion: machine.appVersion,
      activationId: data.activationId || localLicense.activationId,
      lastValidatedAt: new Date().toISOString(),
      leaseValidUntil: data.leaseValidUntil,
    })

    return NextResponse.json({
      licensed: true,
      email: localLicense.email,
      leaseValidUntil: data.leaseValidUntil,
    })
  } catch (error) {
    const localLicense = await readLocalLicenseState()
    if (localLicense && isLeaseValid(localLicense)) {
      return NextResponse.json({
        licensed: true,
        email: localLicense.email,
        leaseValidUntil: localLicense.leaseValidUntil,
        validationDeferred: true,
      })
    }

    return NextResponse.json(
      { licensed: false, error: sanitizeError(error, 'Failed to validate local license') },
      { status: 500 },
    )
  }
}

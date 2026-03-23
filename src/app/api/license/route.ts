/**
 * Desktop license status endpoint.
 *
 * The packaged app keeps a local leased activation record in license.json.
 * While the lease is valid we trust it locally. Once it expires we renew it
 * against the public license authority on app.orqpilot.com.
 */

import { NextResponse } from 'next/server'

import {
  getLicenseAuthorityUrl,
  getLocalMachineContext,
  isLeaseValid,
  readLocalLicenseState,
  writeLocalLicenseState,
} from '@/lib/local-license'
import { sanitizeError } from '@/lib/sanitize-error'

export async function GET() {
  try {
    const localLicense = await readLocalLicenseState()
    if (!localLicense) {
      return NextResponse.json({ licensed: false })
    }

    if (isLeaseValid(localLicense)) {
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

    if (!response.ok) {
      return NextResponse.json({ licensed: false })
    }

    const data = await response.json() as {
      activationId?: string
      leaseValidUntil?: string
    }

    if (!data.leaseValidUntil) {
      return NextResponse.json({ licensed: false })
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
    return NextResponse.json(
      { licensed: false, error: sanitizeError(error, 'Failed to validate local license') },
      { status: 500 },
    )
  }
}

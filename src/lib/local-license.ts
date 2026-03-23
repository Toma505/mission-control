import { createHash } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import os from 'os'
import { join } from 'path'

import { DATA_DIR } from '@/lib/connection-config'

export interface LocalLicenseState {
  key: string
  email: string
  machineId: string
  machineName: string
  platform: string
  arch: string
  appVersion: string | null
  activationId: string | null
  activatedAt: string
  lastValidatedAt: string
  leaseValidUntil: string
}

const USER_DATA_DIR = process.env.MC_USER_DATA_DIR || process.env.MC_DATA_DIR || DATA_DIR
const LICENSE_FILE = join(USER_DATA_DIR, 'license.json')

export function getLicenseAuthorityUrl() {
  return (
    process.env.MC_LICENSE_AUTHORITY_URL ||
    process.env.MISSION_CONTROL_LICENSE_SERVER_URL ||
    'https://app.orqpilot.com'
  ).replace(/\/$/, '')
}

export function isDesktopLicenseRuntime() {
  return !!process.env.MC_SESSION_TOKEN || !!process.env.MC_USER_DATA_DIR
}

export function getLocalMachineContext() {
  const machineName = os.hostname()
  const platform = os.platform()
  const arch = os.arch()
  const username = os.userInfo().username
  const raw = `${machineName}:${username}:${platform}:${arch}`

  return {
    machineId: createHash('sha256').update(raw).digest('hex').slice(0, 16),
    machineName,
    platform,
    arch,
    appVersion: process.env.MC_DESKTOP_APP_VERSION || null,
  }
}

export function isLeaseValid(state: Pick<LocalLicenseState, 'leaseValidUntil'>, now = new Date()) {
  return new Date(state.leaseValidUntil).getTime() > now.getTime()
}

export async function readLocalLicenseState(): Promise<LocalLicenseState | null> {
  try {
    const raw = await readFile(LICENSE_FILE, 'utf-8')
    const clean = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
    const data = JSON.parse(clean) as Partial<LocalLicenseState>

    if (
      typeof data.key !== 'string' ||
      typeof data.email !== 'string' ||
      typeof data.machineId !== 'string'
    ) {
      return null
    }

    return {
      key: data.key,
      email: data.email,
      machineId: data.machineId,
      machineName: data.machineName || getLocalMachineContext().machineName,
      platform: data.platform || getLocalMachineContext().platform,
      arch: data.arch || getLocalMachineContext().arch,
      appVersion: data.appVersion || null,
      activationId: data.activationId || null,
      activatedAt: data.activatedAt || new Date(0).toISOString(),
      lastValidatedAt: data.lastValidatedAt || new Date(0).toISOString(),
      leaseValidUntil: data.leaseValidUntil || new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export async function writeLocalLicenseState(state: LocalLicenseState) {
  await mkdir(USER_DATA_DIR, { recursive: true })
  await writeFile(LICENSE_FILE, JSON.stringify(state, null, 2))
}

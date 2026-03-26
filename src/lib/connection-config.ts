/**
 * Connection config persistence layer.
 * Reads/writes data/connection.json, falls back to process.env.
 * Sensitive credentials are encrypted at rest when Electron provides
 * MC_CONFIG_ENCRYPTION_KEY through the embedded server environment.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import {
  getEncryptionKeyBuffer,
  isSecretEncryptionAvailable,
  UNENCRYPTED_STORAGE_WARNING,
} from '@/lib/secret-encryption'

export interface ConnectionConfig {
  openclawUrl: string
  setupPassword: string
  openrouterApiKey: string
  openrouterMgmtKey?: string
  configuredAt: string
}

interface EncryptedSecretsPayload {
  iv: string
  tag: string
  data: string
}

interface PersistedConnectionConfig {
  version?: number
  openclawUrl?: string
  configuredAt?: string
  encryptedSecrets?: EncryptedSecretsPayload
  setupPassword?: string
  openrouterApiKey?: string
  openrouterMgmtKey?: string
  _warning?: string
}

interface ConnectionSecrets {
  setupPassword: string
  openrouterApiKey: string
  openrouterMgmtKey: string
}

/** Shared data directory — uses MC_DATA_DIR in packaged Electron, falls back to ./data */
export const DATA_DIR = process.env.MC_DATA_DIR || join(process.cwd(), 'data')
const CONFIG_PATH = join(DATA_DIR, 'connection.json')
const CONFIG_VERSION = 2

function stripBom(raw: string): string {
  return raw.replace(/^\uFEFF/, '')
}

function encryptSecrets(secrets: ConnectionSecrets): EncryptedSecretsPayload | null {
  const key = getEncryptionKeyBuffer()
  if (!key) return null

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([
    cipher.update(JSON.stringify(secrets), 'utf-8'),
    cipher.final(),
  ])

  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  }
}

function decryptSecrets(payload: EncryptedSecretsPayload): ConnectionSecrets | null {
  const key = getEncryptionKeyBuffer()
  if (!key) return null

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.data, 'base64')),
      decipher.final(),
    ])

    return JSON.parse(stripBom(decrypted.toString('utf-8'))) as ConnectionSecrets
  } catch {
    return null
  }
}

function buildConnectionConfig(
  config: PersistedConnectionConfig,
  secrets: Partial<ConnectionSecrets>,
): ConnectionConfig | null {
  if (!config.openclawUrl || !secrets.setupPassword) {
    return null
  }

  return {
    openclawUrl: config.openclawUrl,
    setupPassword: secrets.setupPassword,
    openrouterApiKey: secrets.openrouterApiKey || '',
    openrouterMgmtKey: secrets.openrouterMgmtKey || '',
    configuredAt: config.configuredAt || new Date(0).toISOString(),
  }
}

async function maybeMigrateLegacyConfig(config: ConnectionConfig, stored: PersistedConnectionConfig) {
  if (!getEncryptionKeyBuffer()) return
  if (stored.encryptedSecrets) return
  if (!stored.setupPassword && !stored.openrouterApiKey && !stored.openrouterMgmtKey) return

  try {
    await writeConnectionConfig(config)
  } catch {
    // Best-effort migration only.
  }
}

export async function readConnectionConfig(): Promise<ConnectionConfig | null> {
  try {
    const raw = stripBom(await readFile(CONFIG_PATH, 'utf-8'))
    const stored = JSON.parse(raw) as PersistedConnectionConfig

    if (stored.encryptedSecrets) {
      const secrets = decryptSecrets(stored.encryptedSecrets)
      if (!secrets) return null

      return buildConnectionConfig(stored, secrets)
    }

    const legacyConfig = buildConnectionConfig(stored, {
      setupPassword: stored.setupPassword,
      openrouterApiKey: stored.openrouterApiKey,
      openrouterMgmtKey: stored.openrouterMgmtKey,
    })

    if (legacyConfig) {
      await maybeMigrateLegacyConfig(legacyConfig, stored)
    }

    return legacyConfig
  } catch {
    return null
  }
}

export async function writeConnectionConfig(config: ConnectionConfig): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })

  const encryptedSecrets = encryptSecrets({
    setupPassword: config.setupPassword,
    openrouterApiKey: config.openrouterApiKey || '',
    openrouterMgmtKey: config.openrouterMgmtKey || '',
  })

  const payload: PersistedConnectionConfig = {
    version: CONFIG_VERSION,
    openclawUrl: config.openclawUrl,
    configuredAt: config.configuredAt,
  }

  if (encryptedSecrets) {
    payload.encryptedSecrets = encryptedSecrets
  } else {
    payload._warning = UNENCRYPTED_STORAGE_WARNING
    payload.setupPassword = config.setupPassword
    payload.openrouterApiKey = config.openrouterApiKey || ''
    payload.openrouterMgmtKey = config.openrouterMgmtKey || ''
  }

  await writeFile(CONFIG_PATH, JSON.stringify(payload, null, 2))
}

/**
 * Returns effective config: file-based config takes priority, falls back to env vars.
 * This means existing .env.local setups keep working without migration.
 */
export async function getEffectiveConfig(): Promise<{
  openclawUrl: string
  setupPassword: string
  openrouterApiKey: string
  openrouterMgmtKey: string
}> {
  const fileConfig = await readConnectionConfig()

  return {
    openclawUrl: fileConfig?.openclawUrl || process.env.OPENCLAW_API_URL || '',
    setupPassword: fileConfig?.setupPassword || process.env.OPENCLAW_SETUP_PASSWORD || '',
    openrouterApiKey: fileConfig?.openrouterApiKey || process.env.OPENROUTER_API_KEY || '',
    openrouterMgmtKey: fileConfig?.openrouterMgmtKey || process.env.OPENROUTER_MGMT_KEY || '',
  }
}

export async function isAppConfigured(): Promise<boolean> {
  const config = await getEffectiveConfig()
  return !!config.openclawUrl && !!config.setupPassword
}

export function isConnectionConfigEncryptionAvailable(): boolean {
  return isSecretEncryptionAvailable()
}

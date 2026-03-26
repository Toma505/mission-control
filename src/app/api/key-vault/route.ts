import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'
import { isAuthorized, isTrustedLocalhostRequest, localOnlyResponse, unauthorizedResponse } from '@/lib/api-auth'
import {
  decryptSecretValue,
  encryptSecretValue,
  isEncryptedSecretValue,
  isSecretEncryptionAvailable,
} from '@/lib/secret-encryption'

const VAULT_FILE = path.join(DATA_DIR, 'key-vault.json')
let warnedAboutPlaintextVaultStorage = false

export interface VaultKey {
  id: string
  name: string
  provider: string
  keyPrefix: string
  keyHash: string
  addedAt: string
  lastUsed?: string
  isActive: boolean
  notes?: string
  _key: string
  legacyMaskedValue?: string
}

function hashKey(key: string): string {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16)
}

function detectProvider(key: string): string {
  if (key.startsWith('sk-or-')) return 'OpenRouter'
  if (key.startsWith('sk-ant-')) return 'Anthropic'
  if (key.startsWith('sk-')) return 'OpenAI'
  if (key.startsWith('gsk_')) return 'Groq'
  if (key.startsWith('AI')) return 'Google AI'
  return 'Other'
}

function normalizeProvider(provider: string | undefined) {
  if (!provider) return 'Other'
  if (provider === 'Google') return 'Google AI'
  return provider
}

function deriveKeyPrefix(entry: any) {
  if (typeof entry.keyPrefix === 'string' && entry.keyPrefix) return entry.keyPrefix
  if (typeof entry._key === 'string' && entry._key) return entry._key.slice(0, 8)
  if (typeof entry.maskedValue === 'string' && entry.maskedValue) {
    return entry.maskedValue.split('****')[0].replace(/\.+$/, '')
  }
  if (typeof entry.masked === 'string' && entry.masked) {
    return entry.masked.split('...')[0]
  }
  return ''
}

function normalizeVaultEntry(entry: any, index: number): VaultKey {
  const provider = normalizeProvider(entry.provider)
  const keyPrefix = deriveKeyPrefix(entry)
  const _key = typeof entry._key === 'string' ? entry._key : ''
  const legacyMaskedValue =
    typeof entry.maskedValue === 'string' && entry.maskedValue
      ? entry.maskedValue
      : typeof entry.masked === 'string' && entry.masked
        ? entry.masked
        : undefined

  return {
    id: entry.id || `key_${index}`,
    name: entry.name || `${provider} Key`,
    provider,
    keyPrefix,
    keyHash: entry.keyHash || hashKey(`${provider}:${entry.name || ''}:${legacyMaskedValue || keyPrefix}:${index}`),
    addedAt: entry.addedAt || new Date(0).toISOString(),
    lastUsed: entry.lastUsed,
    isActive: typeof entry.isActive === 'boolean' ? entry.isActive : entry.status !== 'disabled',
    notes: entry.notes,
    _key,
    legacyMaskedValue,
  }
}

async function readVault(): Promise<VaultKey[]> {
  try {
    const text = await readFile(VAULT_FILE, 'utf-8')
    const data = JSON.parse(text)
    if (!Array.isArray(data)) return []

    let needsMigration = false

    const keys = data.map((entry: any, index: number) => {
      const storedKey = typeof entry._key === 'string' ? entry._key : ''
      const decryptedKey = isEncryptedSecretValue(storedKey)
        ? decryptSecretValue(storedKey)
        : storedKey

      if (storedKey && !isEncryptedSecretValue(storedKey) && isSecretEncryptionAvailable()) {
        needsMigration = true
      }

      return normalizeVaultEntry({ ...entry, _key: decryptedKey }, index)
    })

    if (needsMigration) {
      await writeVault(keys)
    }

    return keys
  } catch {
    return []
  }
}

async function writeVault(keys: VaultKey[]) {
  await mkdir(path.dirname(VAULT_FILE), { recursive: true })
  const encryptionAvailable = isSecretEncryptionAvailable()

  if (!encryptionAvailable && !warnedAboutPlaintextVaultStorage) {
    warnedAboutPlaintextVaultStorage = true
    console.warn('[mc] Key vault encryption unavailable; API keys will be stored in plaintext.')
  }

  await writeFile(
    VAULT_FILE,
    JSON.stringify(
      keys.map(({ legacyMaskedValue, _key, ...rest }) => ({
        ...rest,
        _key: encryptionAvailable ? encryptSecretValue(_key) : _key,
      })),
      null,
      2,
    ),
  )
}

function buildMaskedValue(key: VaultKey) {
  if (key.legacyMaskedValue) return key.legacyMaskedValue
  if (key.keyPrefix) return `${key.keyPrefix}...${key._key ? key._key.slice(-4) : '****'}`
  return 'Hidden'
}

export async function GET(request: NextRequest) {
  if (!isTrustedLocalhostRequest(request)) return localOnlyResponse()
  if (!isAuthorized(request)) return unauthorizedResponse()

  const keys = await readVault()
  const masked = keys.map(({ _key, ...rest }) => ({
    ...rest,
    masked: buildMaskedValue({ ...rest, _key }),
  }))
  return NextResponse.json({ keys: masked })
}

export async function POST(request: NextRequest) {
  if (!isTrustedLocalhostRequest(request)) return localOnlyResponse()
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const { name, key, notes } = await request.json()

    if (!key) {
      return NextResponse.json({ error: 'API key required' }, { status: 400 })
    }

    const keys = await readVault()
    const hash = hashKey(key)

    if (keys.some((existing) => existing.keyHash === hash)) {
      return NextResponse.json({ error: 'This key already exists in the vault' }, { status: 409 })
    }

    const provider = detectProvider(key)
    const vaultKey: VaultKey = {
      id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name || `${provider} Key`,
      provider,
      keyPrefix: key.slice(0, 8),
      keyHash: hash,
      addedAt: new Date().toISOString(),
      isActive: true,
      notes,
      _key: key,
    }

    keys.push(vaultKey)
    await writeVault(keys)

    return NextResponse.json({
      ok: true,
      key: { id: vaultKey.id, name: vaultKey.name, provider, keyPrefix: vaultKey.keyPrefix },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to add key' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  if (!isTrustedLocalhostRequest(request)) return localOnlyResponse()
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json()
    const keys = await readVault()
    const key = keys.find((entry) => entry.id === body.id)
    if (!key) return NextResponse.json({ error: 'Key not found' }, { status: 404 })

    if (body.action === 'toggle') {
      key.isActive = !key.isActive
    } else if (body.action === 'rotate') {
      if (!body.newKey) return NextResponse.json({ error: 'newKey required' }, { status: 400 })
      key._key = body.newKey
      key.keyPrefix = body.newKey.slice(0, 8)
      key.keyHash = hashKey(body.newKey)
      key.provider = detectProvider(body.newKey)
      key.legacyMaskedValue = undefined
    } else {
      if (body.name) key.name = body.name
      if (body.notes !== undefined) key.notes = body.notes
    }

    await writeVault(keys)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!isTrustedLocalhostRequest(request)) return localOnlyResponse()
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const { id } = await request.json()
    const keys = await readVault()
    const filtered = keys.filter((entry) => entry.id !== id)
    if (filtered.length === keys.length) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }
    await writeVault(filtered)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

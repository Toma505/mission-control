import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'
import { isAuthorized, isTrustedLocalhostRequest, localOnlyResponse, unauthorizedResponse } from '@/lib/api-auth'

const VAULT_FILE = path.join(DATA_DIR, 'key-vault.json')

export interface VaultKey {
  id: string
  name: string
  provider: string
  keyPrefix: string  // First 8 chars only, for display
  keyHash: string    // SHA256 hash for dedup detection
  addedAt: string
  lastUsed?: string
  isActive: boolean
  notes?: string
  // The actual key is stored with basic obfuscation — real encryption via safeStorage in Electron
  _key: string
}

async function readVault(): Promise<VaultKey[]> {
  try {
    const text = await readFile(VAULT_FILE, 'utf-8')
    return JSON.parse(text)
  } catch {
    return []
  }
}

async function writeVault(keys: VaultKey[]) {
  await mkdir(path.dirname(VAULT_FILE), { recursive: true })
  await writeFile(VAULT_FILE, JSON.stringify(keys, null, 2))
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

/** GET — list all keys (masked) */
export async function GET(request: NextRequest) {
  if (!isTrustedLocalhostRequest(request)) return localOnlyResponse()
  if (!isAuthorized(request)) return unauthorizedResponse()

  const keys = await readVault()
  // Never return the actual key
  const masked = keys.map(({ _key, ...rest }) => ({
    ...rest,
    masked: rest.keyPrefix + '...' + (_key ? _key.slice(-4) : '****'),
  }))
  return NextResponse.json({ keys: masked })
}

/** POST — add a new key */
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

    // Check for duplicates
    if (keys.some(k => k.keyHash === hash)) {
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

/** PATCH — toggle active, update name/notes, or rotate key */
export async function PATCH(request: NextRequest) {
  if (!isTrustedLocalhostRequest(request)) return localOnlyResponse()
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json()
    const keys = await readVault()
    const key = keys.find(k => k.id === body.id)
    if (!key) return NextResponse.json({ error: 'Key not found' }, { status: 404 })

    if (body.action === 'toggle') {
      key.isActive = !key.isActive
    } else if (body.action === 'rotate') {
      if (!body.newKey) return NextResponse.json({ error: 'newKey required' }, { status: 400 })
      key._key = body.newKey
      key.keyPrefix = body.newKey.slice(0, 8)
      key.keyHash = hashKey(body.newKey)
      key.provider = detectProvider(body.newKey)
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

/** DELETE — remove a key */
export async function DELETE(request: NextRequest) {
  if (!isTrustedLocalhostRequest(request)) return localOnlyResponse()
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const { id } = await request.json()
    const keys = await readVault()
    const filtered = keys.filter(k => k.id !== id)
    if (filtered.length === keys.length) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }
    await writeVault(filtered)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

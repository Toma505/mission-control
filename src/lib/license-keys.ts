import { createHmac, randomBytes } from 'crypto'

const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function toBase32(buffer: Buffer, length: number) {
  let result = ''
  for (let i = 0; i < length; i += 1) {
    result += BASE32[buffer[i] % BASE32.length]
  }
  return result
}

export function normalizeLicenseKey(key: string) {
  return key.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function formatLicenseKey(rawPayload: string) {
  return `MC-${rawPayload.slice(0, 5)}-${rawPayload.slice(5, 10)}-${rawPayload.slice(10, 15)}-${rawPayload.slice(15, 20)}`
}

export function generateLicenseKey(secret: string) {
  const idBytes = randomBytes(8)
  const id = toBase32(idBytes, 8)
  const hmac = createHmac('sha256', secret).update(id).digest()
  const sig = toBase32(hmac, 12)
  return formatLicenseKey(`${id}${sig}`)
}

export function validateLicenseKey(key: string, secret: string) {
  const clean = normalizeLicenseKey(key)
  if (!clean.startsWith('MC') || clean.length !== 22) return false

  const payload = clean.slice(2)
  const id = payload.slice(0, 8)
  const sig = payload.slice(8, 20)
  const hmac = createHmac('sha256', secret).update(id).digest()
  const expectedSig = toBase32(hmac, 12)

  return sig === expectedSig
}

export function getLicenseSecret() {
  const secret = (process.env.MC_LICENSE_SECRET || '').trim()
  if (!secret) {
    throw new Error('MC_LICENSE_SECRET is missing.')
  }
  if (secret === 'mc-prod-secret-change-me-before-shipping') {
    throw new Error('MC_LICENSE_SECRET is still using the placeholder value.')
  }
  if (secret.length < 32) {
    throw new Error('MC_LICENSE_SECRET must be at least 32 characters long.')
  }
  return secret
}

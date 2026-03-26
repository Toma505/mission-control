import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const CONFIG_ENCRYPTION_KEY = process.env.MC_CONFIG_ENCRYPTION_KEY || ''

export const UNENCRYPTED_STORAGE_WARNING = 'UNENCRYPTED — encryption key unavailable'

export function getEncryptionKeyBuffer(): Buffer | null {
  if (!CONFIG_ENCRYPTION_KEY) return null
  return createHash('sha256').update(CONFIG_ENCRYPTION_KEY).digest()
}

export function isSecretEncryptionAvailable(): boolean {
  return !!getEncryptionKeyBuffer()
}

export function isEncryptedSecretValue(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.startsWith('enc:')
}

export function encryptSecretValue(value: string): string {
  if (!value) return ''

  const key = getEncryptionKeyBuffer()
  if (!key) return value

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(value, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `enc:${iv.toString('base64')}:${tag.toString('base64')}:${data.toString('base64')}`
}

export function decryptSecretValue(value: string): string {
  if (!value) return ''
  if (!isEncryptedSecretValue(value)) return value

  const key = getEncryptionKeyBuffer()
  if (!key) return ''

  const [, iv, tag, data] = value.split(':')

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final(),
    ]).toString('utf-8')
  } catch {
    return ''
  }
}

import { createHmac, timingSafeEqual } from 'crypto'

export interface StripeWebhookEnvelope {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}

export function verifyStripeWebhookSignature(payload: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader) return false

  const parts = signatureHeader.split(',').map((part) => part.trim())
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2)
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3))

  if (!timestamp || signatures.length === 0) return false

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false

  const signedPayload = `${timestamp}.${payload}`
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex')
  const expectedBuffer = Buffer.from(expected)

  return signatures.some((signature) => {
    try {
      const signatureBuffer = Buffer.from(signature)
      return signatureBuffer.length === expectedBuffer.length &&
        timingSafeEqual(signatureBuffer, expectedBuffer)
    } catch {
      return false
    }
  })
}

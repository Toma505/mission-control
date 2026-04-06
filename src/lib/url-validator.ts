/**
 * URL validation for SSRF protection.
 *
 * Rejects URLs that point to private/internal networks, cloud metadata
 * endpoints, or non-HTTP schemes. Used when accepting user-supplied
 * OpenClaw URLs during setup.
 */

/** Returns null if valid, or an error string if rejected. */
export function validateExternalUrl(input: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return 'Invalid URL format'
  }

  // Only allow HTTP(S)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Only http:// and https:// URLs are allowed'
  }

  const hostname = parsed.hostname.toLowerCase()

  // Block cloud metadata endpoints
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
    return 'Cloud metadata endpoints are not allowed'
  }

  // Block well-known internal hostnames
  if (hostname === '0.0.0.0' || hostname === '[::]') {
    return 'Invalid hostname'
  }

  // For a desktop app, localhost and private IPs are legitimate
  // (the user's OpenClaw instance may be on their LAN or localhost).
  // We only block cloud metadata and non-HTTP schemes.

  return null
}

function normalizeHostname(hostname: string) {
  return hostname.replace(/^\[|\]$/g, '').toLowerCase()
}

function parseIPv4(hostname: string): number[] | null {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null

  const octets = hostname.split('.').map((part) => Number.parseInt(part, 10))
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) return null
  return octets
}

function isBlockedInstanceIpv4(hostname: string): boolean {
  const octets = parseIPv4(hostname)
  if (!octets) return false

  const [a, b, c, d] = octets

  if (a === 169 && b === 254) return true
  if (a === 0 && b === 0 && c === 0 && d === 0) return true

  return false
}

function isBlockedInstanceIpv6(hostname: string): boolean {
  const normalized = normalizeHostname(hostname)
  if (!normalized.includes(':')) return false
  if (normalized === '::1') return false

  const compact = normalized.replace(/:/g, '')

  return (
    compact.startsWith('fe8') ||
    compact.startsWith('fe9') ||
    compact.startsWith('fea') ||
    compact.startsWith('feb') ||
    compact.startsWith('fc') ||
    compact.startsWith('fd')
  )
}

/** Returns null if valid, or an error string if rejected. */
export function validateManagedInstanceUrl(input: string): string | null {
  if (input.includes('@')) {
    return 'Instance URLs cannot contain credentials'
  }

  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return 'Invalid URL format'
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Only http:// and https:// URLs are allowed'
  }

  if (parsed.username || parsed.password) {
    return 'Instance URLs cannot contain credentials'
  }

  const hostname = normalizeHostname(parsed.hostname)

  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
    return 'Cloud metadata endpoints are not allowed'
  }

  if (hostname === '0.0.0.0' || hostname === '::') {
    return 'Invalid hostname'
  }

  if (isBlockedInstanceIpv4(hostname)) {
    return 'Link-local and metadata IP ranges are not allowed'
  }

  if (isBlockedInstanceIpv6(hostname)) {
    return 'Unique-local and link-local IPv6 ranges are not allowed'
  }

  return null
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = parseIPv4(hostname)
  if (!octets) return false

  const [a, b] = octets

  if (a === 10) return true
  if (a === 127) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 169 && b === 254) return true
  if (a === 0) return true

  return false
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = normalizeHostname(hostname)
  if (!normalized.includes(':')) return false

  const compact = normalized.replace(/:/g, '')

  return (
    normalized === '::1' ||
    compact.startsWith('fe8') ||
    compact.startsWith('fe9') ||
    compact.startsWith('fea') ||
    compact.startsWith('feb') ||
    compact.startsWith('fc') ||
    compact.startsWith('fd')
  )
}

/** Returns null if valid, or an error string if rejected. */
export function validateWebhookDestinationUrl(input: string): string | null {
  if (input.includes('@')) {
    return 'Webhook URLs cannot contain credentials'
  }

  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return 'Invalid URL format'
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Only http:// and https:// webhook URLs are allowed'
  }

  if (parsed.username || parsed.password) {
    return 'Webhook URLs cannot contain credentials'
  }

  const hostname = normalizeHostname(parsed.hostname)

  if (hostname === 'localhost' || hostname === '::1') {
    return 'Localhost webhook destinations are not allowed'
  }

  if (
    hostname === '169.254.169.254' ||
    hostname === 'metadata.google.internal' ||
    hostname === '100.100.100.200'
  ) {
    return 'Cloud metadata endpoints are not allowed'
  }

  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    return 'Private, loopback, and link-local webhook destinations are not allowed'
  }

  return null
}

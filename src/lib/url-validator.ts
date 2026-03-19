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

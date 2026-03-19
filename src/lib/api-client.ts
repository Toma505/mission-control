/**
 * Client-side API helper with session token authentication.
 *
 * On first call, fetches the session token from /api/auth/token.
 * All subsequent mutating requests include the token in the x-mc-token header.
 */

let cachedToken: string | null = null
let tokenPromise: Promise<string> | null = null

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken

  // Deduplicate concurrent requests for the token
  if (!tokenPromise) {
    tokenPromise = fetch('/api/auth/token')
      .then((r) => r.json())
      .then((d) => {
        cachedToken = d.token
        tokenPromise = null
        return d.token as string
      })
      .catch(() => {
        tokenPromise = null
        return ''
      })
  }

  return tokenPromise
}

/**
 * Authenticated fetch for mutating API calls (POST/PUT/DELETE).
 * Automatically injects the session token header.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken()

  const headers = new Headers(options.headers)
  if (token) {
    headers.set('x-mc-token', token)
  }

  return fetch(url, { ...options, headers })
}

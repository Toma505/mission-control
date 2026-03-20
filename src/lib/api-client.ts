/**
 * Client-side API helper with session token authentication.
 *
 * On first call, fetches the session token from /api/auth/token.
 * All subsequent mutating requests include the token in the x-mc-token header.
 */

let cachedToken: string | null = null
let tokenPromise: Promise<string> | null = null

async function getTokenFromElectron(): Promise<string> {
  if (typeof window === 'undefined') return ''

  const electronApi = (window as typeof window & {
    electronAPI?: {
      getSessionToken?: () => Promise<string>
    }
  }).electronAPI

  if (!electronApi?.getSessionToken) return ''

  try {
    return await electronApi.getSessionToken()
  } catch {
    return ''
  }
}

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken

  // Deduplicate concurrent requests for the token
  if (!tokenPromise) {
    tokenPromise = (async () => {
      const electronToken = await getTokenFromElectron()
      if (electronToken) {
        cachedToken = electronToken
        return electronToken
      }

      const response = await fetch('/api/auth/token')
      const data = await response.json()
      cachedToken = data.token
      return data.token as string
    })()
      .catch(() => '')
      .finally(() => {
        tokenPromise = null
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

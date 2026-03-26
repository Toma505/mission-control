/**
 * Client-side API helper with session token authentication.
 *
 * In the Electron desktop app, the token is retrieved securely via IPC
 * (contextBridge). In dev mode without Electron, falls back to the
 * /api/auth/token HTTP endpoint (localhost-only, to be removed in production).
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
      // Prefer secure IPC channel from Electron main process
      const electronToken = await getTokenFromElectron()
      if (electronToken) {
        cachedToken = electronToken
        return electronToken
      }

      // Dev-mode fallback only — this endpoint should be removed in production builds
      if (process.env.NODE_ENV === 'development') {
        const response = await fetch('/api/auth/token')
        const data = await response.json()
        cachedToken = data.token
        return data.token as string
      }

      return ''
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

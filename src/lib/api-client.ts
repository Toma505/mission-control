/**
 * Client-side API helper with authenticated local API access.
 *
 * In the Electron desktop app, requests are proxied through a privileged
 * preload/main-process bridge so the raw session token never reaches the
 * renderer. In standalone dev mode, a localhost-only bootstrap route can
 * still provide the token when explicitly enabled.
 */

let cachedToken: string | null = null
let tokenPromise: Promise<string> | null = null

type SerializedRequestBody =
  | { kind: 'text'; value: string }
  | {
      kind: 'form-data'
      entries: Array<
        | { name: string; kind: 'text'; value: string }
        | {
            name: string
            kind: 'file'
            filename: string
            contentType: string
            valueBase64: string
          }
      >
    }

interface ElectronApiRequest {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: SerializedRequestBody
}

interface ElectronApiResponse {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  bodyBase64: string
}

function getElectronApi() {
  if (typeof window === 'undefined') return undefined

  return (window as typeof window & {
    electronAPI?: {
      apiRequest?: (request: ElectronApiRequest) => Promise<ElectronApiResponse>
    }
  }).electronAPI
}

function isAbsoluteUrl(url: string) {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url) || url.startsWith('//')
}

function isRelativeApiPath(url: string) {
  return /^\/api(?:\/|$|\?)/.test(url)
}

function decodeBase64(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function serializeBody(body: BodyInit | null | undefined): Promise<SerializedRequestBody | undefined> {
  if (!body) return undefined

  if (typeof body === 'string') {
    return { kind: 'text', value: body }
  }

  if (body instanceof URLSearchParams) {
    return { kind: 'text', value: body.toString() }
  }

  if (body instanceof FormData) {
    const entries = await Promise.all(
      Array.from(body.entries()).map(async ([name, value]) => {
        if (typeof value === 'string') {
          return { name, kind: 'text' as const, value }
        }

        const buffer = await value.arrayBuffer()
        let binary = ''
        const bytes = new Uint8Array(buffer)
        bytes.forEach((byte) => {
          binary += String.fromCharCode(byte)
        })

        return {
          name,
          kind: 'file' as const,
          filename: value.name || 'upload.bin',
          contentType: value.type || 'application/octet-stream',
          valueBase64: btoa(binary),
        }
      }),
    )

    return {
      kind: 'form-data',
      entries,
    }
  }

  if (body instanceof Blob) {
    const buffer = await body.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(buffer)
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })

    return {
      kind: 'form-data',
      entries: [
        {
          name: 'file',
          kind: 'file',
          filename: 'upload.bin',
          contentType: body.type || 'application/octet-stream',
          valueBase64: btoa(binary),
        },
      ],
    }
  }

  throw new Error('Unsupported request body for authenticated API call')
}

async function getDevBootstrapToken(): Promise<string> {
  if (cachedToken) return cachedToken

  if (!tokenPromise) {
    tokenPromise = (async () => {
      if (process.env.NODE_ENV === 'development') {
        const response = await fetch('/api/auth/token')
        if (!response.ok) return ''
        const data = await response.json()
        cachedToken = typeof data.token === 'string' ? data.token : ''
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

async function electronApiFetch(url: string, options: RequestInit = {}) {
  const electronApi = getElectronApi()
  if (!electronApi?.apiRequest) return null

  const headers = new Headers(options.headers)
  const serializedBody = await serializeBody(options.body ?? undefined)
  const response = await electronApi.apiRequest({
    url,
    method: options.method || 'GET',
    headers: Object.fromEntries(headers.entries()),
    body: serializedBody,
  })

  return new Response(decodeBase64(response.bodyBase64), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (isAbsoluteUrl(url) || !isRelativeApiPath(url)) {
    throw new Error('apiFetch only supports relative /api routes')
  }

  const electronResponse = await electronApiFetch(url, options)
  if (electronResponse) {
    return electronResponse
  }

  const token = await getDevBootstrapToken()

  const headers = new Headers(options.headers)
  if (token) {
    headers.set('x-mc-token', token)
  }

  return fetch(url, { ...options, headers })
}

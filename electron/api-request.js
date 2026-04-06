const { Buffer } = require('buffer')

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

function isAbsoluteUrl(url) {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url) || url.startsWith('//')
}

function isAllowedApiPath(url) {
  return typeof url === 'string' && url.startsWith('/api') && !isAbsoluteUrl(url)
}

function normalizeHeaders(input) {
  const headers = {}
  if (!input || typeof input !== 'object') return headers

  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string') continue
    const normalizedKey = key.trim()
    if (!normalizedKey) continue
    if (normalizedKey.toLowerCase() === 'x-mc-token') continue
    headers[normalizedKey] = value
  }

  return headers
}

async function deserializeBody(body) {
  if (!body || typeof body !== 'object') return undefined

  if (body.kind === 'text') {
    return typeof body.value === 'string' ? body.value : ''
  }

  if (body.kind !== 'form-data' || !Array.isArray(body.entries)) {
    return undefined
  }

  const formData = new FormData()
  for (const entry of body.entries) {
    if (!entry || typeof entry !== 'object' || typeof entry.name !== 'string') continue

    if (entry.kind === 'text') {
      formData.append(entry.name, typeof entry.value === 'string' ? entry.value : '')
      continue
    }

    if (entry.kind === 'file' && typeof entry.valueBase64 === 'string') {
      const blob = new Blob(
        [Buffer.from(entry.valueBase64, 'base64')],
        { type: typeof entry.contentType === 'string' ? entry.contentType : 'application/octet-stream' },
      )
      formData.append(
        entry.name,
        blob,
        typeof entry.filename === 'string' && entry.filename ? entry.filename : 'upload.bin',
      )
    }
  }

  return formData
}

function encodeJson(status, payload) {
  const body = Buffer.from(JSON.stringify(payload))
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: payload?.error || 'Error',
    headers: {
      'content-type': 'application/json',
    },
    bodyBase64: body.toString('base64'),
  }
}

async function handleApiRequest({ getPort, getSessionToken, request }) {
  const url = request?.url
  if (!isAllowedApiPath(url)) {
    return encodeJson(400, { error: 'Invalid API path' })
  }

  const method = String(request?.method || 'GET').toUpperCase()
  if (!ALLOWED_METHODS.has(method)) {
    return encodeJson(405, { error: 'Unsupported method' })
  }

  try {
    const headers = normalizeHeaders(request?.headers)
    const sessionToken = getSessionToken()
    if (sessionToken) {
      headers['x-mc-token'] = sessionToken
    }

    const body = await deserializeBody(request?.body)
    const response = await fetch(`http://127.0.0.1:${getPort()}${url}`, {
      method,
      headers,
      body,
    })
    const buffer = Buffer.from(await response.arrayBuffer())

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      bodyBase64: buffer.toString('base64'),
    }
  } catch (error) {
    return encodeJson(502, {
      error: error instanceof Error ? error.message : 'Request failed',
    })
  }
}

module.exports = {
  handleApiRequest,
}

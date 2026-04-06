import { NextRequest } from 'next/server'

export function getLocalApiOrigin(request: NextRequest) {
  const port =
    request.nextUrl.port ||
    process.env.PORT ||
    (process.env.NODE_ENV === 'production' ? '3847' : '3000')

  return `http://127.0.0.1:${port}`
}

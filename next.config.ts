import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production'

const connectSrc = ["'self'"]
if (isDev) {
  connectSrc.push(
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'ws://127.0.0.1:3000',
    'ws://localhost:3000',
  )
}

const scriptSrc = ["'self'", "'unsafe-inline'"]
if (isDev) {
  scriptSrc.push("'unsafe-eval'")
}

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${connectSrc.join(' ')}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const nextConfig: NextConfig = {
  // Standalone mode bundles the server + node_modules into .next/standalone
  // so Electron can run it directly without npm/node installed on the user's machine
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
};

export default nextConfig;

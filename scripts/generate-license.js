#!/usr/bin/env node
/**
 * License Key Generator for Mission Control
 *
 * Generates HMAC-signed license keys that can be validated offline.
 * The secret must match the one embedded in the app.
 *
 * Usage:
 *   node scripts/generate-license.js                    # Generate 1 key
 *   node scripts/generate-license.js --count 10         # Generate 10 keys
 *   node scripts/generate-license.js --email user@x.com # Tag a key with email
 *
 * Key format: MC-XXXXX-XXXXX-XXXXX-XXXXX (base32, 20 chars payload)
 * Structure: [8-char random ID][12-char HMAC signature of that ID]
 */

const crypto = require('crypto')
const { resolveLicenseSecret } = require('../electron/license-secret')

let LICENSE_SECRET = ''
try {
  LICENSE_SECRET = resolveLicenseSecret({ allowPlaceholder: false })
} catch (error) {
  console.error(`[license-generator] ${error instanceof Error ? error.message : 'MC_LICENSE_SECRET is invalid.'}`)
  process.exit(1)
}

const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I, O, 0, 1 (avoid confusion)

function toBase32(buffer, length) {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += BASE32[buffer[i] % BASE32.length]
  }
  return result
}

function generateLicenseKey() {
  // 8-char random payload
  const idBytes = crypto.randomBytes(8)
  const id = toBase32(idBytes, 8)

  // HMAC-SHA256 of the ID, truncated to 12 base32 chars
  const hmac = crypto.createHmac('sha256', LICENSE_SECRET).update(id).digest()
  const sig = toBase32(hmac, 12)

  // Format: MC-XXXXX-XXXXX-XXXXX-XXXXX
  const raw = id + sig // 20 chars
  return `MC-${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}`
}

function validateLicenseKey(key) {
  // Strip formatting
  const clean = key.toUpperCase().replace(/[^A-Z0-9]/g, '')

  // Must start with MC and have 20 chars of payload
  if (!clean.startsWith('MC') || clean.length !== 22) return false

  const payload = clean.slice(2) // remove MC prefix
  const id = payload.slice(0, 8)
  const sig = payload.slice(8, 20)

  // Recompute HMAC
  const hmac = crypto.createHmac('sha256', LICENSE_SECRET).update(id).digest()
  const expectedSig = toBase32(hmac, 12)

  return sig === expectedSig
}

// ── CLI ──

const args = process.argv.slice(2)
const countIdx = args.indexOf('--count')
const count = countIdx !== -1 ? parseInt(args[countIdx + 1]) || 1 : 1
const emailIdx = args.indexOf('--email')
const email = emailIdx !== -1 ? args[emailIdx + 1] : null

console.log('Mission Control License Generator')
console.log('==================================')
if (email) console.log(`Tagged for: ${email}`)
console.log()

const keys = []
for (let i = 0; i < count; i++) {
  const key = generateLicenseKey()
  const valid = validateLicenseKey(key) // self-check
  keys.push(key)
  console.log(`  ${key}  ${valid ? '✓' : '✗ INVALID (bug!)'}`)
}

console.log()
console.log(`Generated ${count} key(s). Secret: ${LICENSE_SECRET.slice(0, 8)}...`)
console.log()

// Export for use as module
module.exports = { generateLicenseKey, validateLicenseKey, LICENSE_SECRET, BASE32, toBase32 }

const fs = require('fs')
const path = require('path')

const PLACEHOLDER_LICENSE_SECRET = 'mc-prod-secret-change-me-before-shipping'
const GENERATED_LICENSE_SECRET_FILE = path.join(__dirname, '.generated-license-secret.json')
const MIN_LICENSE_SECRET_LENGTH = 32

function normalizeLicenseSecret(secret) {
  return typeof secret === 'string' ? secret.trim() : ''
}

function getLicenseSecretError(secret) {
  const normalized = normalizeLicenseSecret(secret)

  if (!normalized) {
    return 'MC_LICENSE_SECRET is missing. Set a real secret in the build or release environment.'
  }

  if (normalized === PLACEHOLDER_LICENSE_SECRET) {
    return 'MC_LICENSE_SECRET is still using the placeholder value. Replace it before packaging.'
  }

  if (normalized.length < MIN_LICENSE_SECRET_LENGTH) {
    return `MC_LICENSE_SECRET must be at least ${MIN_LICENSE_SECRET_LENGTH} characters long.`
  }

  return null
}

function isValidLicenseSecret(secret) {
  return getLicenseSecretError(secret) === null
}

function readEmbeddedLicenseSecret() {
  try {
    const payload = JSON.parse(fs.readFileSync(GENERATED_LICENSE_SECRET_FILE, 'utf-8'))
    return normalizeLicenseSecret(payload.secret)
  } catch {
    return ''
  }
}

function resolveLicenseSecret({
  allowPlaceholder = false,
  preferEmbedded = true,
} = {}) {
  const embeddedSecret = preferEmbedded ? readEmbeddedLicenseSecret() : ''
  const envSecret = normalizeLicenseSecret(process.env.MC_LICENSE_SECRET)
  const resolved = embeddedSecret || envSecret || PLACEHOLDER_LICENSE_SECRET

  if (!allowPlaceholder) {
    const error = getLicenseSecretError(resolved)
    if (error) throw new Error(error)
  }

  return resolved
}

module.exports = {
  GENERATED_LICENSE_SECRET_FILE,
  MIN_LICENSE_SECRET_LENGTH,
  PLACEHOLDER_LICENSE_SECRET,
  getLicenseSecretError,
  isValidLicenseSecret,
  normalizeLicenseSecret,
  readEmbeddedLicenseSecret,
  resolveLicenseSecret,
}

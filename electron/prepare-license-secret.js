const fs = require('fs')

const {
  GENERATED_LICENSE_SECRET_FILE,
  getLicenseSecretError,
  normalizeLicenseSecret,
} = require('./license-secret')

const licenseSecret = normalizeLicenseSecret(process.env.MC_LICENSE_SECRET)
const error = getLicenseSecretError(licenseSecret)

if (error) {
  try { fs.rmSync(GENERATED_LICENSE_SECRET_FILE, { force: true }) } catch {}
  console.error(`[license-secret] ${error}`)
  process.exit(1)
}

fs.writeFileSync(
  GENERATED_LICENSE_SECRET_FILE,
  JSON.stringify({ secret: licenseSecret }, null, 2),
)

console.log(`[license-secret] Embedded release secret prepared at ${GENERATED_LICENSE_SECRET_FILE}`)

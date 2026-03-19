const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { safeStorage } = require('electron')

const CONFIG_KEY_STATE_FILE = 'secure-config-key.json'

function createSessionToken() {
  return crypto.randomBytes(32).toString('hex')
}

function loadOrCreateConfigEncryptionKey(userDataPath) {
  if (!safeStorage.isEncryptionAvailable()) {
    return ''
  }

  const stateFile = path.join(userDataPath, CONFIG_KEY_STATE_FILE)

  try {
    if (fs.existsSync(stateFile)) {
      const payload = JSON.parse(fs.readFileSync(stateFile, 'utf-8'))
      if (typeof payload.encrypted !== 'string' || !payload.encrypted) {
        throw new Error('Config encryption state is invalid')
      }

      return safeStorage.decryptString(Buffer.from(payload.encrypted, 'base64')).trim()
    }
  } catch (error) {
    console.warn('[mc] Failed to read config encryption key:', error instanceof Error ? error.message : error)
    return ''
  }

  const key = crypto.randomBytes(32).toString('hex')

  try {
    const encrypted = safeStorage.encryptString(key).toString('base64')
    fs.writeFileSync(stateFile, JSON.stringify({ version: 1, encrypted }, null, 2))
    return key
  } catch (error) {
    console.warn('[mc] Failed to persist config encryption key:', error instanceof Error ? error.message : error)
    return ''
  }
}

module.exports = {
  createSessionToken,
  loadOrCreateConfigEncryptionKey,
}

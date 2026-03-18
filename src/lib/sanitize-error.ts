/**
 * Error sanitizer for API responses.
 *
 * Maps known internal error patterns to user-friendly messages.
 * Unknown errors get a generic fallback — never leak raw error.message
 * to the client in a consumer app.
 */

export function sanitizeError(error: unknown, fallback = 'Something went wrong'): string {
  if (!(error instanceof Error)) return fallback

  const msg = error.message

  // Connection errors — OpenClaw or external services unreachable
  if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
    return 'Could not reach OpenClaw. Check your connection settings.'
  }
  if (msg.includes('ETIMEDOUT') || msg.includes('ESOCKETTIMEDOUT') || msg.includes('timeout')) {
    return 'The request timed out. The server may be under heavy load — try again.'
  }
  if (msg.includes('ECONNRESET') || msg.includes('socket hang up')) {
    return 'The connection was interrupted. Try again.'
  }

  // Filesystem errors
  if (msg.includes('ENOSPC') || msg.includes('EDQUOT')) {
    return 'Disk is full. Free up space and try again.'
  }
  if (msg.includes('EACCES') || msg.includes('EPERM')) {
    return 'Permission denied. Check that the app has write access to its data directory.'
  }
  if (msg.includes('ENOENT')) {
    return 'A required file was not found. Try restarting Mission Control.'
  }

  // JSON/parsing errors
  if (msg.includes('JSON') || msg.includes('Unexpected token')) {
    return 'Received an unexpected response. The server may be misconfigured.'
  }

  // Network/fetch errors
  if (msg.includes('fetch failed') || msg.includes('network')) {
    return 'A network error occurred. Check your connection and try again.'
  }

  // Default — never pass through raw error.message
  return fallback
}

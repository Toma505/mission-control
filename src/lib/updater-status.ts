export type UpdaterStatus = {
  status: string
  info?: { version?: string } | null
  error?: string | null
  progress?: { percent?: number } | null
}

export function normalizeUpdaterError(error?: string | null) {
  if (!error) return null

  const message = error.trim()
  const lower = message.toLowerCase()

  if (lower.includes('no published versions on github')) {
    return 'No public desktop release has been published yet.'
  }

  if (lower.includes('latest.yml') || lower.includes('app-update.yml')) {
    return 'The desktop update feed is not published correctly yet.'
  }

  if (lower.includes('cannot find channel')) {
    return 'Mission Control could not find a matching update channel.'
  }

  return message
}

export function formatUpdaterMessage(status?: UpdaterStatus | null) {
  switch (status?.status) {
    case 'checking':
      return 'Checking for updates...'
    case 'available':
      return status.info?.version ? `Update ${status.info.version} is available.` : 'An update is available.'
    case 'downloading':
      return status.progress?.percent
        ? `Downloading update (${Math.round(status.progress.percent)}%).`
        : 'Downloading update...'
    case 'up-to-date':
      return 'Mission Control is up to date.'
    case 'downloaded':
      return 'Update downloaded. Restart Mission Control to install it.'
    case 'dev':
      return status.error || 'Updates are disabled in development mode.'
    case 'error':
      return normalizeUpdaterError(status.error) || 'Update check failed.'
    default:
      return null
  }
}

export function formatUpdaterLabel(status?: UpdaterStatus | null) {
  switch (status?.status) {
    case 'checking':
      return 'Checking for updates'
    case 'available':
      return status.info?.version ? `Update ${status.info.version} available` : 'Update available'
    case 'downloading':
      return status.progress?.percent
        ? `Downloading update (${Math.round(status.progress.percent)}%)`
        : 'Downloading update'
    case 'downloaded':
      return 'Update ready to install'
    case 'up-to-date':
      return 'Up to date'
    case 'dev':
      return 'Updates disabled in development'
    case 'error':
      return normalizeUpdaterError(status.error) || 'Update check failed'
    default:
      return 'No update check yet'
  }
}

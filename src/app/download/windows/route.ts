export const runtime = 'nodejs'

const GITHUB_LATEST_YML_URL =
  'https://github.com/Toma505/mission-control/releases/latest/download/latest.yml'
const GITHUB_LATEST_RELEASE_API = 'https://api.github.com/repos/Toma505/mission-control/releases/latest'
const GITHUB_RELEASES_LATEST_DOWNLOAD_PREFIX =
  'https://github.com/Toma505/mission-control/releases/latest/download/'
const WINDOWS_INSTALLER_PATTERN = /^Mission[- .]Control[- .]Setup[- .].*\.exe$/i

interface GitHubReleaseAsset {
  name?: string
  browser_download_url?: string
}

interface GitHubReleaseResponse {
  assets?: GitHubReleaseAsset[]
}

interface ResolvedInstaller {
  name: string
  url: string
}

function getConfiguredInstallerSourceUrl() {
  const directUrl = (process.env.MISSION_CONTROL_WINDOWS_DOWNLOAD_URL || '').trim()
  return directUrl || null
}

function inferInstallerNameFromUrl(url: string) {
  try {
    const parsed = new URL(url)
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop()
    const decoded = lastSegment ? decodeURIComponent(lastSegment) : ''
    if (decoded && WINDOWS_INSTALLER_PATTERN.test(decoded)) {
      return decoded
    }
  } catch {
    // Fall through to the default filename when the override URL is malformed.
  }

  return 'Mission.Control.Setup.exe'
}

function encodeAssetPath(assetName: string) {
  return assetName
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function buildLatestDownloadUrl(assetName: string) {
  return `${GITHUB_RELEASES_LATEST_DOWNLOAD_PREFIX}${encodeAssetPath(assetName)}`
}

function parseLatestYmlPath(body: string) {
  const match = body.match(/^path:\s*(.+)$/m)
  return match?.[1]?.trim() || null
}

async function resolveInstallerFromLatestYml(): Promise<ResolvedInstaller | null> {
  const response = await fetch(GITHUB_LATEST_YML_URL, {
    headers: {
      Accept: 'text/plain',
      'User-Agent': 'Mission-Control-Installer-Download',
    },
    next: { revalidate: 300 },
  })

  if (!response.ok) {
    return null
  }

  const latestYml = await response.text()
  const installerName = parseLatestYmlPath(latestYml)
  if (!installerName || !WINDOWS_INSTALLER_PATTERN.test(installerName)) {
    return null
  }

  return {
    name: installerName,
    url: buildLatestDownloadUrl(installerName),
  }
}

async function resolveInstallerFromGitHubApi(): Promise<ResolvedInstaller | null> {
  const response = await fetch(GITHUB_LATEST_RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Mission-Control-Installer-Download',
    },
    next: { revalidate: 300 },
  })

  if (!response.ok) {
    return null
  }

  const release = (await response.json()) as GitHubReleaseResponse
  const asset = release.assets?.find((candidate) => {
    const name = candidate.name || ''
    return WINDOWS_INSTALLER_PATTERN.test(name) && !name.endsWith('.blockmap')
  })

  if (!asset?.browser_download_url || !asset.name) {
    return null
  }

  return {
    name: asset.name,
    url: asset.browser_download_url,
  }
}

async function resolveLatestInstaller(): Promise<ResolvedInstaller | null> {
  const configuredSource = getConfiguredInstallerSourceUrl()
  if (configuredSource) {
    return {
      name: inferInstallerNameFromUrl(configuredSource),
      url: configuredSource,
    }
  }

  const apiMatch = await resolveInstallerFromGitHubApi()
  if (apiMatch) {
    return apiMatch
  }

  return resolveInstallerFromLatestYml()
}

async function streamInstallerDownload(installer: ResolvedInstaller) {
  const response = await fetch(installer.url, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'Mission-Control-Installer-Download',
    },
    redirect: 'follow',
    next: { revalidate: 300 },
  })

  if (!response.ok || !response.body) {
    return null
  }

  const headers = new Headers()
  headers.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream')
  headers.set('Content-Disposition', `attachment; filename="${installer.name}"`)
  headers.set('Cache-Control', 'public, max-age=300')

  const contentLength = response.headers.get('content-length')
  if (contentLength) {
    headers.set('Content-Length', contentLength)
  }

  return new Response(response.body, {
    status: 200,
    headers,
  })
}

function installerUnavailableResponse() {
  return new Response('Installer is temporarily unavailable. Please try again in a minute.', {
    status: 503,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET() {
  try {
    const installer = await resolveLatestInstaller()
    if (!installer) {
      return installerUnavailableResponse()
    }

    const streamedDownload = await streamInstallerDownload(installer)
    if (streamedDownload) {
      return streamedDownload
    }

    return installerUnavailableResponse()
  } catch {
    return installerUnavailableResponse()
  }
}

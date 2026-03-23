import { NextResponse } from 'next/server'

const GITHUB_LATEST_RELEASE_API = 'https://api.github.com/repos/Toma505/mission-control/releases/latest'
const LEGACY_RELEASES_PAGE = 'https://github.com/Toma505/mission-control/releases/latest'
const WINDOWS_INSTALLER_PATTERN = /^Mission Control Setup .*\.exe$/i

interface GitHubReleaseAsset {
  name?: string
  browser_download_url?: string
}

interface GitHubReleaseResponse {
  assets?: GitHubReleaseAsset[]
}

function getConfiguredDirectDownloadUrl() {
  const directUrl = (process.env.MISSION_CONTROL_WINDOWS_DOWNLOAD_URL || '').trim()
  return directUrl || null
}

function getLegacyFallbackUrl() {
  return LEGACY_RELEASES_PAGE
}

export async function GET() {
  const configuredDirectUrl = getConfiguredDirectDownloadUrl()
  if (configuredDirectUrl) {
    return NextResponse.redirect(configuredDirectUrl, { status: 302 })
  }

  try {
    const response = await fetch(GITHUB_LATEST_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Mission-Control-Download-Redirect',
      },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      return NextResponse.redirect(getLegacyFallbackUrl(), { status: 302 })
    }

    const release = (await response.json()) as GitHubReleaseResponse
    const asset = release.assets?.find((candidate) => {
      const name = candidate.name || ''
      return WINDOWS_INSTALLER_PATTERN.test(name) && !name.endsWith('.blockmap')
    })

    if (!asset?.browser_download_url) {
      return NextResponse.redirect(getLegacyFallbackUrl(), { status: 302 })
    }

    return NextResponse.redirect(asset.browser_download_url, { status: 302 })
  } catch {
    return NextResponse.redirect(getLegacyFallbackUrl(), { status: 302 })
  }
}

import { NextRequest, NextResponse } from 'next/server'

import {
  applyPortableImport,
  buildPortableBundle,
  MAX_PORTABLE_BUNDLE_BYTES,
  previewPortableImport,
  type PortableCategory,
} from '@/lib/portable-bundle'
import { sanitizeError } from '@/lib/sanitize-error'
import {
  isAuthorized,
  isTrustedLocalhostRequest,
  localOnlyResponse,
  unauthorizedResponse,
} from '@/lib/api-auth'

function parseCategories(value: unknown): PortableCategory[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value
    .map((entry) => String(entry))
    .filter((entry): entry is PortableCategory =>
      [
        'settings',
        'prompts',
        'templates',
        'workflows',
        'schedules',
        'costTags',
        'snapshots',
        'keyVault',
        'notifications',
      ].includes(entry),
    )
}

export async function GET(request: NextRequest) {
  if (!isTrustedLocalhostRequest(request)) return localOnlyResponse()
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const bundle = await buildPortableBundle()
    const stamp = bundle.manifest.exportedAt.slice(0, 10)

    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="mission-control-${stamp}.mcbundle.json"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to export portable bundle.') },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isTrustedLocalhostRequest(request)) return localOnlyResponse()

  try {
    const body = (await request.json().catch(() => null)) as
      | {
          action?: string
          bundle?: unknown
          categories?: PortableCategory[]
          resolutions?: Record<string, 'keep' | 'overwrite'>
        }
      | null

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    if (!body.bundle) {
      return NextResponse.json({ error: 'A portable bundle is required.' }, { status: 400 })
    }

    const bundleSize = new TextEncoder().encode(JSON.stringify(body.bundle)).length
    if (bundleSize > MAX_PORTABLE_BUNDLE_BYTES) {
      return NextResponse.json(
        { error: 'Portable bundles must stay below 100 MB.' },
        { status: 400 },
      )
    }

    const categories = parseCategories(body.categories)

    if (body.action === 'preview') {
      const preview = await previewPortableImport(body.bundle, categories)
      return NextResponse.json(preview)
    }

    if (!isAuthorized(request)) return unauthorizedResponse()

    if (body.action === 'apply') {
      const result = await applyPortableImport(body.bundle, categories, body.resolutions || {})
      return NextResponse.json({ ok: true, result })
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to process portable bundle.') },
      { status: 500 },
    )
  }
}

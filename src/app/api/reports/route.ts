import { NextRequest, NextResponse } from 'next/server'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { sanitizeError } from '@/lib/sanitize-error'
import {
  buildReportPreview,
  deleteSavedReport,
  generateReport,
  getDefaultReportInput,
  getReportFilters,
  listSavedReports,
  readSavedReportFile,
} from '@/lib/reports-store'

export async function GET(request: NextRequest) {
  try {
    const downloadId = request.nextUrl.searchParams.get('download')
    if (downloadId) {
      const file = await readSavedReportFile(downloadId)
      if (!file) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 })
      }

      return new NextResponse(file.buffer, {
        status: 200,
        headers: {
          'Content-Type': file.contentType,
          'Content-Disposition': `attachment; filename="${file.fileName}"`,
        },
      })
    }

    const [reports, filters] = await Promise.all([listSavedReports(), getReportFilters()])

    return NextResponse.json({
      reports,
      filters,
      defaults: getDefaultReportInput(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to load reports') },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const action = typeof body.action === 'string' ? body.action : 'preview'

    if (action === 'preview') {
      const preview = await buildReportPreview(body)
      return NextResponse.json({ preview })
    }

    if (action === 'generate') {
      const report = await generateReport(body)
      return NextResponse.json(report)
    }

    return NextResponse.json({ error: 'Unsupported report action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to process report request') },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json().catch(() => null)
    const id = typeof body?.id === 'string' ? body.id : ''
    if (!id) {
      return NextResponse.json({ error: 'Report id is required' }, { status: 400 })
    }

    const deleted = await deleteSavedReport(id)
    if (!deleted) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to delete report') },
      { status: 500 },
    )
  }
}


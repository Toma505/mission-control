import { NextRequest, NextResponse } from 'next/server'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { sanitizeError } from '@/lib/sanitize-error'
import {
  addKnowledgeFiles,
  attachKnowledgeToAgent,
  deleteKnowledgeFile,
  detachKnowledgeAttachment,
  getKnowledgeDownload,
  listKnowledgeBase,
  MAX_KNOWLEDGE_FILE_SIZE_BYTES,
  MAX_KNOWLEDGE_TOTAL_UPLOAD_BYTES,
  MAX_KNOWLEDGE_UPLOAD_FILES,
  searchKnowledge,
} from '@/lib/knowledge-store'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const downloadId = request.nextUrl.searchParams.get('download')
    if (downloadId) {
      const file = await getKnowledgeDownload(downloadId)
      if (!file) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }

      return new NextResponse(file.buffer, {
        status: 200,
        headers: {
          'Content-Type': file.file.mimeType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${file.file.name}"`,
        },
      })
    }

    const query = request.nextUrl.searchParams.get('q') || ''
    const limit = Number(request.nextUrl.searchParams.get('limit') || 12)
    const [knowledge, results] = await Promise.all([
      listKnowledgeBase(),
      query.trim() ? searchKnowledge(query, Number.isFinite(limit) ? limit : 12) : Promise.resolve([]),
    ])

    return NextResponse.json({
      ...knowledge,
      results,
    })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to load knowledge base') },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const uploads = formData
        .getAll('files')
        .filter((entry): entry is File => entry instanceof File && entry.size > 0)

      if (uploads.length === 0) {
        return NextResponse.json({ error: 'Choose at least one file to upload' }, { status: 400 })
      }

      if (uploads.length > MAX_KNOWLEDGE_UPLOAD_FILES) {
        return NextResponse.json(
          { error: `Upload at most ${MAX_KNOWLEDGE_UPLOAD_FILES} files at a time.` },
          { status: 400 },
        )
      }

      const totalBytes = uploads.reduce((sum, file) => sum + file.size, 0)
      if (totalBytes > MAX_KNOWLEDGE_TOTAL_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: 'Uploads must stay below 50 MB total.' },
          { status: 400 },
        )
      }

      const oversized = uploads.find((file) => file.size > MAX_KNOWLEDGE_FILE_SIZE_BYTES)
      if (oversized) {
        return NextResponse.json(
          { error: `"${oversized.name}" exceeds the 10 MB per-file limit.` },
          { status: 400 },
        )
      }

      const files = await Promise.all(
        uploads.map(async (file) => ({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          buffer: Buffer.from(await file.arrayBuffer()),
        })),
      )

      const added = await addKnowledgeFiles(files)
      return NextResponse.json(added)
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const action = typeof body.action === 'string' ? body.action : ''

    if (action === 'attach') {
      const attachments = await attachKnowledgeToAgent({
        fileIds: Array.isArray(body.fileIds) ? body.fileIds.map(String) : [],
        agentId: String(body.agentId || ''),
        sessionKey: typeof body.sessionKey === 'string' ? body.sessionKey : undefined,
      })
      return NextResponse.json({ ok: true, attachments })
    }

    if (action === 'detach') {
      const attachmentId = String(body.attachmentId || '')
      if (!attachmentId) {
        return NextResponse.json({ error: 'Attachment id is required' }, { status: 400 })
      }

      const removed = await detachKnowledgeAttachment(attachmentId)
      if (!removed) {
        return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unsupported knowledge action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to update knowledge base') },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json().catch(() => null)
    const fileId = typeof body?.fileId === 'string' ? body.fileId : ''
    if (!fileId) {
      return NextResponse.json({ error: 'File id is required' }, { status: 400 })
    }

    const deleted = await deleteKnowledgeFile(fileId)
    if (!deleted) {
      return NextResponse.json({ error: 'Knowledge file not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to delete knowledge file') },
      { status: 500 },
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/sanitize-error'
import JSZip from 'jszip'
import { generateReport } from '@/lib/skill-scanner'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'

const MAX_ZIP_SIZE = 50 * 1024 * 1024 // 50 MB
const MAX_FILES_IN_ZIP = 5000           // Prevent zip bombs with thousands of entries
const MAX_TOTAL_UNCOMPRESSED = 500 * 1024 * 1024 // 500 MB total uncompressed

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_ZIP_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 50 MB.' }, { status: 400 })
    }

    if (!file.name.endsWith('.zip')) {
      return NextResponse.json({ error: 'Only .zip files are accepted.' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(buffer)

    // Zip bomb protection: check file count and total uncompressed size
    const entries = Object.entries(zip.files).filter(([, e]) => !e.dir)
    if (entries.length > MAX_FILES_IN_ZIP) {
      return NextResponse.json(
        { error: `Too many files in archive (${entries.length}). Maximum is ${MAX_FILES_IN_ZIP}.` },
        { status: 400 }
      )
    }

    let totalUncompressed = 0
    const files: { name: string; size: number; content?: string }[] = []

    for (const [name, entry] of entries) {
      const size = (entry as any)._data?.uncompressedSize ?? 0
      totalUncompressed += size

      if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) {
        return NextResponse.json(
          { error: 'Archive is too large when uncompressed. Maximum total is 500 MB.' },
          { status: 400 }
        )
      }

      // Only read text content for scannable files (skip large binaries)
      const ext = name.includes('.') ? '.' + name.split('.').pop()!.toLowerCase() : ''
      const isTextFile = [
        '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
        '.py', '.sh', '.bash', '.bat', '.cmd', '.ps1',
        '.json', '.yaml', '.yml', '.toml', '.md', '.txt',
        '.html', '.css', '.xml', '.env', '.cfg', '.ini',
      ].includes(ext)

      let content: string | undefined
      if (isTextFile && size < 1024 * 1024) { // Only read files < 1 MB
        try {
          content = await entry.async('string')
        } catch {
          content = undefined
        }
      }

      files.push({ name, size, content })
    }

    const report = generateReport(files)

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      fileSize: file.size,
      report,
    })
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error, 'Scan failed') }, { status: 500 })
  }
}

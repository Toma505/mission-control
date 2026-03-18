import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { generateReport } from '@/lib/skill-scanner'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'

const MAX_ZIP_SIZE = 50 * 1024 * 1024 // 50 MB

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

    const files: { name: string; size: number; content?: string }[] = []

    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue

      const size = (entry as any)._data?.uncompressedSize ?? 0

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
    const msg = error instanceof Error ? error.message : 'Scan failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

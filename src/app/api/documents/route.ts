import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { sanitizeError } from '@/lib/sanitize-error'
import { isConfigured, runCommand } from '@/lib/openclaw'
import { DATA_DIR } from '@/lib/connection-config'
import { isLegacyDemoDocuments } from '@/lib/legacy-demo-data'

async function readLocalDocs() {
  try {
    const text = await readFile(path.join(DATA_DIR, 'documents.json'), 'utf-8')
    const data = JSON.parse(text)
    const documents = Array.isArray(data) ? data : []
    return isLegacyDemoDocuments(documents) ? [] : documents
  } catch { return [] }
}

export async function GET() {
  if (!(await isConfigured())) {
    const documents = await readLocalDocs()
    return NextResponse.json({ connected: false, documents })
  }

  try {
    // Try to list workspace files
    const result = await runCommand('exec', 'ls -la /data/workspace 2>/dev/null || echo "empty"')

    const documents: { name: string; size: string; modified: string; type: string }[] = []

    if (result.ok && result.output && !result.output.includes('empty')) {
      const lines = result.output.split('\n').filter((l: string) => l.trim() && !l.startsWith('total'))
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 9) {
          const name = parts.slice(8).join(' ')
          if (name === '.' || name === '..') continue
          const isDir = line.startsWith('d')
          documents.push({
            name,
            size: parts[4] || '0',
            modified: `${parts[5]} ${parts[6]} ${parts[7]}`,
            type: isDir ? 'folder' : name.split('.').pop() || 'file',
          })
        }
      }
    }

    const finalDocs = documents.length > 0 ? documents : await readLocalDocs()
    return NextResponse.json({ connected: true, documents: finalDocs })
  } catch (error) {
    const documents = await readLocalDocs()
    return NextResponse.json({ connected: false, error: sanitizeError(error, 'Could not fetch documents'), documents })
  }
}

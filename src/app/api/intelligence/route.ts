import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { sanitizeError } from '@/lib/sanitize-error'
import { isConfigured, runCommand } from '@/lib/openclaw'
import { DATA_DIR } from '@/lib/connection-config'

async function readLocalIntelligence() {
  try {
    const text = await readFile(path.join(DATA_DIR, 'intelligence.json'), 'utf-8')
    const data = JSON.parse(text)
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

export async function GET() {
  if (!(await isConfigured())) {
    const insights = await readLocalIntelligence()
    return NextResponse.json({ connected: false, memories: insights })
  }

  try {
    // Try to search memory entries
    const result = await runCommand('openclaw.memory.list')

    const memories: { id: string; content: string; createdAt: string }[] = []

    if (result.ok && result.output) {
      // Parse memory entries from output
      const lines = result.output.split('\n').filter((l: string) => l.trim())
      for (const line of lines) {
        const match = line.match(/^(?:[-•]\s*)?(.+?)(?:\s*\((.+?)\))?$/)
        if (match) {
          memories.push({
            id: String(memories.length),
            content: match[1].trim(),
            createdAt: match[2] || '',
          })
        }
      }
    }

    const finalMemories = memories.length > 0 ? memories : await readLocalIntelligence()
    return NextResponse.json({ connected: true, memories: finalMemories })
  } catch (error) {
    const memories = await readLocalIntelligence()
    return NextResponse.json({ connected: false, error: sanitizeError(error, 'Could not fetch intelligence data'), memories })
  }
}

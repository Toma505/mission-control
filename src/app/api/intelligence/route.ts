import { NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/sanitize-error'
import { isConfigured, runCommand } from '@/lib/openclaw'

export async function GET() {
  if (!(await isConfigured())) {
    return NextResponse.json({ connected: false, memories: [] })
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

    return NextResponse.json({ connected: true, memories })
  } catch (error) {
    return NextResponse.json({ connected: false, error: sanitizeError(error, 'Could not fetch intelligence data'), memories: [] })
  }
}

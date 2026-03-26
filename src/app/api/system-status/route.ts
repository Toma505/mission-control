import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const FALLBACK_STATUS = {
  overall: 'UNKNOWN',
  message: 'No system status has been recorded yet.',
  lastChecked: null,
  agentsActive: 0,
  tasksInProgress: 0,
  systemLoad: 0,
  stale: true,
}

export async function GET() {
  try {
    const status = await prisma.systemStatus.findFirst({
      orderBy: { lastChecked: 'desc' }
    })
    return NextResponse.json(status ?? FALLBACK_STATUS)
  } catch (error) {
    return NextResponse.json(FALLBACK_STATUS)
  }
}

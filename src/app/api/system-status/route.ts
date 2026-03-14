import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const status = await prisma.systemStatus.findFirst({
      orderBy: { lastChecked: 'desc' }
    })
    return NextResponse.json(status)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch system status' }, { status: 500 })
  }
}

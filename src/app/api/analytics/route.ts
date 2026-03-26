import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin

  try {
    const [costsRes, historyRes] = await Promise.all([
      fetch(`${origin}/api/costs`, { cache: 'no-store' }),
      fetch(`${origin}/api/costs/history?range=30d`, { cache: 'no-store' }),
    ])

    const costs = costsRes.ok ? await costsRes.json() : null
    const history = historyRes.ok ? await historyRes.json() : null

    return NextResponse.json({ costs, history })
  } catch {
    return NextResponse.json({ costs: null, history: null })
  }
}

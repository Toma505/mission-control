import { NextResponse } from 'next/server'

const UNAVAILABLE_MESSAGE =
  'Agent-to-Agent Chat is not shipping right now. The previous implementation used simulated local replies instead of real agent execution, so it has been disabled.'

export async function GET() {
  return NextResponse.json(
    {
      available: false,
      error: UNAVAILABLE_MESSAGE,
    },
    { status: 410 },
  )
}

export async function POST() {
  return NextResponse.json(
    {
      available: false,
      error: UNAVAILABLE_MESSAGE,
    },
    { status: 410 },
  )
}

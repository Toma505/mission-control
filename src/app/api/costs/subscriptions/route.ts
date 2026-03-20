import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { z } from 'zod/v4'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { DATA_DIR } from '@/lib/connection-config'

const FILE_PATH = path.join(DATA_DIR, 'subscriptions.json')

const SubscriptionSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  cost: z.number().min(0).max(100000),
  provider: z.enum(['anthropic', 'openai', 'other']),
  cycle: z.enum(['monthly', 'yearly']),
})

const SubscriptionsArraySchema = z.array(SubscriptionSchema).max(50)

export interface Subscription {
  id: string
  name: string
  cost: number
  provider: 'anthropic' | 'openai' | 'other'
  cycle: 'monthly' | 'yearly'
}

const DEFAULT_SUBSCRIPTIONS: Subscription[] = [
  { id: 'anthropic-pro', name: 'Anthropic Pro', cost: 20, provider: 'anthropic', cycle: 'monthly' },
]

async function readSubscriptions(): Promise<Subscription[]> {
  try {
    const text = await readFile(FILE_PATH, 'utf-8')
    return JSON.parse(text)
  } catch {
    return DEFAULT_SUBSCRIPTIONS
  }
}

async function writeSubscriptions(subs: Subscription[]) {
  const dataDir = DATA_DIR
  await mkdir(dataDir, { recursive: true })
  await writeFile(FILE_PATH, JSON.stringify(subs, null, 2))
}

export async function GET() {
  const subs = await readSubscriptions()
  return NextResponse.json(subs)
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json()
    const result = SubscriptionsArraySchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid data', details: result.error.issues }, { status: 400 })
    }

    await writeSubscriptions(result.data)
    return NextResponse.json(result.data)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

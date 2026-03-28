import { NextRequest, NextResponse } from 'next/server'

import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import {
  dismissNotifications,
  listNotifications,
  markNotificationsRead,
  type NotificationType,
  pushNotification,
  restoreNotifications,
  serializeNotification,
} from '@/lib/notifications-store'

const NOTIFICATION_TYPES: NotificationType[] = [
  'agent_complete',
  'agent_error',
  'agent_needs_input',
  'budget_alert',
  'schedule_fired',
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const includeDismissed = searchParams.get('includeDismissed') === '1'
  const unreadOnly = searchParams.get('unread') === '1'
  const limitParam = Number(searchParams.get('limit') || '')
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined

  const [notifications, allActive] = await Promise.all([
    listNotifications({ includeDismissed, limit }),
    listNotifications({ includeDismissed: false }),
  ])
  const serialized = notifications
    .map(serializeNotification)
    .filter((entry) => !unreadOnly || !entry.read)

  const unreadCount = allActive.filter((entry) => !entry.readAt).length

  return NextResponse.json({
    notifications: serialized,
    unreadCount,
    totalCount: serialized.length,
  })
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json()
    const type = String(body.type || '').trim()
    const title = String(body.title || '').trim()
    const message = String(body.message || '').trim()

    if (!type || !title || !message) {
      return NextResponse.json({ error: 'type, title, and message are required' }, { status: 400 })
    }

    if (!NOTIFICATION_TYPES.includes(type as NotificationType)) {
      return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 })
    }

    const notification = await pushNotification({
      type: type as NotificationType,
      title,
      message,
      href: typeof body.href === 'string' ? body.href : undefined,
      source: typeof body.source === 'string' ? body.source : undefined,
      outputSummary: typeof body.outputSummary === 'string' ? body.outputSummary : undefined,
    })

    return NextResponse.json({ ok: true, notification: serializeNotification(notification) })
  } catch {
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = await request.json() as { action?: string; ids?: unknown[] }
    const action = String(body.action || '').trim()
    const ids = Array.isArray(body.ids) ? body.ids.map((value: unknown) => String(value)) : []

    if (action === 'markAllRead') {
      await markNotificationsRead()
      return NextResponse.json({ ok: true })
    }

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Notification ids are required' }, { status: 400 })
    }

    if (action === 'markRead') {
      await markNotificationsRead(ids)
      return NextResponse.json({ ok: true })
    }

    if (action === 'dismiss') {
      await dismissNotifications(ids)
      return NextResponse.json({ ok: true })
    }

    if (action === 'restore') {
      await restoreNotifications(ids)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}

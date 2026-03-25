import { NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'

const NOTIF_FILE = path.join(DATA_DIR, 'notifications.json')
const MAX_NOTIFICATIONS = 200

export interface AppNotification {
  id: string
  type: 'alert' | 'budget' | 'system' | 'webhook' | 'info'
  title: string
  message: string
  timestamp: string
  read: boolean
  href?: string
  icon?: string
}

async function readNotifications(): Promise<AppNotification[]> {
  try {
    const text = await readFile(NOTIF_FILE, 'utf-8')
    return JSON.parse(text)
  } catch {
    return []
  }
}

async function writeNotifications(notifs: AppNotification[]) {
  await mkdir(path.dirname(NOTIF_FILE), { recursive: true })
  await writeFile(NOTIF_FILE, JSON.stringify(notifs.slice(-MAX_NOTIFICATIONS), null, 2))
}

/** GET — list all notifications (newest first) */
export async function GET() {
  const notifs = await readNotifications()
  const unreadCount = notifs.filter(n => !n.read).length
  return NextResponse.json({ notifications: notifs.reverse(), unreadCount })
}

/** POST — push a new notification */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { type = 'info', title, message, href, icon } = body

    if (!title || !message) {
      return NextResponse.json({ error: 'title and message required' }, { status: 400 })
    }

    const notif: AppNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      href,
      icon,
    }

    const notifs = await readNotifications()
    notifs.push(notif)
    await writeNotifications(notifs)

    return NextResponse.json({ ok: true, notification: notif })
  } catch {
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 })
  }
}

/** PATCH — mark notifications as read */
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { ids, markAllRead } = body

    const notifs = await readNotifications()

    if (markAllRead) {
      notifs.forEach(n => { n.read = true })
    } else if (Array.isArray(ids)) {
      const idSet = new Set(ids)
      notifs.forEach(n => { if (idSet.has(n.id)) n.read = true })
    }

    await writeNotifications(notifs)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}

/** DELETE — clear all notifications */
export async function DELETE() {
  await writeNotifications([])
  return NextResponse.json({ ok: true })
}

/**
 * Helper to push a notification from server-side code.
 * Used by alert check, webhook fire, etc.
 */
export async function pushNotification(notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) {
  const full: AppNotification = {
    ...notif,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    read: false,
  }
  const notifs = await readNotifications()
  notifs.push(full)
  await writeNotifications(notifs)
  return full
}

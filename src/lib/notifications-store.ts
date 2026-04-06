import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

import { DATA_DIR } from '@/lib/connection-config'

export type NotificationType =
  | 'agent_complete'
  | 'agent_error'
  | 'agent_needs_input'
  | 'budget_alert'
  | 'schedule_fired'

export type NotificationRecord = {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: string
  readAt: string | null
  dismissedAt: string | null
  href?: string
  source?: string
  outputSummary?: string
}

export type NotificationInput = Omit<NotificationRecord, 'id' | 'timestamp' | 'readAt' | 'dismissedAt'>

const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json')
const DEFAULT_NOTIFICATIONS_FILE = path.join(process.cwd(), 'data', 'notifications.json')
const MAX_NOTIFICATIONS = 400

type NotificationStoreFile = {
  notifications: NotificationRecord[]
}

function safeIso(value: unknown, fallback: string) {
  const iso = typeof value === 'string' ? value : ''
  return Number.isNaN(Date.parse(iso)) ? fallback : iso
}

function normalizeType(value: unknown): NotificationType {
  switch (value) {
    case 'budget':
    case 'budget_alert':
      return 'budget_alert'
    case 'system':
    case 'schedule_fired':
      return 'schedule_fired'
    case 'alert':
    case 'error':
    case 'agent_error':
      return 'agent_error'
    case 'success':
    case 'webhook':
    case 'agent_complete':
      return 'agent_complete'
    case 'agent_needs_input':
      return 'agent_needs_input'
    default:
      return 'agent_needs_input'
  }
}

function normalizeRecord(input: unknown): NotificationRecord | null {
  if (!input || typeof input !== 'object') return null

  const value = input as Record<string, unknown>
  const now = new Date().toISOString()
  const title = String(value.title || '').trim()
  const message = String(value.message || '').trim()
  if (!title || !message) return null

  const timestamp = safeIso(value.timestamp, now)
  const readAt = value.readAt
    ? safeIso(value.readAt, timestamp)
    : value.read === true
      ? timestamp
      : null
  const dismissedAt = value.dismissedAt
    ? safeIso(value.dismissedAt, timestamp)
    : value.dismissed === true
      ? timestamp
      : null

  return {
    id: String(value.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    type: normalizeType(value.type),
    title,
    message,
    timestamp,
    readAt,
    dismissedAt,
    href: typeof value.href === 'string' ? value.href : undefined,
    source: typeof value.source === 'string' ? value.source : undefined,
    outputSummary: typeof value.outputSummary === 'string' ? value.outputSummary : undefined,
  }
}

function normalizeStore(input: unknown): NotificationStoreFile {
  if (Array.isArray(input)) {
    return {
      notifications: input.map(normalizeRecord).filter((entry): entry is NotificationRecord => !!entry),
    }
  }

  const parsed = input as Partial<NotificationStoreFile> | null | undefined
  return {
    notifications: Array.isArray(parsed?.notifications)
      ? parsed.notifications.map(normalizeRecord).filter((entry): entry is NotificationRecord => !!entry)
      : [],
  }
}

async function readSeedStore() {
  try {
    const raw = await readFile(DEFAULT_NOTIFICATIONS_FILE, 'utf-8')
    return normalizeStore(JSON.parse(raw))
  } catch {
    return { notifications: [] }
  }
}

export async function readNotificationStore() {
  try {
    const raw = await readFile(NOTIFICATIONS_FILE, 'utf-8')
    return normalizeStore(JSON.parse(raw))
  } catch {
    return readSeedStore()
  }
}

export async function writeNotificationStore(store: NotificationStoreFile) {
  await mkdir(DATA_DIR, { recursive: true })
  const ordered = [...store.notifications]
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
    .slice(-MAX_NOTIFICATIONS)
  await writeFile(NOTIFICATIONS_FILE, JSON.stringify({ notifications: ordered }, null, 2))
}

export async function listNotifications(options?: { includeDismissed?: boolean; limit?: number }) {
  const store = await readNotificationStore()
  const includeDismissed = options?.includeDismissed === true
  const filtered = store.notifications
    .filter((entry) => includeDismissed || !entry.dismissedAt)
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())

  return typeof options?.limit === 'number' ? filtered.slice(0, options.limit) : filtered
}

export async function pushNotification(input: NotificationInput) {
  const store = await readNotificationStore()
  const record: NotificationRecord = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    title: input.title.trim(),
    message: input.message.trim(),
    timestamp: new Date().toISOString(),
    readAt: null,
    dismissedAt: null,
    href: input.href && /^\/[^/\\]/.test(input.href) ? input.href : undefined,
    source: input.source,
    outputSummary: input.outputSummary,
  }

  store.notifications.push(record)
  await writeNotificationStore(store)
  return record
}

export async function markNotificationsRead(ids?: string[]) {
  const store = await readNotificationStore()
  const now = new Date().toISOString()
  const targetIds = ids ? new Set(ids) : null

  for (const notification of store.notifications) {
    if (targetIds && !targetIds.has(notification.id)) continue
    notification.readAt = notification.readAt || now
  }

  await writeNotificationStore(store)
}

export async function dismissNotifications(ids: string[]) {
  const store = await readNotificationStore()
  const now = new Date().toISOString()
  const targetIds = new Set(ids)

  for (const notification of store.notifications) {
    if (!targetIds.has(notification.id)) continue
    notification.dismissedAt = now
    notification.readAt = notification.readAt || now
  }

  await writeNotificationStore(store)
}

export async function restoreNotifications(ids: string[]) {
  const store = await readNotificationStore()
  const targetIds = new Set(ids)

  for (const notification of store.notifications) {
    if (!targetIds.has(notification.id)) continue
    notification.dismissedAt = null
  }

  await writeNotificationStore(store)
}

export function serializeNotification(record: NotificationRecord) {
  return {
    ...record,
    read: !!record.readAt,
    dismissed: !!record.dismissedAt,
  }
}


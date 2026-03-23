import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

import { DATA_DIR } from '@/lib/connection-config'
import { generateLicenseKey, getLicenseSecret } from '@/lib/license-keys'

export type BillingPlanId = 'personal' | 'pro' | 'team'

export interface BillingPlan {
  id: BillingPlanId
  name: string
  priceUsd: number
  machineLimit: number
  updateTerm: string
  stripePriceIdEnv: string
}

export interface LicenseOrder {
  id: string
  provider: 'stripe'
  status: 'pending' | 'paid' | 'fulfilled' | 'refunded' | 'expired'
  planId: BillingPlanId
  planName: string
  email: string
  licenseKey: string | null
  stripeSessionId: string
  stripePaymentIntentId: string | null
  stripeCustomerId: string | null
  amountTotal: number | null
  currency: string | null
  customerName: string | null
  downloadUrl: string | null
  emailDeliveryStatus: 'pending' | 'sent' | 'failed' | 'disabled'
  emailDeliverySentAt: string | null
  emailDeliveryError: string | null
  createdAt: string
  updatedAt: string
  fulfilledAt: string | null
  refundedAt: string | null
  refundReason: string | null
  refundNotes: string | null
}

interface LicenseOrderStore {
  orders: LicenseOrder[]
}

const LICENSE_ORDERS_FILE = path.join(DATA_DIR, 'license-orders.json')

const BILLING_PLANS: Record<BillingPlanId, BillingPlan> = {
  personal: {
    id: 'personal',
    name: 'Personal',
    priceUsd: 9.99,
    machineLimit: 1,
    updateTerm: '1 year of updates',
    stripePriceIdEnv: 'STRIPE_PRICE_PERSONAL',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceUsd: 29.99,
    machineLimit: 3,
    updateTerm: '1 year of updates',
    stripePriceIdEnv: 'STRIPE_PRICE_PRO',
  },
  team: {
    id: 'team',
    name: 'Team',
    priceUsd: 79.99,
    machineLimit: 10,
    updateTerm: '1 year of updates',
    stripePriceIdEnv: 'STRIPE_PRICE_TEAM',
  },
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function listBillingPlans() {
  return Object.values(BILLING_PLANS)
}

export function getBillingPlan(planId: string): BillingPlan | null {
  return BILLING_PLANS[planId as BillingPlanId] || null
}

export function getStripeSecretKey() {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim()
  if (!key) throw new Error('STRIPE_SECRET_KEY is missing.')
  return key
}

export function getStripeWebhookSecret() {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim()
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is missing.')
  return secret
}

export function getStripePriceId(planId: BillingPlanId) {
  const plan = BILLING_PLANS[planId]
  const priceId = (process.env[plan.stripePriceIdEnv] || '').trim()
  if (!priceId) {
    throw new Error(`${plan.stripePriceIdEnv} is missing.`)
  }
  return priceId
}

export function getMissionControlSiteUrl() {
  return (process.env.MISSION_CONTROL_SITE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
}

export function getMissionControlPricingUrl() {
  return `${getMissionControlSiteUrl()}/pricing/`
}

export function getMissionControlDownloadUrl() {
  const configuredUrl = (process.env.MISSION_CONTROL_DOWNLOAD_URL || '').trim()

  if (!configuredUrl || configuredUrl === 'https://github.com/Toma505/mission-control/releases/latest') {
    return `${getMissionControlSiteUrl()}/download/windows`
  }

  return configuredUrl
}

async function readOrderStore(): Promise<LicenseOrderStore> {
  try {
    const raw = await readFile(LICENSE_ORDERS_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<LicenseOrderStore>
    return {
      orders: Array.isArray(parsed.orders)
        ? parsed.orders.map(normalizeLicenseOrder).filter((order): order is LicenseOrder => order !== null)
        : [],
    }
  } catch {
    return { orders: [] }
  }
}

function normalizeLicenseOrder(order: unknown): LicenseOrder | null {
  if (!order || typeof order !== 'object') return null

  const candidate = order as Partial<LicenseOrder>
  if (
    typeof candidate.id !== 'string' ||
    candidate.provider !== 'stripe' ||
    typeof candidate.planId !== 'string' ||
    typeof candidate.planName !== 'string' ||
    typeof candidate.email !== 'string' ||
    typeof candidate.stripeSessionId !== 'string' ||
    typeof candidate.createdAt !== 'string' ||
    typeof candidate.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: candidate.id,
    provider: 'stripe',
    status: candidate.status || 'pending',
    planId: candidate.planId as BillingPlanId,
    planName: candidate.planName,
    email: normalizeEmail(candidate.email),
    licenseKey: candidate.licenseKey || null,
    stripeSessionId: candidate.stripeSessionId,
    stripePaymentIntentId: candidate.stripePaymentIntentId || null,
    stripeCustomerId: candidate.stripeCustomerId || null,
    amountTotal: typeof candidate.amountTotal === 'number' ? candidate.amountTotal : null,
    currency: candidate.currency || null,
    customerName: candidate.customerName || null,
    downloadUrl: candidate.downloadUrl || getMissionControlDownloadUrl(),
    emailDeliveryStatus: candidate.emailDeliveryStatus || 'pending',
    emailDeliverySentAt: candidate.emailDeliverySentAt || null,
    emailDeliveryError: candidate.emailDeliveryError || null,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
    fulfilledAt: candidate.fulfilledAt || null,
    refundedAt: candidate.refundedAt || null,
    refundReason: candidate.refundReason || null,
    refundNotes: candidate.refundNotes || null,
  }
}

async function writeOrderStore(store: LicenseOrderStore) {
  await mkdir(path.dirname(LICENSE_ORDERS_FILE), { recursive: true })
  await writeFile(LICENSE_ORDERS_FILE, JSON.stringify(store, null, 2))
}

export async function findLicenseOrderBySessionId(sessionId: string) {
  const store = await readOrderStore()
  return store.orders.find((order) => order.stripeSessionId === sessionId) || null
}

export async function findLicenseOrdersByEmail(email: string) {
  const normalized = normalizeEmail(email)
  if (!normalized) return []

  const store = await readOrderStore()
  return store.orders
    .filter((order) => normalizeEmail(order.email) === normalized)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export async function findLicenseOrderByKey(licenseKey: string) {
  const clean = licenseKey.trim().toUpperCase()
  if (!clean) return null

  const store = await readOrderStore()
  return store.orders.find((order) => (order.licenseKey || '').toUpperCase() === clean) || null
}

export async function listRecentLicenseOrders(limit = 25) {
  const store = await readOrderStore()
  return [...store.orders]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, Math.max(1, limit))
}

export async function upsertLicenseOrder(order: LicenseOrder) {
  const store = await readOrderStore()
  const index = store.orders.findIndex((item) => item.id === order.id || item.stripeSessionId === order.stripeSessionId)
  if (index === -1) {
    store.orders.push(order)
  } else {
    store.orders[index] = order
  }
  await writeOrderStore(store)
  return order
}

export async function createPendingStripeOrder(input: {
  sessionId: string
  planId: BillingPlanId
  email: string
}) {
  const existing = await findLicenseOrderBySessionId(input.sessionId)
  if (existing) return existing

  const plan = getBillingPlan(input.planId)
  if (!plan) {
    throw new Error('Invalid billing plan.')
  }

  const now = new Date().toISOString()
  const order: LicenseOrder = {
    id: `order_${input.sessionId}`,
    provider: 'stripe',
    status: 'pending',
    planId: plan.id,
    planName: plan.name,
    email: normalizeEmail(input.email),
    licenseKey: null,
    stripeSessionId: input.sessionId,
    stripePaymentIntentId: null,
    stripeCustomerId: null,
    amountTotal: null,
    currency: null,
    customerName: null,
    downloadUrl: getMissionControlDownloadUrl(),
    emailDeliveryStatus: 'pending',
    emailDeliverySentAt: null,
    emailDeliveryError: null,
    createdAt: now,
    updatedAt: now,
    fulfilledAt: null,
    refundedAt: null,
    refundReason: null,
    refundNotes: null,
  }

  await upsertLicenseOrder(order)
  return order
}

export interface StripeCheckoutSessionLike {
  id: string
  payment_status?: string | null
  payment_intent?: string | null
  customer?: string | null
  amount_total?: number | null
  currency?: string | null
  customer_details?: {
    email?: string | null
    name?: string | null
  } | null
  customer_email?: string | null
  metadata?: Record<string, string | undefined> | null
}

export async function fulfillStripeCheckoutSession(session: StripeCheckoutSessionLike) {
  const email = normalizeEmail(session.customer_details?.email || session.customer_email || '')
  if (!email) {
    throw new Error('Stripe checkout session is missing a customer email.')
  }

  const planId = session.metadata?.planId || ''
  const plan = getBillingPlan(planId)
  if (!plan) {
    throw new Error('Stripe checkout session is missing a valid plan.')
  }

  const existing = await findLicenseOrderBySessionId(session.id)
  if (existing?.licenseKey) {
    return existing
  }

  const now = new Date().toISOString()
  const licenseKey = generateLicenseKey(getLicenseSecret())

  const order: LicenseOrder = {
    id: existing?.id || `order_${session.id}`,
    provider: 'stripe',
    status: 'fulfilled',
    planId: plan.id,
    planName: plan.name,
    email,
    licenseKey,
    stripeSessionId: session.id,
    stripePaymentIntentId: session.payment_intent || null,
    stripeCustomerId: session.customer || null,
    amountTotal: session.amount_total ?? null,
    currency: session.currency ?? null,
    customerName: session.customer_details?.name || null,
    downloadUrl: getMissionControlDownloadUrl(),
    emailDeliveryStatus: existing?.emailDeliveryStatus || 'pending',
    emailDeliverySentAt: existing?.emailDeliverySentAt || null,
    emailDeliveryError: existing?.emailDeliveryError || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    fulfilledAt: now,
    refundedAt: existing?.refundedAt || null,
    refundReason: existing?.refundReason || null,
    refundNotes: existing?.refundNotes || null,
  }

  await upsertLicenseOrder(order)
  return order
}

export async function markStripeSessionStatus(
  sessionId: string,
  status: LicenseOrder['status'],
) {
  const existing = await findLicenseOrderBySessionId(sessionId)
  if (!existing) return null

  const updated: LicenseOrder = {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
  }

  await upsertLicenseOrder(updated)
  return updated
}

export async function markLicenseOrderRefunded(
  sessionId: string,
  input: {
    reason?: string | null
    notes?: string | null
  } = {},
) {
  const existing = await findLicenseOrderBySessionId(sessionId)
  if (!existing) return null

  const updated: LicenseOrder = {
    ...existing,
    status: 'refunded',
    refundedAt: new Date().toISOString(),
    refundReason: input.reason?.trim() || null,
    refundNotes: input.notes?.trim() || null,
    updatedAt: new Date().toISOString(),
  }

  await upsertLicenseOrder(updated)
  return updated
}

export async function updateLicenseOrderEmailDelivery(
  sessionId: string,
  input: {
    status: LicenseOrder['emailDeliveryStatus']
    sentAt?: string | null
    error?: string | null
  },
) {
  const existing = await findLicenseOrderBySessionId(sessionId)
  if (!existing) return null

  const updated: LicenseOrder = {
    ...existing,
    emailDeliveryStatus: input.status,
    emailDeliverySentAt: input.sentAt ?? existing.emailDeliverySentAt,
    emailDeliveryError: input.error ?? null,
    updatedAt: new Date().toISOString(),
  }

  await upsertLicenseOrder(updated)
  return updated
}

import { randomUUID } from 'crypto'
import { loadEnvConfig } from '@next/env'

import type { LicenseOrder } from '../src/lib/billing'
import { getBillingPlan, getMissionControlDownloadUrl } from '../src/lib/billing'
import { sendLicenseOrderEmail, verifyLicenseEmailTransport } from '../src/lib/license-email'

loadEnvConfig(process.cwd())

function parseArgs(argv: string[]) {
  const recipient = argv.find((value) => !value.startsWith('--'))?.trim()
  const verifyOnly = argv.includes('--verify-only')
  const planName = getFlagValue(argv, '--plan') || 'Personal'
  const licenseKey = getFlagValue(argv, '--license') || 'MC-TEST0-EMAIL-VERIFY-2026'

  if (!recipient && !verifyOnly) {
    throw new Error('Usage: npm run email:test -- you@example.com [--plan Pro] [--license MC-...] [--verify-only]')
  }

  return {
    recipient: recipient || null,
    verifyOnly,
    planName,
    licenseKey,
  }
}

function getFlagValue(argv: string[], flag: string) {
  const index = argv.indexOf(flag)
  if (index === -1) return null
  return argv[index + 1]?.trim() || null
}

function inferPlanId(planName: string): LicenseOrder['planId'] {
  const normalized = planName.trim().toLowerCase()
  if (normalized === 'team') return 'team'
  if (normalized === 'pro') return 'pro'
  return 'personal'
}

function buildTestOrder(recipient: string, planName: string, licenseKey: string): LicenseOrder {
  const now = new Date().toISOString()
  const planId = inferPlanId(planName)
  const plan = getBillingPlan(planId)
  const updateExpiresAt = new Date()
  updateExpiresAt.setFullYear(updateExpiresAt.getFullYear() + 1)

  return {
    id: `test_${randomUUID()}`,
    provider: 'stripe',
    status: 'fulfilled',
    planId,
    planName,
    machineLimit: plan?.machineLimit || 1,
    updateExpiresAt: updateExpiresAt.toISOString(),
    licenseControlStatus: 'active',
    revokedAt: null,
    revocationReason: null,
    email: recipient,
    licenseKey,
    successAccessToken: null,
    activations: [],
    stripeSessionId: `cs_test_${randomUUID().replace(/-/g, '')}`,
    stripePaymentIntentId: null,
    stripeCustomerId: null,
    amountTotal: null,
    currency: 'usd',
    customerName: 'Mission Control QA',
    downloadUrl: getMissionControlDownloadUrl(),
    emailDeliveryStatus: 'pending',
    emailDeliverySentAt: null,
    emailDeliveryError: null,
    createdAt: now,
    updatedAt: now,
    fulfilledAt: now,
    refundedAt: null,
    refundReason: null,
    refundNotes: null,
  }
}

async function main() {
  const { recipient, verifyOnly, planName, licenseKey } = parseArgs(process.argv.slice(2))

  await verifyLicenseEmailTransport()
  console.log('SMTP connection verified.')

  if (verifyOnly || !recipient) {
    return
  }

  const order = buildTestOrder(recipient, planName, licenseKey)
  const result = await sendLicenseOrderEmail(order)
  console.log(`Sent test license email to ${recipient}.`)
  console.log(`Message ID: ${result.messageId}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

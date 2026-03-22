import nodemailer from 'nodemailer'

import type { LicenseOrder } from '@/lib/billing'

type LicenseEmailConfig = {
  host: string
  port: number
  secure: boolean
  user: string | null
  pass: string | null
  fromEmail: string
  fromName: string
  replyTo: string | null
  supportEmail: string
}

let transporterPromise: ReturnType<typeof nodemailer.createTransport> | null = null

function getEnv(name: string) {
  return (process.env[name] || '').trim()
}

function getEmailConfig(): LicenseEmailConfig {
  const host = getEnv('SMTP_HOST')
  const portValue = getEnv('SMTP_PORT') || '587'
  const fromEmail = getEnv('SMTP_FROM_EMAIL')

  if (!host || !fromEmail) {
    throw new Error('SMTP email delivery is not configured.')
  }

  const port = Number(portValue)
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('SMTP_PORT must be a valid port number.')
  }

  const user = getEnv('SMTP_USER') || null
  const pass = getEnv('SMTP_PASS') || null
  if ((user && !pass) || (!user && pass)) {
    throw new Error('SMTP_USER and SMTP_PASS must either both be set or both be omitted.')
  }

  return {
    host,
    port,
    secure: getEnv('SMTP_SECURE').toLowerCase() === 'true',
    user,
    pass,
    fromEmail,
    fromName: getEnv('SMTP_FROM_NAME') || 'Mission Control',
    replyTo: getEnv('SMTP_REPLY_TO') || null,
    supportEmail: getEnv('MISSION_CONTROL_SUPPORT_EMAIL') || 'support@orqpilot.com',
  }
}

export function isLicenseEmailConfigured() {
  try {
    getEmailConfig()
    return true
  } catch {
    return false
  }
}

function getTransporter() {
  if (transporterPromise) return transporterPromise

  const config = getEmailConfig()
  transporterPromise = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
  })

  return transporterPromise
}

export async function verifyLicenseEmailTransport() {
  const transporter = getTransporter()
  await transporter.verify()
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildLicenseEmail(order: LicenseOrder, config: LicenseEmailConfig) {
  if (!order.licenseKey) {
    throw new Error('Cannot send a license email before fulfillment completes.')
  }

  const downloadUrl = order.downloadUrl || 'https://github.com/Toma505/mission-control/releases/latest'
  const subject = `Your Mission Control ${order.planName} license`
  const supportLine = `Need help? Reply to this email or contact ${config.supportEmail}.`

  const text = [
    `Thanks for purchasing Mission Control ${order.planName}.`,
    '',
    `License key: ${order.licenseKey}`,
    `Plan: ${order.planName}`,
    `Email: ${order.email}`,
    '',
    `Download Mission Control: ${downloadUrl}`,
    '',
    'Keep this key somewhere safe. You will need it to activate the desktop app.',
    supportLine,
  ].join('\n')

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="margin: 0 0 16px;">Your Mission Control license is ready</h2>
      <p style="margin: 0 0 16px;">Thanks for purchasing <strong>Mission Control ${escapeHtml(order.planName)}</strong>.</p>
      <div style="margin: 0 0 16px; padding: 16px; border: 1px solid #d1d5db; border-radius: 12px; background: #f9fafb;">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 8px;">License Key</div>
        <div style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 24px; font-weight: 700;">${escapeHtml(order.licenseKey)}</div>
      </div>
      <p style="margin: 0 0 8px;"><strong>Plan:</strong> ${escapeHtml(order.planName)}</p>
      <p style="margin: 0 0 16px;"><strong>Licensed email:</strong> ${escapeHtml(order.email)}</p>
      <p style="margin: 0 0 16px;"><a href="${escapeHtml(downloadUrl)}">Download Mission Control</a></p>
      <p style="margin: 0 0 8px;">Keep this key somewhere safe. You will need it to activate the desktop app.</p>
      <p style="margin: 0;">${escapeHtml(supportLine)}</p>
    </div>
  `

  return { subject, text, html }
}

export async function sendLicenseOrderEmail(order: LicenseOrder) {
  const config = getEmailConfig()
  const transporter = getTransporter()
  const message = buildLicenseEmail(order, config)

  const info = await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: order.email,
    replyTo: config.replyTo || config.supportEmail,
    subject: message.subject,
    text: message.text,
    html: message.html,
  })

  return {
    messageId: info.messageId,
  }
}

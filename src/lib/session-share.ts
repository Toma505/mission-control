import { randomUUID } from 'crypto'

import type { ChatHistoryMessage } from '@/lib/chat-history'
import type { ReplaySession, ReplayStep } from '@/lib/replay-store'

export type SharedSessionPayload = {
  version: '1'
  exportedAt: string
  source: 'chat' | 'replay'
  session: ReplaySession
}

function summarize(text: string, max = 140) {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= max) return compact
  return `${compact.slice(0, Math.max(max - 3, 1)).trim()}...`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeStep(step: Partial<ReplayStep>, index: number): ReplayStep {
  const now = new Date().toISOString()
  return {
    id: step.id || `step-${index + 1}`,
    title: step.title || `Step ${index + 1}`,
    timestamp: step.timestamp || now,
    input: step.input || '',
    action: step.action || 'Review shared session step',
    result: step.result || '',
    prompt: step.prompt || step.input || '',
    response: step.response || step.result || '',
    toolCalls: Array.isArray(step.toolCalls) ? step.toolCalls : [],
    fileChanges: Array.isArray(step.fileChanges) ? step.fileChanges : [],
  }
}

export function normalizeSharedReplaySession(input: unknown): ReplaySession {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid shared session payload.')
  }

  const candidate = input as Partial<ReplaySession>
  const now = new Date().toISOString()
  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `shared-${randomUUID().slice(0, 8)}`,
    sessionKey: typeof candidate.sessionKey === 'string' && candidate.sessionKey ? candidate.sessionKey : `shared:${randomUUID().slice(0, 8)}`,
    agentId: typeof candidate.agentId === 'string' && candidate.agentId ? candidate.agentId : 'shared-agent',
    instanceId: typeof candidate.instanceId === 'string' && candidate.instanceId ? candidate.instanceId : 'shared',
    model: typeof candidate.model === 'string' && candidate.model ? candidate.model : 'shared-session',
    taskDescription: typeof candidate.taskDescription === 'string' && candidate.taskDescription ? candidate.taskDescription : 'Imported shared session',
    startedAt: typeof candidate.startedAt === 'string' && candidate.startedAt ? candidate.startedAt : now,
    completedAt: typeof candidate.completedAt === 'string' && candidate.completedAt ? candidate.completedAt : now,
    durationMs: typeof candidate.durationMs === 'number' && Number.isFinite(candidate.durationMs) ? candidate.durationMs : 0,
    status: candidate.status === 'failed' || candidate.status === 'running' ? candidate.status : 'completed',
    steps: Array.isArray(candidate.steps) ? candidate.steps.map(normalizeStep) : [],
  }
}

export function buildReplaySessionFromChatSession({
  sessionKey,
  agentId,
  messages,
}: {
  sessionKey: string
  agentId: string
  messages: ChatHistoryMessage[]
}): ReplaySession {
  const now = new Date()
  const steps: ReplayStep[] = []
  let pendingUser: ChatHistoryMessage | null = null

  messages.forEach((message, index) => {
    if (message.role === 'user') {
      pendingUser = message
      return
    }

    if (pendingUser) {
      const userMessage = pendingUser
      steps.push({
        id: `step-${steps.length + 1}`,
        title: `Conversation turn ${steps.length + 1}`,
        timestamp: message.timestamp || userMessage.timestamp || new Date(now.getTime() + index * 15_000).toISOString(),
        input: userMessage.content,
        action: message.role === 'assistant' ? `Generate reply for ${agentId}` : 'Update system context',
        result: summarize(message.content, 180),
        prompt: userMessage.content,
        response: message.content,
        toolCalls: [],
        fileChanges: [],
      })
      pendingUser = null
      return
    }

    steps.push({
      id: `step-${steps.length + 1}`,
      title: message.role === 'system' ? 'System context' : `Conversation turn ${steps.length + 1}`,
      timestamp: message.timestamp || new Date(now.getTime() + index * 15_000).toISOString(),
      input: message.role === 'system' ? message.content : 'Conversation context',
      action: message.role === 'system' ? 'Load context' : `Emit reply for ${agentId}`,
      result: summarize(message.content, 180),
      prompt: message.role === 'system' ? message.content : '',
      response: message.content,
      toolCalls: [],
      fileChanges: [],
    })
  })

  if (pendingUser) {
    const userMessage = pendingUser as ChatHistoryMessage
    steps.push({
      id: `step-${steps.length + 1}`,
      title: `Conversation turn ${steps.length + 1}`,
      timestamp: userMessage.timestamp || new Date(now.getTime() + messages.length * 15_000).toISOString(),
      input: userMessage.content,
      action: `Await reply from ${agentId}`,
      result: 'Session was shared before the next reply arrived.',
      prompt: userMessage.content,
      response: '',
      toolCalls: [],
      fileChanges: [],
    })
  }

  const firstUserMessage = messages.find((message) => message.role === 'user')?.content
  const startedAt = messages[0]?.timestamp || now.toISOString()
  const completedAt = messages.at(-1)?.timestamp || new Date(new Date(startedAt).getTime() + steps.length * 15_000).toISOString()

  return {
    id: `shared-${randomUUID().slice(0, 8)}`,
    sessionKey,
    agentId,
    instanceId: 'shared',
    model: 'chat-session',
    taskDescription: summarize(firstUserMessage || `Shared session from ${agentId}`, 96),
    startedAt,
    completedAt,
    durationMs: Math.max(steps.length, 1) * 15_000,
    status: 'completed',
    steps,
  }
}

export function buildSharedSessionPayload(source: 'chat' | 'replay', session: ReplaySession): SharedSessionPayload {
  return {
    version: '1',
    exportedAt: new Date().toISOString(),
    source,
    session,
  }
}

export function parseSharedSessionContent(raw: string) {
  try {
    const parsed = JSON.parse(raw) as Partial<SharedSessionPayload> | ReplaySession
    if ('session' in parsed && parsed.session) {
      return normalizeSharedReplaySession(parsed.session)
    }
    return normalizeSharedReplaySession(parsed)
  } catch {
    const match = raw.match(/<script id="mission-control-session" type="application\/json">([\s\S]*?)<\/script>/i)
    if (!match) {
      throw new Error('Unsupported shared session format.')
    }
    const payload = JSON.parse(match[1]) as SharedSessionPayload
    return normalizeSharedReplaySession(payload.session)
  }
}

export function createDownloadName(session: ReplaySession, extension: 'json' | 'html') {
  const base = `${session.agentId || 'session'}-${session.sessionKey || session.id}`
    .replace(/[^a-z0-9-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `${base || 'mission-control-session'}.${extension}`
}

export function renderSharedSessionHtml(payload: SharedSessionPayload) {
  const { session } = payload
  const steps = session.steps
    .map((step, index) => {
      return `
        <section class="step">
          <div class="meta">Step ${index + 1} - ${escapeHtml(step.timestamp)}</div>
          <h3>${escapeHtml(step.title)}</h3>
          <div class="grid">
            <div class="card">
              <h4>Input</h4>
              <pre>${escapeHtml(step.input)}</pre>
            </div>
            <div class="card">
              <h4>Action</h4>
              <pre>${escapeHtml(step.action)}</pre>
            </div>
            <div class="card">
              <h4>Result</h4>
              <pre>${escapeHtml(step.result)}</pre>
            </div>
          </div>
        </section>
      `
    })
    .join('\n')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(session.taskDescription)} - Mission Control Share</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #08090d; color: #f3f5f7; }
      main { max-width: 1100px; margin: 0 auto; padding: 48px 24px 72px; }
      .hero, .step, .card { border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); backdrop-filter: blur(14px); }
      .hero { border-radius: 28px; padding: 28px; margin-bottom: 22px; }
      .hero p { color: rgba(243,245,247,.72); line-height: 1.6; }
      .hero-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 18px; }
      .pill { border-radius: 999px; padding: 6px 10px; display: inline-block; background: rgba(96,165,250,.16); color: #bfdbfe; font-size: 12px; }
      .step { border-radius: 24px; padding: 22px; margin-top: 18px; }
      .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-top: 16px; }
      .card { border-radius: 18px; padding: 16px; }
      .meta { color: rgba(243,245,247,.55); font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }
      h1, h2, h3, h4 { margin: 0; }
      h1 { font-size: 30px; margin-top: 14px; }
      h3 { margin-top: 10px; font-size: 20px; }
      h4 { color: rgba(243,245,247,.72); font-size: 12px; text-transform: uppercase; letter-spacing: .14em; margin-bottom: 10px; }
      pre { white-space: pre-wrap; margin: 0; font-family: ui-monospace, SFMono-Regular, monospace; line-height: 1.55; color: #f8fafc; }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <span class="pill">Mission Control session share</span>
        <h1>${escapeHtml(session.taskDescription)}</h1>
        <p>This file can be imported into Mission Control Replay to inspect the full timeline again.</p>
        <div class="hero-grid">
          <div class="card"><h4>Agent</h4><pre>${escapeHtml(session.agentId)}</pre></div>
          <div class="card"><h4>Instance</h4><pre>${escapeHtml(session.instanceId)}</pre></div>
          <div class="card"><h4>Model</h4><pre>${escapeHtml(session.model)}</pre></div>
          <div class="card"><h4>Session key</h4><pre>${escapeHtml(session.sessionKey)}</pre></div>
        </div>
      </section>
      ${steps}
    </main>
    <script id="mission-control-session" type="application/json">${escapeHtml(JSON.stringify(payload))}</script>
  </body>
</html>`
}

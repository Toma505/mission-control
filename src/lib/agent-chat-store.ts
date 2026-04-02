import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

import { DATA_DIR } from '@/lib/connection-config'

export type AgentChatParticipant = {
  agentId: string
  instanceId: string
}

export type AgentChatMessage = {
  id: string
  author: 'system' | 'human' | 'agentA' | 'agentB'
  content: string
  createdAt: string
}

export type AgentConversation = {
  id: string
  goal: string
  status: 'active' | 'completed'
  createdAt: string
  updatedAt: string
  nextSpeaker: 'agentA' | 'agentB'
  agentA: AgentChatParticipant
  agentB: AgentChatParticipant
  messages: AgentChatMessage[]
}

type AgentChatStore = {
  conversations: AgentConversation[]
}

const AGENT_CHATS_FILE = path.join(DATA_DIR, 'agent-chats.json')
const DEFAULT_AGENT_CHATS_FILE = path.join(process.cwd(), 'data', 'agent-chats.json')

function nowIso() {
  return new Date().toISOString()
}

async function readSeedStore(): Promise<AgentChatStore> {
  try {
    const raw = await readFile(DEFAULT_AGENT_CHATS_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as AgentChatStore
    return {
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
    }
  } catch {
    return { conversations: [] }
  }
}

export async function readAgentChatStore(): Promise<AgentChatStore> {
  try {
    const raw = await readFile(AGENT_CHATS_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as AgentChatStore
    return {
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
    }
  } catch {
    return readSeedStore()
  }
}

async function writeAgentChatStore(store: AgentChatStore) {
  await mkdir(path.dirname(AGENT_CHATS_FILE), { recursive: true })
  await writeFile(AGENT_CHATS_FILE, JSON.stringify(store, null, 2))
}

function buildAgentVoice(agentId: string) {
  const value = agentId.toLowerCase()
  if (value.includes('scout') || value.includes('research')) {
    return 'Focus on discovery, evidence, and open questions.'
  }
  if (value.includes('editor') || value.includes('writer') || value.includes('content')) {
    return 'Focus on structure, clarity, and turning rough ideas into deliverables.'
  }
  if (value.includes('ops') || value.includes('triage')) {
    return 'Focus on operational risk, blockers, and concrete next actions.'
  }
  return 'Focus on moving the shared goal forward with one clear contribution at a time.'
}

function buildReply({
  speaker,
  other,
  goal,
  context,
}: {
  speaker: AgentChatParticipant
  other: AgentChatParticipant
  goal: string
  context: string
}) {
  const voice = buildAgentVoice(speaker.agentId)
  const leading = `${speaker.agentId} @ ${speaker.instanceId}`
  const contextLine = context ? `Latest context: ${context}` : `Goal: ${goal}`

  if (speaker.agentId.toLowerCase().includes('scout') || speaker.agentId.toLowerCase().includes('research')) {
    return `${leading}: I'm taking the discovery pass. ${contextLine}\n\n- What we know: ${goal}\n- What I want ${other.agentId} to refine next: turn the strongest lead into something we can ship\n- My current recommendation: keep the scope narrow and validate one concrete outcome first.`
  }

  if (speaker.agentId.toLowerCase().includes('editor') || speaker.agentId.toLowerCase().includes('writer')) {
    return `${leading}: I'm translating that into a tighter deliverable. ${contextLine}\n\n- Proposed structure: a short summary, a focused execution plan, and one clear follow-up\n- Tension I see: we should cut anything that doesn't directly help the shared goal\n- Handoff back to ${other.agentId}: confirm the riskiest assumption so I can sharpen the final output.`
  }

  if (speaker.agentId.toLowerCase().includes('ops') || speaker.agentId.toLowerCase().includes('triage')) {
    return `${leading}: I'm looking at execution risk. ${contextLine}\n\n- Operational blocker: anything ambiguous here will slow the handoff\n- Suggested next move: make the next step explicit and observable\n- Ask for ${other.agentId}: respond with the exact action you want the operator to take.`
  }

  return `${leading}: ${voice}\n\n${contextLine}\n\nMy contribution is to move this toward a single next action for ${other.agentId} to react to.`
}

function createMessage(author: AgentChatMessage['author'], content: string): AgentChatMessage {
  return {
    id: randomUUID(),
    author,
    content,
    createdAt: nowIso(),
  }
}

function lastNonSystemMessage(conversation: AgentConversation) {
  return [...conversation.messages].reverse().find((message) => message.author !== 'system')
}

function appendAgentTurn(conversation: AgentConversation) {
  const speakerKey = conversation.nextSpeaker
  const listenerKey = speakerKey === 'agentA' ? 'agentB' : 'agentA'
  const speaker = conversation[speakerKey]
  const other = conversation[listenerKey]
  const context = lastNonSystemMessage(conversation)?.content || conversation.goal

  conversation.messages.push(
    createMessage(speakerKey, buildReply({ speaker, other, goal: conversation.goal, context })),
  )
  conversation.nextSpeaker = listenerKey
  conversation.updatedAt = nowIso()
}

export async function listAgentConversations() {
  const store = await readAgentChatStore()
  return [...store.conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export async function createAgentConversation(input: {
  goal: string
  agentA: AgentChatParticipant
  agentB: AgentChatParticipant
}) {
  const store = await readAgentChatStore()
  const createdAt = nowIso()
  const conversation: AgentConversation = {
    id: `conversation-${randomUUID().slice(0, 8)}`,
    goal: input.goal,
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    nextSpeaker: 'agentA',
    agentA: input.agentA,
    agentB: input.agentB,
    messages: [
      createMessage(
        'system',
        `Shared goal: ${input.goal}\n\n${input.agentA.agentId} on ${input.agentA.instanceId} will start, then ${input.agentB.agentId} on ${input.agentB.instanceId} will respond.`,
      ),
    ],
  }

  appendAgentTurn(conversation)
  appendAgentTurn(conversation)

  store.conversations = [conversation, ...store.conversations]
  await writeAgentChatStore(store)
  return conversation
}

export async function continueAgentConversation(conversationId: string) {
  const store = await readAgentChatStore()
  const conversation = store.conversations.find((entry) => entry.id === conversationId)
  if (!conversation) return null

  appendAgentTurn(conversation)
  await writeAgentChatStore(store)
  return conversation
}

export async function interveneAgentConversation(conversationId: string, message: string) {
  const store = await readAgentChatStore()
  const conversation = store.conversations.find((entry) => entry.id === conversationId)
  if (!conversation) return null

  conversation.messages.push(createMessage('human', message))
  appendAgentTurn(conversation)
  await writeAgentChatStore(store)
  return conversation
}

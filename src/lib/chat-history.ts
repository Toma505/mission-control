export type SessionInfo = {
  key: string
  agent: string
  age: string
  status: string
}

export type ChatHistoryMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
}

export const DEMO_SESSIONS: SessionInfo[] = [
  { key: 'agent:default:main', agent: 'default', age: '2h ago', status: 'active' },
  { key: 'agent:scout:research', agent: 'scout', age: '5h ago', status: 'idle' },
]

export const DEMO_HISTORY: Record<string, ChatHistoryMessage[]> = {
  'agent:default:main': [
    { role: 'user', content: "Research trending AI topics for this week's video" },
    {
      role: 'assistant',
      content: "I found 5 trending topics:\n\n1. **Claude 4 release** - Anthropic's latest model with extended thinking\n2. **OpenAI Codex CLI** - New terminal-based coding agent\n3. **Google Gemini 2.5 Flash** - Fast and cheap multimodal model\n4. **Local LLMs hitting GPT-4 level** - Llama 3.3 benchmarks\n5. **AI agent frameworks** - CrewAI vs LangGraph comparison\n\nShall I draft outlines for any of these?",
    },
    { role: 'user', content: 'Draft an outline for topic 1' },
    {
      role: 'assistant',
      content: "Here's a script outline for 'Claude 4 Release':\n\n**Hook:** \"Anthropic just mass-deployed a model that thinks before it speaks\"\n\n**Section 1: What changed**\n- Extended thinking (chain-of-thought visible)\n- 200k context window\n- Tool use improvements\n\n**Section 2: Real-world testing**\n- Coding benchmarks vs GPT-4o\n- Cost comparison ($3/MTok vs $15/MTok)\n- Speed test results\n\n**Section 3: Who should switch**\n- Best for: complex reasoning, long documents\n- Skip if: simple tasks, budget-constrained\n\n**CTA:** Link to OpenRouter for testing",
    },
  ],
}

export const DEMO_SESSION_KEYS = new Set([
  ...DEMO_SESSIONS.map((session) => session.key),
  ...Object.keys(DEMO_HISTORY),
])

export function getAgentIdFromSessionKey(sessionKey: string, fallback = 'default') {
  const match = sessionKey.match(/^agent:([^:]+)/)
  return match?.[1] || fallback
}

export function parseSessionList(raw: string): SessionInfo[] {
  const sessions: SessionInfo[] = []

  const rowPattern = /(?:│|â”‚)\s*(\S+)\s*(?:│|â”‚)\s*(\S+)\s*(?:│|â”‚)\s*(.+?)\s*(?:│|â”‚)\s*(\S+)\s*(?:│|â”‚)/g
  let rowMatch
  while ((rowMatch = rowPattern.exec(raw)) !== null) {
    if (rowMatch[1] === 'key' || rowMatch[1] === 'â”€') continue
    sessions.push({
      key: rowMatch[1],
      agent: rowMatch[2],
      age: rowMatch[3].trim(),
      status: rowMatch[4],
    })
  }
  if (sessions.length > 0) return sessions

  const listRegex = /(?:-|•|â€¢)\s*(\S+)\s*\((?:agent:\s*)?(\S+?)(?:,\s*(.+?))?\)/g
  let match
  while ((match = listRegex.exec(raw)) !== null) {
    sessions.push({
      key: match[1],
      agent: match[2],
      age: match[3] || '',
      status: 'active',
    })
  }

  if (sessions.length === 0) {
    const lines = raw
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('â”€') && !line.startsWith('='))
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('Sessions') && !trimmed.startsWith('No ')) {
        sessions.push({
          key: trimmed.split(/\s+/)[0] || trimmed,
          agent: getAgentIdFromSessionKey(trimmed, 'unknown'),
          age: '',
          status: 'active',
        })
      }
    }
  }

  return sessions
}

export function parseMessages(raw: string): ChatHistoryMessage[] {
  const messages: ChatHistoryMessage[] = []
  const messageRegex = /(?:\[(.+?)\]\s*)?(user|human|assistant|agent|system|bot):\s*(.+)/gi
  let match

  while ((match = messageRegex.exec(raw)) !== null) {
    const roleName = match[2].toLowerCase()
    const role: ChatHistoryMessage['role'] =
      roleName === 'user' || roleName === 'human'
        ? 'user'
        : roleName === 'system'
          ? 'system'
          : 'assistant'

    messages.push({
      role,
      content: match[3].trim(),
      timestamp: match[1] || undefined,
    })
  }

  if (messages.length === 0 && raw.trim()) {
    messages.push({
      role: 'system',
      content: raw.trim(),
    })
  }

  return messages
}

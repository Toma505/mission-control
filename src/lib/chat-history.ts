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

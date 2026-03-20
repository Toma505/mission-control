'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Send,
  Bot,
  User,
  Loader2,
  RefreshCw,
  MessageSquare,
  AlertCircle,
  ChevronDown,
  Terminal,
  Zap,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { COMMANDS, getCommandSuggestions, type Command } from '@/lib/commands'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'command'
  content: string
  timestamp?: string
  pending?: boolean
  commandResult?: {
    ok: boolean
    commandName?: string
  }
}

interface SessionInfo {
  key: string
  agent: string
  age: string
  status: string
}

const CATEGORY_ICONS: Record<string, string> = {
  mode: '🎛',
  agent: '🤖',
  cost: '💰',
  system: '⚙️',
  pipeline: '▶️',
}

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [activeSession, setActiveSession] = useState<string>('')
  const [sessionDropdownOpen, setSessionDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [polling, setPolling] = useState(false)
  const [suggestions, setSuggestions] = useState<Command[]>([])
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const activeSessionRef = useRef<string>('')

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load sessions
  useEffect(() => {
    loadSessions()
  }, [])

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Keep ref in sync so async callbacks can check the current session
  useEffect(() => {
    activeSessionRef.current = activeSession
  }, [activeSession])

  // Poll for new messages when we have an active session
  useEffect(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    // Clear any pending delayed history loads from previous session
    for (const t of pendingTimersRef.current) clearTimeout(t)
    pendingTimersRef.current = []

    if (activeSession) {
      pollTimerRef.current = setInterval(() => {
        loadHistory(activeSession, true)
      }, 5000)
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      for (const t of pendingTimersRef.current) clearTimeout(t)
      pendingTimersRef.current = []
    }
  }, [activeSession])

  // Update command suggestions as user types
  useEffect(() => {
    if (input.startsWith('/')) {
      const matches = getCommandSuggestions(input)
      setSuggestions(matches)
      setSelectedSuggestion(0)
    } else {
      setSuggestions([])
    }
  }, [input])

  async function loadSessions() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/chat?action=sessions')
      const data = await res.json()

      if (data.error) {
        setError(data.error)
        return
      }

      setSessions(data.sessions || [])

      if (data.sessions?.length > 0) {
        const mainSession = data.sessions.find((s: SessionInfo) => s.key === 'main') || data.sessions[0]
        setActiveSession(mainSession.key)
        loadHistory(mainSession.key)
      }
    } catch {
      setError('Could not connect to OpenClaw. Check your connection settings.')
    } finally {
      setLoading(false)
    }
  }

  async function loadHistory(sessionKey: string, silent = false) {
    if (!silent) setPolling(true)
    try {
      const res = await fetch(`/api/chat?action=history&session=${encodeURIComponent(sessionKey)}`)
      const data = await res.json()

      // Ignore response if user has switched sessions since this request started
      if (activeSessionRef.current !== sessionKey) return

      if (data.messages?.length > 0) {
        setMessages(prev => {
          const prevNonPending = prev.filter(m => !m.pending)
          if (data.messages.length !== prevNonPending.length) {
            return data.messages.map((m: ChatMessage, i: number) => ({
              ...m,
              id: `${sessionKey}-${i}`,
            }))
          }
          return prev
        })
      }
    } catch {
      // Silent poll failure
    } finally {
      if (!silent) setPolling(false)
    }
  }

  async function executeCommand(content: string) {
    setSending(true)
    setError('')

    // Show the command as a user message
    const userMsg: ChatMessage = {
      id: `cmd-user-${Date.now()}`,
      role: 'user',
      content,
    }
    const pendingMsg: ChatMessage = {
      id: `cmd-pending-${Date.now()}`,
      role: 'command',
      content: '',
      pending: true,
    }
    setMessages(prev => [...prev, userMsg, pendingMsg])

    try {
      const res = await apiFetch('/api/chat/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: content }),
      })
      const data = await res.json()

      if (!data.isCommand) {
        // Not recognized as a command — fall back to regular chat send
        setMessages(prev => prev.filter(m => m.id !== pendingMsg.id))
        await sendToAgent(content, userMsg.id)
        return
      }

      setMessages(prev => prev.map(m =>
        m.id === pendingMsg.id
          ? {
              ...m,
              content: data.message || (data.ok ? 'Done.' : 'Command failed.'),
              pending: false,
              commandResult: { ok: data.ok, commandName: data.commandName },
            }
          : m
      ))
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === pendingMsg.id
          ? {
              ...m,
              content: 'Command execution failed.',
              pending: false,
              commandResult: { ok: false },
            }
          : m
      ))
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  async function sendToAgent(content: string, existingUserMsgId?: string) {
    const pendingMsg: ChatMessage = {
      id: `pending-${Date.now()}`,
      role: 'assistant',
      content: '',
      pending: true,
    }

    if (existingUserMsgId) {
      setMessages(prev => [...prev, pendingMsg])
    } else {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
      }
      setMessages(prev => [...prev, userMsg, pendingMsg])
    }

    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          message: content,
          session: activeSession || 'main',
        }),
      })

      const data = await res.json()

      if (!data.ok) {
        setMessages(prev => prev.filter(m => m.id !== pendingMsg.id))
        setError(data.error || 'Failed to send message')
        return
      }

      if (data.output) {
        setMessages(prev => prev.map(m =>
          m.id === pendingMsg.id
            ? { ...m, content: data.output, pending: false }
            : m
        ))
      } else {
        setMessages(prev => prev.map(m =>
          m.id === pendingMsg.id
            ? { ...m, content: 'Processing...', pending: true }
            : m
        ))
        const session = activeSession
        const t1 = setTimeout(() => loadHistory(session, true), 2000)
        const t2 = setTimeout(() => loadHistory(session, true), 5000)
        const t3 = setTimeout(() => loadHistory(session, true), 10000)
        pendingTimersRef.current.push(t1, t2, t3)
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== pendingMsg.id))
      setError('Could not reach OpenClaw. Check your connection.')
    }
  }

  async function sendMessage() {
    if (!input.trim() || sending) return

    const content = input.trim()
    setInput('')
    setSuggestions([])

    // Only route explicit slash commands to the command engine.
    // Natural language is always sent to the agent to avoid accidental mutations.
    if (content.startsWith('/')) {
      await executeCommand(content)
    } else {
      setSending(true)
      setError('')
      await sendToAgent(content)
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function applySuggestion(cmd: Command) {
    setInput(cmd.aliases[0] + ' ')
    setSuggestions([])
    inputRef.current?.focus()
  }

  function selectSession(key: string) {
    setActiveSession(key)
    setMessages([])
    setSessionDropdownOpen(false)
    loadHistory(key)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Handle suggestion navigation
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedSuggestion(prev => Math.min(prev + 1, suggestions.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedSuggestion(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && suggestions.length > 0 && input.endsWith(suggestions[selectedSuggestion]?.aliases[0]?.slice(0, input.length) || ''))) {
        // Only Tab-complete if we're still typing the command name (no space yet)
        if (!input.includes(' ') && e.key === 'Tab') {
          e.preventDefault()
          applySuggestion(suggestions[selectedSuggestion])
          return
        }
      }
      if (e.key === 'Escape') {
        setSuggestions([])
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  /** Safely render inline markdown (bold + code) as React elements, no innerHTML */
  function renderInlineMarkdown(text: string, keyPrefix: string): React.ReactNode {
    // Split on **bold** and `code` patterns, return React elements
    const parts: React.ReactNode[] = []
    let remaining = text
    let partIdx = 0

    while (remaining.length > 0) {
      // Find the earliest match of **bold** or `code`
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
      const codeMatch = remaining.match(/`(.+?)`/)

      const boldIdx = boldMatch?.index ?? Infinity
      const codeIdx = codeMatch?.index ?? Infinity

      if (boldIdx === Infinity && codeIdx === Infinity) {
        // No more patterns — push remaining text
        parts.push(remaining)
        break
      }

      if (boldIdx <= codeIdx && boldMatch) {
        // Bold comes first
        if (boldIdx > 0) parts.push(remaining.slice(0, boldIdx))
        parts.push(<strong key={`${keyPrefix}-b-${partIdx++}`}>{boldMatch[1]}</strong>)
        remaining = remaining.slice(boldIdx + boldMatch[0].length)
      } else if (codeMatch) {
        // Code comes first
        if (codeIdx > 0) parts.push(remaining.slice(0, codeIdx))
        parts.push(
          <code key={`${keyPrefix}-c-${partIdx++}`} className="px-1 py-0.5 rounded bg-white/[0.06] text-[11px] font-mono">
            {codeMatch[1]}
          </code>
        )
        remaining = remaining.slice(codeIdx + codeMatch[0].length)
      }
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>
  }

  function renderMessageContent(msg: ChatMessage) {
    if (msg.pending) {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted" />
          <span className="text-text-muted">
            {msg.role === 'command' ? 'Executing command...' : 'Thinking...'}
          </span>
        </div>
      )
    }

    // Render markdown-like content safely (no dangerouslySetInnerHTML)
    const content = msg.content
    const lines = content.split('\n')
    const elements: React.ReactNode[] = []
    let inCodeBlock = false
    let codeLines: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${i}`} className="my-1.5 p-2.5 rounded-lg bg-black/20 text-[11px] font-mono overflow-x-auto text-text-secondary">
              {codeLines.join('\n')}
            </pre>
          )
          codeLines = []
          inCodeBlock = false
        } else {
          inCodeBlock = true
        }
        continue
      }

      if (inCodeBlock) {
        codeLines.push(line)
        continue
      }

      if (line.startsWith('• ') || line.startsWith('- ')) {
        elements.push(
          <div key={i} className="flex gap-1.5 ml-1">
            <span className="text-text-muted shrink-0">•</span>
            <span>{renderInlineMarkdown(line.replace(/^[•-]\s*/, ''), `li-${i}`)}</span>
          </div>
        )
      } else if (line.trim()) {
        elements.push(<div key={i}>{renderInlineMarkdown(line, `ln-${i}`)}</div>)
      } else {
        elements.push(<div key={i} className="h-1" />)
      }
    }

    // Close unclosed code block
    if (inCodeBlock && codeLines.length > 0) {
      elements.push(
        <pre key="code-end" className="my-1.5 p-2.5 rounded-lg bg-black/20 text-[11px] font-mono overflow-x-auto text-text-secondary">
          {codeLines.join('\n')}
        </pre>
      )
    }

    return <div className="space-y-0.5">{elements}</div>
  }

  // ─── Loading state ─────────────────────────────────────
  if (loading) {
    return (
      <div className="glass rounded-2xl h-[calc(100vh-12rem)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-accent-primary mx-auto animate-spin" />
          <p className="text-sm text-text-muted">Connecting to your agent...</p>
        </div>
      </div>
    )
  }

  // ─── Error / not connected state ───────────────────────
  if (error && sessions.length === 0) {
    return (
      <div className="glass rounded-2xl h-[calc(100vh-12rem)] flex items-center justify-center">
        <div className="text-center space-y-3 max-w-sm">
          <AlertCircle className="w-8 h-8 text-text-muted mx-auto" />
          <p className="text-sm text-text-secondary">{error}</p>
          <button
            onClick={loadSessions}
            className="px-4 py-2 rounded-lg bg-accent-primary text-white text-sm font-medium hover:bg-accent-primary/80 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  // ─── Main chat UI ──────────────────────────────────────
  return (
    <div className="glass rounded-2xl h-[calc(100vh-12rem)] flex flex-col overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-accent-primary/10">
            <Bot className="w-5 h-5 text-accent-primary" />
          </div>
          <div>
            {/* Session selector */}
            <div className="relative">
              <button
                onClick={() => setSessionDropdownOpen(!sessionDropdownOpen)}
                className="flex items-center gap-1.5 text-sm font-medium text-text-primary hover:text-accent-primary transition-colors"
              >
                {activeSession || 'Select session'}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sessionDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {sessionDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 glass rounded-xl border border-white/[0.08] shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
                  {sessions.map(s => (
                    <button
                      key={s.key}
                      onClick={() => selectSession(s.key)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.06] ${
                        s.key === activeSession ? 'text-accent-primary bg-accent-primary/5' : 'text-text-primary'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{s.key}</span>
                        <span className={`w-2 h-2 rounded-full ${
                          s.status === 'active' ? 'bg-status-active' : 'bg-text-muted'
                        }`} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-text-muted">{s.agent}</span>
                        {s.age && <span className="text-xs text-text-muted">{s.age}</span>}
                      </div>
                    </button>
                  ))}
                  {sessions.length === 0 && (
                    <p className="px-4 py-3 text-xs text-text-muted">No active sessions</p>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-text-muted">
              {sessions.find(s => s.key === activeSession)?.agent || 'Agent'}
              <span className="inline-flex items-center gap-1 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-pulse" />
                Online
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCommandPalette(!showCommandPalette)}
            className={`p-2 rounded-lg transition-colors ${
              showCommandPalette ? 'bg-accent-primary/10 text-accent-primary' : 'hover:bg-white/[0.06] text-text-muted'
            }`}
            title="Command palette"
          >
            <Terminal className="w-4 h-4" />
          </button>
          <button
            onClick={() => loadHistory(activeSession)}
            className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
            title="Refresh history"
          >
            <RefreshCw className={`w-4 h-4 text-text-muted ${polling ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Command palette panel */}
      {showCommandPalette && (
        <div className="px-5 py-3 border-b border-white/[0.06] bg-background-elevated/50">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-accent-primary" />
            <span className="text-xs font-medium text-text-primary">Quick Commands</span>
            <span className="text-[10px] text-text-muted ml-auto">Type / in chat or click below</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COMMANDS.filter(c => c.id !== 'run-command').map(cmd => (
              <button
                key={cmd.id}
                onClick={() => {
                  setInput(cmd.aliases[0] + ' ')
                  setShowCommandPalette(false)
                  inputRef.current?.focus()
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-text-secondary hover:bg-white/[0.08] hover:text-text-primary transition-colors"
              >
                <span>{CATEGORY_ICONS[cmd.category] || '▶️'}</span>
                <span className="font-mono text-[11px]">{cmd.aliases[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && !error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3 max-w-sm">
              <MessageSquare className="w-12 h-12 text-text-muted/40 mx-auto" />
              <p className="text-sm text-text-secondary">Start a conversation with your agent</p>
              <p className="text-xs text-text-muted">
                Messages go directly to your OpenClaw instance. Type <span className="font-mono bg-white/[0.06] px-1.5 py-0.5 rounded">/</span> for commands, or chat naturally — Mission Control understands both.
              </p>
              <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                {['/status', '/costs', '/health', '/sessions'].map(cmd => (
                  <button
                    key={cmd}
                    onClick={() => { setInput(cmd); inputRef.current?.focus() }}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[11px] font-mono text-text-muted hover:text-accent-primary hover:border-accent-primary/30 transition-colors"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
              msg.role === 'user'
                ? 'bg-accent-primary/10'
                : msg.role === 'system'
                ? 'bg-amber-400/10'
                : msg.role === 'command'
                ? 'bg-violet-400/10'
                : 'bg-emerald-400/10'
            }`}>
              {msg.role === 'user' ? (
                <User className="w-4 h-4 text-accent-primary" />
              ) : msg.role === 'system' ? (
                <AlertCircle className="w-4 h-4 text-amber-400" />
              ) : msg.role === 'command' ? (
                <Terminal className="w-4 h-4 text-violet-400" />
              ) : (
                <Bot className="w-4 h-4 text-emerald-400" />
              )}
            </div>

            {/* Message bubble */}
            <div className={`max-w-[75%] ${msg.role === 'user' ? 'text-right' : ''}`}>
              {/* Command result header */}
              {msg.role === 'command' && msg.commandResult && !msg.pending && (
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  {msg.commandResult.ok
                    ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    : <XCircle className="w-3 h-3 text-red-400" />}
                  <span className="text-[10px] font-medium text-text-muted">
                    {msg.commandResult.commandName || 'Command'}
                  </span>
                </div>
              )}
              <div
                className={`inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-accent-primary text-white rounded-br-md'
                    : msg.role === 'system'
                    ? 'bg-amber-400/10 text-text-secondary border border-amber-400/20 rounded-bl-md'
                    : msg.role === 'command'
                    ? 'bg-violet-400/5 text-text-primary border border-violet-400/15 rounded-bl-md'
                    : 'bg-background-elevated text-text-primary rounded-bl-md'
                } ${msg.pending ? 'animate-pulse' : ''}`}
              >
                {renderMessageContent(msg)}
              </div>
              {msg.timestamp && (
                <p className="text-[10px] text-text-muted mt-1 px-1">{msg.timestamp}</p>
              )}
            </div>
          </div>
        ))}

        {error && messages.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-400/10 border border-red-400/20 text-xs text-red-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Command autocomplete */}
      {suggestions.length > 0 && (
        <div className="px-5 pb-1">
          <div className="rounded-xl border border-white/[0.08] bg-background-elevated shadow-xl overflow-hidden">
            {suggestions.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => applySuggestion(cmd)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                  i === selectedSuggestion
                    ? 'bg-accent-primary/10 text-text-primary'
                    : 'text-text-secondary hover:bg-white/[0.04]'
                }`}
              >
                <span className="text-base">{CATEGORY_ICONS[cmd.category] || '▶️'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-accent-primary">{cmd.aliases[0]}</span>
                    <span className="text-xs text-text-muted">{cmd.name}</span>
                  </div>
                  <p className="text-[11px] text-text-muted truncate">{cmd.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-5 py-3 border-t border-white/[0.06]">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message your agent or type / for commands..."
              rows={1}
              className={`w-full border rounded-xl px-4 py-3 pr-12 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none resize-none max-h-32 overflow-y-auto ${
                input.startsWith('/')
                  ? 'bg-violet-400/[0.03] border-violet-400/20 focus:border-violet-400/40'
                  : 'bg-white/[0.04] border-white/[0.08] focus:border-accent-primary/50'
              }`}
              style={{ minHeight: '44px' }}
              onInput={e => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 128) + 'px'
              }}
            />
            {input.startsWith('/') && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Terminal className="w-4 h-4 text-violet-400" />
              </div>
            )}
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className={`p-3 rounded-xl transition-all ${
              input.trim() && !sending
                ? input.startsWith('/')
                  ? 'bg-violet-500 text-white hover:bg-violet-500/80 shadow-lg shadow-violet-500/20'
                  : 'bg-accent-primary text-white hover:bg-accent-primary/80 shadow-lg shadow-accent-primary/20'
                : 'bg-white/[0.04] text-text-muted cursor-not-allowed'
            }`}
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : input.startsWith('/') ? (
              <Terminal className="w-5 h-5" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-text-muted mt-2 px-1">
          Enter to send, Shift+Enter for new line. Type <span className="font-mono">/</span> for commands, or speak naturally — &quot;switch to budget mode&quot; works too.
        </p>
      </div>
    </div>
  )
}

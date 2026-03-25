'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bot,
  User,
  Terminal,
  Clock,
  MessageSquare,
  Search,
  ChevronRight,
  RefreshCw,
  Filter,
  Zap,
  Hash,
  ArrowDown,
} from 'lucide-react'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
}

interface SessionInfo {
  key: string
  agent: string
  age: string
  status: string
}

interface SessionWithMessages extends SessionInfo {
  messages: Message[]
  loaded: boolean
  loading: boolean
  tokenEstimate: number
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4)
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-amber-400/30 text-amber-200 rounded px-0.5">{part}</mark>
      : part
  )
}

const roleConfig = {
  user: {
    icon: User,
    label: 'You',
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/20',
    bubble: 'bg-sky-500/[0.08] border-sky-500/10',
  },
  assistant: {
    icon: Bot,
    label: 'Agent',
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    border: 'border-violet-400/20',
    bubble: 'bg-violet-500/[0.08] border-violet-500/10',
  },
  system: {
    icon: Terminal,
    label: 'System',
    color: 'text-text-muted',
    bg: 'bg-white/[0.04]',
    border: 'border-white/[0.06]',
    bubble: 'bg-white/[0.03] border-white/[0.06]',
  },
}

export function SessionReplay() {
  const [sessions, setSessions] = useState<SessionWithMessages[]>([])
  const [selectedSession, setSelectedSession] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'assistant'>('all')
  const [demoMode, setDemoMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/chat?action=sessions')
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      setDemoMode(!!data.demo)
      const sessionList: SessionWithMessages[] = (data.sessions || []).map((s: SessionInfo) => ({
        ...s,
        messages: [],
        loaded: false,
        loading: false,
        tokenEstimate: 0,
      }))
      setSessions(sessionList)
      if (sessionList.length > 0) {
        const main = sessionList.find(s => s.key === 'main') || sessionList[0]
        setSelectedSession(main.key)
      }
    } catch {
      setError('Could not connect to OpenClaw. Check your connection settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Load history when selecting a session
  useEffect(() => {
    if (!selectedSession) return

    const session = sessions.find(s => s.key === selectedSession)
    if (!session || session.loaded || session.loading) return

    setSessions(prev => prev.map(s =>
      s.key === selectedSession ? { ...s, loading: true } : s
    ))

    fetch(`/api/chat?action=history&session=${encodeURIComponent(selectedSession)}`)
      .then(r => r.json())
      .then(data => {
        const messages: Message[] = data.messages || []
        if (typeof data.demo === 'boolean') {
          setDemoMode(data.demo)
        }
        const totalText = messages.map(m => m.content).join('')
        setSessions(prev => prev.map(s =>
          s.key === selectedSession
            ? { ...s, messages, loaded: true, loading: false, tokenEstimate: estimateTokens(totalText) }
            : s
        ))
      })
      .catch(() => {
        setSessions(prev => prev.map(s =>
          s.key === selectedSession ? { ...s, loading: false } : s
        ))
      })
  }, [selectedSession, sessions])

  // Scroll to bottom when messages load
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedSession, sessions])

  const activeSession = sessions.find(s => s.key === selectedSession)
  const filteredMessages = (activeSession?.messages || []).filter(m => {
    if (roleFilter !== 'all' && m.role !== roleFilter) return false
    if (searchQuery && !m.content.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const totalMessages = activeSession?.messages.length || 0
  const userMessages = activeSession?.messages.filter(m => m.role === 'user').length || 0
  const assistantMessages = activeSession?.messages.filter(m => m.role === 'assistant').length || 0

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-accent-primary" />
          <h3 className="text-base font-semibold text-text-primary">Session Replay</h3>
        </div>
        <div className="h-48 flex items-center justify-center">
          <RefreshCw className="w-5 h-5 text-text-muted animate-spin mr-2" />
          <p className="text-sm text-text-muted">Loading sessions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-accent-primary" />
          <h3 className="text-base font-semibold text-text-primary">Session Replay</h3>
        </div>
        <div className="h-48 flex flex-col items-center justify-center gap-2">
          <Terminal className="w-8 h-8 text-text-muted" />
          <p className="text-sm text-text-muted">{error}</p>
          <button
            onClick={loadSessions}
            className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-12rem)]">
      {/* Session List */}
      <div className="w-72 shrink-0 glass rounded-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[var(--glass-border)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Sessions</h3>
            <button
              onClick={loadSessions}
              className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors"
              title="Refresh sessions"
            >
              <RefreshCw className="w-3.5 h-3.5 text-text-muted" />
            </button>
          </div>
          <p className="text-[11px] text-text-muted">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <MessageSquare className="w-6 h-6 text-text-muted/30 mx-auto mb-2" />
              <p className="text-xs text-text-muted">No active sessions</p>
            </div>
          ) : (
            sessions.map(session => (
              <button
                key={session.key}
                onClick={() => setSelectedSession(session.key)}
                className={`w-full px-4 py-3 text-left border-b border-[var(--glass-border)]/50 transition-colors ${
                  selectedSession === session.key
                    ? 'bg-accent-primary/[0.08] border-l-2 border-l-accent-primary'
                    : 'hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    session.status === 'active' ? 'bg-emerald-400' : 'bg-text-muted/30'
                  }`} />
                  <span className="text-xs font-medium text-text-primary truncate">
                    {session.key}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 ml-3.5">
                  <span className="text-[10px] text-text-muted">{session.agent}</span>
                  {session.age && (
                    <span className="text-[10px] text-text-muted/60">{session.age}</span>
                  )}
                </div>
                {session.loaded && (
                  <div className="flex items-center gap-2 mt-1.5 ml-3.5">
                    <span className="text-[10px] text-text-muted/50">
                      {session.messages.length} msgs
                    </span>
                    {session.tokenEstimate > 0 && (
                      <span className="text-[10px] text-text-muted/50">
                        ~{(session.tokenEstimate / 1000).toFixed(1)}K tokens
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message Viewer */}
      <div className="flex-1 glass rounded-2xl flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-[var(--glass-border)]">
          {demoMode && (
            <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2">
              <p className="text-xs font-medium text-amber-200">Demo data — connect OpenClaw to replay live sessions.</p>
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-accent-primary" />
              <h3 className="text-sm font-semibold text-text-primary">
                {selectedSession || 'Select a session'}
              </h3>
              {activeSession && (
                <ChevronRight className="w-3 h-3 text-text-muted" />
              )}
              {activeSession && (
                <span className="text-xs text-text-muted">{activeSession.agent}</span>
              )}
            </div>

            {/* Stats */}
            {activeSession?.loaded && (
              <div className="flex items-center gap-3 text-[10px] text-text-muted">
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" /> {totalMessages} messages
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {userMessages}
                </span>
                <span className="flex items-center gap-1">
                  <Bot className="w-3 h-3" /> {assistantMessages}
                </span>
                {activeSession.tokenEstimate > 0 && (
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" /> ~{(activeSession.tokenEstimate / 1000).toFixed(1)}K tokens
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Search + Filter */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/30"
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'user', 'assistant'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => setRoleFilter(filter)}
                  className={`px-2.5 py-2 rounded-xl text-[10px] font-medium transition-colors flex items-center gap-1 ${
                    roleFilter === filter
                      ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                      : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08] border border-transparent'
                  }`}
                >
                  <Filter className="w-3 h-3" />
                  {filter === 'all' ? 'All' : filter === 'user' ? 'You' : 'Agent'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeSession?.loading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-5 h-5 text-text-muted animate-spin mr-2" />
              <p className="text-sm text-text-muted">Loading conversation...</p>
            </div>
          ) : !activeSession ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <MessageSquare className="w-8 h-8 text-text-muted/20" />
              <p className="text-sm text-text-muted">Select a session to replay</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Search className="w-6 h-6 text-text-muted/20" />
              <p className="text-sm text-text-muted">
                {searchQuery ? `No messages matching "${searchQuery}"` : 'No messages in this session'}
              </p>
            </div>
          ) : (
            <>
              {filteredMessages.map((msg, i) => {
                const config = roleConfig[msg.role]
                const Icon = config.icon
                return (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`shrink-0 w-7 h-7 rounded-lg ${config.bg} flex items-center justify-center`}>
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <div className={`max-w-[75%] rounded-2xl border px-4 py-3 ${config.bubble}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        {msg.timestamp && (
                          <span className="text-[10px] text-text-muted/50 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {msg.timestamp}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-primary/90 leading-relaxed whitespace-pre-wrap break-words">
                        {highlightText(msg.content, searchQuery)}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Scroll to bottom */}
        {filteredMessages.length > 10 && (
          <div className="p-2 border-t border-[var(--glass-border)] flex justify-center">
            <button
              onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] text-text-muted hover:bg-white/[0.04] transition-colors"
            >
              <ArrowDown className="w-3 h-3" />
              Scroll to bottom
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, GitBranch, Loader2, MessageSquarePlus, Send, Sparkles } from 'lucide-react'

import { apiFetch } from '@/lib/api-client'

type AgentOption = {
  name: string
  model: string
}

type InstanceOption = {
  id: string
  name: string
}

type ConversationMessage = {
  id: string
  author: 'system' | 'human' | 'agentA' | 'agentB'
  content: string
  createdAt: string
}

type Conversation = {
  id: string
  goal: string
  status: 'active' | 'completed'
  createdAt: string
  updatedAt: string
  nextSpeaker: 'agentA' | 'agentB'
  agentA: { agentId: string; instanceId: string }
  agentB: { agentId: string; instanceId: string }
  messages: ConversationMessage[]
}

function formatTime(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

function bubbleTone(author: ConversationMessage['author']) {
  if (author === 'system') return 'border-sky-400/20 bg-sky-500/[0.08]'
  if (author === 'human') return 'border-amber-400/20 bg-amber-500/[0.08]'
  if (author === 'agentA') return 'border-violet-400/20 bg-violet-500/[0.08]'
  return 'border-emerald-400/20 bg-emerald-500/[0.08]'
}

export function AgentToAgentChat() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [instances, setInstances] = useState<InstanceOption[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [goal, setGoal] = useState('Coordinate a launch plan and agree on the next operator action.')
  const [agentAId, setAgentAId] = useState('default')
  const [agentBId, setAgentBId] = useState('scout')
  const [instanceAId, setInstanceAId] = useState('main')
  const [instanceBId, setInstanceBId] = useState('main')
  const [intervention, setIntervention] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [conversationRes, agentsRes, instancesRes] = await Promise.all([
        fetch('/api/agent-chat'),
        fetch('/api/agents'),
        fetch('/api/instances'),
      ])

      const conversationData = await conversationRes.json()
      const agentsData = await agentsRes.json().catch(() => ({ agents: [] }))
      const instancesData = await instancesRes.json().catch(() => ({ instances: [] }))

      const nextConversations = Array.isArray(conversationData.conversations) ? conversationData.conversations : []
      const nextAgents = Array.isArray(agentsData.agents) && agentsData.agents.length > 0
        ? agentsData.agents.map((agent: { name: string; model: string }) => ({ name: agent.name, model: agent.model }))
        : [
            { name: 'default', model: 'claude-sonnet-4' },
            { name: 'scout', model: 'deepseek-chat-v3' },
            { name: 'editor', model: 'claude-sonnet-4' },
          ]
      const nextInstances = Array.isArray(instancesData.instances) && instancesData.instances.length > 0
        ? instancesData.instances.map((instance: { id: string; name: string }) => ({ id: instance.id, name: instance.name }))
        : [{ id: 'main', name: 'Main Instance' }]

      setConversations(nextConversations)
      setAgents(nextAgents)
      setInstances(nextInstances)

      if (!selectedId && nextConversations[0]?.id) {
        setSelectedId(nextConversations[0].id)
      }
      if (!agentAId && nextAgents[0]?.name) setAgentAId(nextAgents[0].name)
      if (!agentBId && nextAgents[1]?.name) setAgentBId(nextAgents[1].name)
      if (!instanceAId && nextInstances[0]?.id) setInstanceAId(nextInstances[0].id)
      if (!instanceBId && nextInstances[1]?.id) setInstanceBId(nextInstances[1].id)
    } catch {
      setError('Agent-to-agent chat could not be loaded right now.')
    } finally {
      setLoading(false)
    }
  }, [agentAId, agentBId, instanceAId, instanceBId, selectedId])

  useEffect(() => {
    void load()
  }, [load])

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || conversations[0] || null,
    [conversations, selectedId],
  )

  async function createConversation() {
    setBusy('create')
    setError('')
    try {
      const response = await apiFetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          goal,
          agentAId,
          agentBId,
          instanceAId,
          instanceBId,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not create conversation.')
      setConversations((current) => [data.conversation, ...current.filter((item) => item.id !== data.conversation.id)])
      setSelectedId(data.conversation.id)
      setIntervention('')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create conversation.')
    } finally {
      setBusy(null)
    }
  }

  async function continueConversation() {
    if (!activeConversation) return
    setBusy('continue')
    setError('')
    try {
      const response = await apiFetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'continue', conversationId: activeConversation.id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not continue conversation.')
      setConversations((current) => current.map((item) => item.id === data.conversation.id ? data.conversation : item))
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not continue conversation.')
    } finally {
      setBusy(null)
    }
  }

  async function sendIntervention() {
    if (!activeConversation || !intervention.trim()) return
    setBusy('intervene')
    setError('')
    try {
      const response = await apiFetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'intervene',
          conversationId: activeConversation.id,
          message: intervention.trim(),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not send intervention.')
      setConversations((current) => current.map((item) => item.id === data.conversation.id ? data.conversation : item))
      setIntervention('')
    } catch (interventionError) {
      setError(interventionError instanceof Error ? interventionError.message : 'Could not send intervention.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="glass rounded-2xl overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-accent-primary" />
            <div>
              <h2 className="text-base font-semibold text-text-primary">Agent Conversations</h2>
              <p className="text-xs text-text-muted">Parallel internal chats you can monitor and redirect.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
            <div>
              <label className="text-xs uppercase tracking-[0.16em] text-text-muted/70">Shared goal</label>
              <textarea
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent-primary/40"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.16em] text-text-muted/70">Agent A</label>
                <select value={agentAId} onChange={(event) => setAgentAId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-text-primary outline-none">
                  {agents.map((agent) => (
                    <option key={`a-${agent.name}`} value={agent.name}>{agent.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.16em] text-text-muted/70">Instance A</label>
                <select value={instanceAId} onChange={(event) => setInstanceAId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-text-primary outline-none">
                  {instances.map((instance) => (
                    <option key={`ia-${instance.id}`} value={instance.id}>{instance.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.16em] text-text-muted/70">Agent B</label>
                <select value={agentBId} onChange={(event) => setAgentBId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-text-primary outline-none">
                  {agents.map((agent) => (
                    <option key={`b-${agent.name}`} value={agent.name}>{agent.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.16em] text-text-muted/70">Instance B</label>
                <select value={instanceBId} onChange={(event) => setInstanceBId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-text-primary outline-none">
                  {instances.map((instance) => (
                    <option key={`ib-${instance.id}`} value={instance.id}>{instance.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={createConversation}
              disabled={busy !== null || !goal.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary,#3b82f6)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
              Start conversation
            </button>
          </div>

          <div className="space-y-2 max-h-[44vh] overflow-y-auto">
            {loading ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 text-sm text-text-muted flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading conversations...
              </div>
            ) : conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => setSelectedId(conversation.id)}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                  activeConversation?.id === conversation.id
                    ? 'border-accent-primary/40 bg-accent-primary/10'
                    : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]'
                }`}
              >
                <p className="text-sm font-medium text-text-primary">{conversation.goal}</p>
                <p className="mt-1 text-xs text-text-muted">{conversation.agentA.agentId} ↔ {conversation.agentB.agentId}</p>
                <p className="mt-3 text-[11px] text-text-muted">{formatTime(conversation.updatedAt)}</p>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="glass rounded-2xl overflow-hidden">
        <div className="border-b border-white/[0.06] px-6 py-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Agent-to-Agent Chat</h1>
            <p className="mt-1 text-sm text-text-muted">Let two agents work a shared goal in public, then step in whenever they drift.</p>
          </div>
          {activeConversation ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={continueConversation}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-primary disabled:opacity-60"
              >
                {busy === 'continue' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Advance one turn
              </button>
            </div>
          ) : null}
        </div>

        <div className="px-6 py-6">
          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
          ) : null}

          {!activeConversation ? (
            <div className="rounded-3xl border border-dashed border-white/[0.12] bg-white/[0.02] px-6 py-16 text-center">
              <Bot className="mx-auto h-10 w-10 text-text-muted/50" />
              <p className="mt-4 text-base font-medium text-text-primary">Start a conversation between two agents</p>
              <p className="mt-2 text-sm text-text-muted">Pick the participants on the left, define the goal, and we’ll keep the thread visible here.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.08] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-violet-200/70">Agent A</p>
                  <p className="mt-2 text-sm font-medium text-text-primary">{activeConversation.agentA.agentId}</p>
                  <p className="text-xs text-text-muted">{activeConversation.agentA.instanceId}</p>
                </div>
                <div className="rounded-2xl border border-sky-400/20 bg-sky-500/[0.08] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-sky-200/70">Shared Goal</p>
                  <p className="mt-2 text-sm text-text-primary">{activeConversation.goal}</p>
                </div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-emerald-200/70">Agent B</p>
                  <p className="mt-2 text-sm font-medium text-text-primary">{activeConversation.agentB.agentId}</p>
                  <p className="text-xs text-text-muted">{activeConversation.agentB.instanceId}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5 space-y-4 max-h-[56vh] overflow-y-auto">
                {activeConversation.messages.map((message) => (
                  <div key={message.id} className={`rounded-2xl border px-4 py-4 ${bubbleTone(message.author)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-[0.16em] text-text-muted/70">
                        {message.author === 'agentA'
                          ? activeConversation.agentA.agentId
                          : message.author === 'agentB'
                            ? activeConversation.agentB.agentId
                            : message.author}
                      </span>
                      <span className="text-[11px] text-text-muted">{formatTime(message.createdAt)}</span>
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-primary/90 font-sans">{message.content}</pre>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-white/[0.06] bg-black/20 p-5">
                <p className="text-sm font-medium text-text-primary">Human intervention</p>
                <p className="mt-1 text-xs text-text-muted">Redirect the agents, add new context, or force a sharper next step.</p>
                <div className="mt-4 flex gap-3">
                  <textarea
                    value={intervention}
                    onChange={(event) => setIntervention(event.target.value)}
                    rows={3}
                    placeholder="Example: stop comparing channels and give me one concrete launch recommendation with reasoning."
                    className="min-h-[88px] flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-text-primary outline-none focus:border-accent-primary/40"
                  />
                  <button
                    onClick={sendIntervention}
                    disabled={busy !== null || !intervention.trim()}
                    className="inline-flex h-fit items-center gap-2 rounded-2xl bg-[var(--accent-primary,#3b82f6)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {busy === 'intervene' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

import { AgentToAgentChat } from '@/components/chat/agent-to-agent-chat'

export default function AgentToAgentChatPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Agent-to-Agent Chat</h1>
        <p className="text-sm text-text-secondary">
          Put two agents on the same goal, watch the thread unfold, and step in whenever you want to redirect them.
        </p>
      </div>
      <AgentToAgentChat />
    </div>
  )
}

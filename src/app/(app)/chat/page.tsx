import { AgentChat } from '@/components/chat/agent-chat'

export default function ChatPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Agent Chat</h1>
        <p className="text-sm text-text-secondary">
          Talk directly to your OpenClaw agent — send commands, ask questions, or manage tasks
        </p>
      </div>
      <AgentChat />
    </div>
  )
}

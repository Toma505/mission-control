export default function AgentToAgentChatPage() {
  return (
    <div className="glass rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-8">
      <div className="max-w-2xl space-y-4">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-200/70">
          Unavailable In This Release
        </p>
        <h1 className="text-3xl font-bold text-text-primary">Agent-to-Agent Chat is not shipping yet.</h1>
        <p className="text-sm leading-7 text-text-secondary">
          We removed the earlier simulated version because it generated canned local replies instead of running real
          agent conversations. That is not acceptable for a paid product.
        </p>
        <p className="text-sm leading-7 text-text-secondary">
          This route is intentionally blocked until we ship a real multi-agent execution flow. Until then, use{' '}
          <span className="font-medium text-text-primary">Chat</span>,{' '}
          <span className="font-medium text-text-primary">Replay</span>, and{' '}
          <span className="font-medium text-text-primary">Orchestrate</span> for real connected workflows.
        </p>
      </div>
    </div>
  )
}

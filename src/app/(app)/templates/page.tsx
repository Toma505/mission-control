import { AgentTemplates } from '@/components/agents/agent-templates'

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Agent Templates</h1>
        <p className="text-sm text-text-muted mt-1">
          Deploy built-in roles fast, or create your own reusable agent templates.
        </p>
      </div>
      <AgentTemplates />
    </div>
  )
}

import { PromptLibrary } from '@/components/settings/prompt-library'

export default function PromptsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Prompt Library</h1>
        <p className="text-sm text-text-muted mt-1">
          Save, organize, and reuse system prompts and agent instructions
        </p>
      </div>
      <PromptLibrary />
    </div>
  )
}

import { CostTags } from '@/components/settings/cost-tags'

export default function CostTagsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Cost Allocation</h1>
        <p className="text-sm text-text-muted mt-1">
          Tag sessions with project or client names to track spending by category
        </p>
      </div>
      <CostTags />
    </div>
  )
}

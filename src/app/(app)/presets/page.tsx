import { ModelPresets } from '@/components/settings/model-presets'

export default function PresetsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Model Presets</h1>
        <p className="text-sm text-text-muted mt-1">One-click model configurations for your agents</p>
      </div>
      <ModelPresets />
    </div>
  )
}

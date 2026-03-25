import { ModelBenchmarks } from '@/components/costs/model-benchmarks'

export default function BenchmarksPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Model Benchmarks</h1>
        <p className="text-sm text-text-muted mt-1">
          Compare model cost efficiency, token usage, and get optimization recommendations
        </p>
      </div>
      <ModelBenchmarks />
    </div>
  )
}

import { CostCompare } from '@/components/costs/cost-compare'

export default function CostComparePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Multi-Provider Cost Comparison</h1>
        <p className="text-sm text-text-secondary">See what your workload would cost on every major model</p>
      </div>
      <CostCompare />
    </div>
  )
}

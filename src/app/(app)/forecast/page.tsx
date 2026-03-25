import { UsageForecast } from '@/components/costs/usage-forecast'

export default function ForecastPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">AI Usage Forecast</h1>
        <p className="text-sm text-text-secondary">Projected spending with actionable recommendations</p>
      </div>
      <UsageForecast />
    </div>
  )
}

import { cn } from "@/lib/utils"

interface ProgressBarProps {
  value: number // 0-100
  variant?: 'active' | 'progress' | 'idle'
  className?: string
  showLabel?: boolean
}

export function ProgressBar({ value, variant = 'progress', className, showLabel = false }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))
  
  const variantColors = {
    active: 'bg-status-active',
    progress: 'bg-status-progress',
    idle: 'bg-status-idle',
  }

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && (
        <div className="flex justify-between text-xs text-text-secondary">
          <span>Progress</span>
          <span>{clampedValue}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-background-elevated rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all duration-300 ease-out", variantColors[variant])}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  )
}

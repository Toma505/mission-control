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
    active: 'bg-emerald-400',
    progress: 'bg-blue-400',
    idle: 'bg-blue-400/60',
  }

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && (
        <div className="flex justify-between text-[11px] text-text-muted/60">
          <span>Progress</span>
          <span>{clampedValue}%</span>
        </div>
      )}
      <div className="w-full h-[5px] bg-white/[0.04] rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            variantColors[variant]
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  )
}

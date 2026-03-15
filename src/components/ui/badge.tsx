import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-transform duration-200 hover:scale-105 cursor-pointer",
  {
    variants: {
      variant: {
        active: "bg-status-active/10 text-status-active border border-status-active/20",
        progress: "bg-status-progress/10 text-status-progress border border-status-progress/20",
        idle: "bg-status-idle/10 text-status-idle border border-status-idle/20",
        error: "bg-status-error/10 text-status-error border border-status-error/20",
        planning: "bg-status-planning/10 text-status-planning border border-status-planning/20",
        default: "bg-background-elevated text-text-secondary border border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

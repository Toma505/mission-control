import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all duration-200",
  {
    variants: {
      variant: {
        active: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15",
        progress: "bg-amber-500/10 text-amber-400 border border-amber-500/15",
        idle: "bg-blue-500/10 text-blue-400 border border-blue-500/15",
        error: "bg-red-500/10 text-red-400 border border-red-500/15",
        planning: "bg-violet-500/10 text-violet-400 border border-violet-500/15",
        default: "bg-white/[0.04] text-text-secondary border border-white/[0.06]",
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

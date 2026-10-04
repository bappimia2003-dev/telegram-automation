import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-green-200/50 dark:border-green-800/40 bg-green-50 dark:bg-[#143825] text-green-700 dark:text-green-300",
        secondary:
          "border-[#E6E2D8] dark:border-[#262930] bg-[#EDE8DE] dark:bg-[#1E2228] text-gray-700 dark:text-gray-300",
        destructive:
          "border-red-200/60 dark:border-red-900/40 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",
        outline: "border-[#E6E2D8] dark:border-[#262930] text-gray-700 dark:text-gray-300 bg-[#FAF8F5] dark:bg-[#181A1F]",
        success: 
          "border-emerald-200/50 dark:border-emerald-800/40 bg-emerald-50 dark:bg-[#143825] text-emerald-700 dark:text-emerald-300",
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

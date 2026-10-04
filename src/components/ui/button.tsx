import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#164E43] text-white hover:bg-[#124238] shadow-sm",
        destructive: "bg-red-600 text-white hover:bg-red-500 shadow-sm",
        outline: "border border-[#E6E2D8] dark:border-[#262930] bg-[#FAF8F5] dark:bg-[#181A1F] hover:bg-[#EDE8DE] dark:hover:bg-[#22262C] text-gray-800 dark:text-gray-200 shadow-sm",
        secondary: "bg-[#EDE8DE] dark:bg-[#1F2228] text-gray-800 dark:text-gray-200 hover:bg-[#E2DDD1] dark:hover:bg-[#272B33]",
        ghost: "hover:bg-[#EDE8DE] dark:hover:bg-[#1F2228] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white",
        link: "text-[#164E43] dark:text-[#34D399] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-3.5",
        lg: "h-12 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

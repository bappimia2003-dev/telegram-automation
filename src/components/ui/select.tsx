import * as React from "react"
import { cn } from "@/lib/utils"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { label: string; value: string }[];
  placeholder?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex h-11 w-full rounded-xl border border-[#E6E2D8] dark:border-[#262930] bg-[#FAF8F5] dark:bg-[#121418] px-4 py-2 text-sm text-gray-900 dark:text-gray-100 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#164E43] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className
        )}
        ref={ref}
        {...props}
      >
        {placeholder && (
          <option value="" disabled className="text-gray-400 dark:text-gray-600">
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white dark:bg-[#181A1F] text-gray-900 dark:text-gray-100">
            {opt.label}
          </option>
        ))}
      </select>
    )
  }
)
Select.displayName = "Select"

export { Select }

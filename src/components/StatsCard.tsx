import * as React from "react"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  className?: string;
}

export function StatsCard({ title, value, icon: Icon, trend, className }: StatsCardProps) {
  // Extract number and possible suffix like "/ 4 Connected"
  const valStr = String(value);
  const match = valStr.match(/^(\d+)(.*)$/);
  const numPart = match ? match[1] : valStr;
  const suffixPart = match ? match[2] : "";

  return (
    <div className={cn(
      "rounded-[20px] border border-[#E4DFD2] dark:border-[#222B36] bg-[#FBF9F4] dark:bg-[#181A1F] p-3.5 sm:p-4 transition-all duration-200 shadow-xs hover:border-[#164E43]/40 dark:hover:border-emerald-700/50",
      className
    )}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] sm:text-xs font-bold text-[#6B706A] dark:text-[#8A9B94] truncate">
          {title}
        </span>
        <div className="w-[34px] h-[34px] rounded-[12px] bg-[#164E43] text-white flex items-center justify-center shrink-0 shadow-xs">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-1.5 flex items-baseline flex-wrap gap-1 font-mono tabular-nums">
        <span className="text-[24px] sm:text-[28px] font-bold tracking-tight text-[#164E43] dark:text-[#5FD1A5]">
          {numPart}
        </span>
        {suffixPart && (
          <span className="text-[11.5px] sm:text-xs font-semibold text-[#6B706A] dark:text-[#8A9B94]">
            {suffixPart}
          </span>
        )}
        {trend && (
          <span className={cn(
            "text-[11px] font-bold ml-auto",
            trend.startsWith("+") ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
          )}>
            {trend}
          </span>
        )}
      </div>
    </div>
  )
}

import * as React from "react"
import { LucideIcon } from "lucide-react"
import { Card, CardContent } from "./ui/card"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  className?: string;
}

export function StatsCard({ title, value, icon: Icon, trend, className }: StatsCardProps) {
  return (
    <Card className={cn(
      "overflow-hidden rounded-2xl border transition-all shadow-sm",
      "bg-[#FBF9F4] border-[#E6E2D8]",
      "dark:bg-[#0B2820] dark:border-[#13382E]",
      className
    )}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 truncate">{title}</p>
            <div className="flex items-baseline gap-2">
              <h4 className={cn(
                "font-bold tracking-tight text-[#164E43] dark:text-white",
                String(value).length > 8 ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"
              )}>
                {value}
              </h4>
              {trend && (
                <span className={cn(
                  "text-xs font-semibold",
                  trend.startsWith("+") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )}>
                  {trend}
                </span>
              )}
            </div>
          </div>

          {/* Icon Box */}
          <div className="p-2.5 rounded-xl transition-colors shrink-0 bg-[#164E43] text-white dark:bg-[#3D341B] dark:text-[#F59E0B]">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

import * as React from "react"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  subtitle?: string;
  className?: string;
}

export function StatsCard({ title, value, icon: Icon, trend, subtitle, className }: StatsCardProps) {
  const valStr = String(value);
  const match = valStr.match(/^(\d+)(.*)$/);
  const numPart = match ? match[1] : valStr;
  const suffixPart = match ? match[2] : "";

  return (
    <div className={cn(
      "rounded-2xl border border-border bg-card p-4 transition-all duration-200 day-box-shadow hover:border-[#075E54]/35 dark:hover:border-[#00A884]/40 flex flex-col justify-between min-h-[96px]",
      className
    )}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">
          {title}
        </span>
        <div className="w-8 h-8 rounded-xl bg-secondary text-[#075E54] dark:bg-[#00A884]/15 dark:text-[#00A884] flex items-center justify-center shrink-0 border border-border/60">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {numPart}
          </span>
          {suffixPart && (
            <span className="text-xs font-semibold text-muted-foreground font-sans">
              {suffixPart}
            </span>
          )}
        </div>

        {trend && (
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-lg",
            trend.startsWith("+") 
              ? "bg-[#25D366]/15 text-[#075E54] dark:text-[#00A884]" 
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          )}>
            {trend}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-[11px] font-medium text-muted-foreground mt-1.5 truncate">
          {subtitle}
        </p>
      )}
    </div>
  )
}

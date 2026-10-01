"use client"

import * as React from "react"
import { Badge } from "./ui/badge"
import { cn } from "@/lib/utils"

interface ModelStatusProps {
  currentModel: string;
  status: "Active" | "Error" | "Offline";
  className?: string;
}

export function ModelStatus({ currentModel, status, className }: ModelStatusProps) {
  const statusColor = 
    status === "Active" ? "bg-green-500" :
    status === "Error" ? "bg-red-500" :
    "bg-gray-500"

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2.5 w-2.5">
          {status === "Active" && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          )}
          <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", statusColor)}></span>
        </span>
        <span className="text-sm font-medium text-muted-foreground">{status}</span>
      </div>
      <Badge variant="outline" className="font-mono text-xs">
        {currentModel}
      </Badge>
    </div>
  )
}

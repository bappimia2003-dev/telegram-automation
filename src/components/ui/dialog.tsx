"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const DialogContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({ open: false, onOpenChange: () => {} })

export function Dialog({ open: openProp, onOpenChange, children }: DialogProps) {
  const [open, setOpen] = React.useState(openProp || false)

  React.useEffect(() => {
    if (openProp !== undefined) setOpen(openProp)
  }, [openProp])

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    onOpenChange?.(newOpen)
  }

  return (
    <DialogContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

export function DialogTrigger({ children, asChild }: { children: React.ReactNode, asChild?: boolean }) {
  const { onOpenChange } = React.useContext(DialogContext)
  
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, {
      onClick: (e: any) => {
        children.props.onClick?.(e)
        onOpenChange(true)
      }
    })
  }

  return <span onClick={() => onOpenChange(true)}>{children}</span>
}

export function DialogContent({ className, children }: { className?: string, children: React.ReactNode }) {
  const { open, onOpenChange } = React.useContext(DialogContext)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className={cn("relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#E6E2D8] dark:border-[#262930] bg-[#FAF8F5] dark:bg-[#181A1F] text-foreground p-6 shadow-2xl my-auto transition-colors", className)}>
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ className, children }: { className?: string, children: React.ReactNode }) {
  return <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-4", className)}>{children}</div>
}

export function DialogTitle({ className, children }: { className?: string, children: React.ReactNode }) {
  return <h2 className={cn("text-lg font-bold leading-none tracking-tight text-foreground", className)}>{children}</h2>
}

export function DialogDescription({ className, children }: { className?: string, children: React.ReactNode }) {
  return <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
}

export function DialogFooter({ className, children }: { className?: string, children: React.ReactNode }) {
  return <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6", className)}>{children}</div>
}

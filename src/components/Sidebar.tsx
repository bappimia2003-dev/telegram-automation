"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Bot, Key, LogOut, Menu, X, MessageCircle, PlusCircle, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./ui/button"

const telegramNavItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/bots/new", icon: Bot, label: "New Bot" },
  { href: "/api-keys", icon: Key, label: "API Keys" },
]

const waNavItems = [
  { href: "/whatsapp", icon: MessageCircle, label: "WhatsApp" },
  { href: "/whatsapp/campaigns/new", icon: PlusCircle, label: "New Campaign" },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = React.useState(false)

  // Close sidebar automatically when route changes
  React.useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } catch (e) {
      console.error(e);
    }
    router.push("/")
    router.refresh()
  }

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button 
        type="button"
        aria-label="Toggle navigation menu"
        className="md:hidden fixed top-3 left-3 z-40 w-10 h-10 flex items-center justify-center rounded-lg bg-card/90 border border-border shadow-lg backdrop-blur-md text-foreground hover:bg-secondary transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar Panel */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 flex flex-col justify-between bg-card border-r border-border/60 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div>
          {/* Header */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-border/50">
            <Link href="/dashboard" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">TG Auto</span>
            </Link>

            {/* Mobile close button inside panel */}
            <button 
              className="md:hidden text-muted-foreground hover:text-white p-1"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Nav Items */}
          <nav className="space-y-4 p-4">
            <div>
              <div className="px-3 mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Telegram
              </div>
              <div className="space-y-1">
                {telegramNavItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center space-x-3 rounded-lg px-3.5 py-2 text-sm font-medium transition-all",
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-border/40">
              <div className="space-y-1">
                {waNavItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/whatsapp' && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center space-x-3 rounded-lg px-3.5 py-2 text-sm font-medium transition-all",
                        isActive 
                          ? "bg-emerald-600 text-white shadow-sm shadow-emerald-900/30" 
                          : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>

        {/* Footer Logout */}
        <div className="p-4 border-t border-border/50">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>
      
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

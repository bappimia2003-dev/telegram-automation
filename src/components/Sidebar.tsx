"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Bot, Key, LogOut, Menu, X, MessageCircle, PlusCircle, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./ui/button"

const telegramNavItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/bots/new", icon: Bot, label: "New Bot" },
  { href: "/api-keys", icon: Key, label: "API Keys" },
]

const waNavItems = [
  { href: "/whatsapp", icon: MessageCircle, label: "WhatsApp" },
  { href: "/whatsapp/new-followup", icon: Sparkles, label: "New Follow-up" },
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
        className="md:hidden fixed top-3 left-3 z-40 w-10 h-10 flex items-center justify-center rounded-xl bg-[#F4F1EB] dark:bg-[#111215] border border-[#E6E2D8] dark:border-[#1F2429] shadow-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar Panel */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 flex flex-col justify-between bg-[#F4F1EB] dark:bg-[#111215] border-r border-[#E6E2D8] dark:border-[#1F2429] transition-transform duration-300 ease-in-out shadow-lg md:shadow-none select-none",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div>
          {/* Header */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-[#E6E2D8] dark:border-[#1F2429]">
            <Link href="/dashboard" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E8E4DA] dark:bg-[#181A1F] border border-[#D8D3C8] dark:border-[#262930] flex items-center justify-center text-[#164E43] dark:text-emerald-400">
                <Bot className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">TG Auto</span>
            </Link>

            {/* Mobile close button inside panel */}
            <button 
              className="md:hidden text-gray-400 hover:text-gray-900 dark:hover:text-white p-1"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Nav Items */}
          <nav className="space-y-4 p-4">
            <div>
              <div className="px-3.5 mb-1.5 text-[11px] font-bold tracking-wider text-gray-700 dark:text-gray-400 uppercase">
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
                        "flex items-center space-x-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all",
                        isActive 
                          ? "bg-[#164E43] text-white shadow-sm font-bold" 
                          : "text-gray-900 dark:text-gray-100 hover:bg-[#EAE6DD] dark:hover:bg-[#181A1F] hover:text-black dark:hover:text-white"
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

            <div className="pt-2.5 border-t border-[#E6E2D8] dark:border-[#1F2429]">
              <div className="px-3.5 mb-1.5 text-[11px] font-bold tracking-wider text-gray-700 dark:text-gray-400 uppercase">
                WhatsApp
              </div>
              <div className="space-y-1">
                {waNavItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/whatsapp' && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center space-x-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all",
                        isActive 
                          ? "bg-[#164E43] text-white shadow-sm font-bold" 
                          : "text-gray-900 dark:text-gray-100 hover:bg-[#EAE6DD] dark:hover:bg-[#181A1F] hover:text-black dark:hover:text-white"
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

        {/* Footer Area with System Active & Logout */}
        <div className="p-3 border-t border-[#E6E2D8] dark:border-[#1F2429] space-y-1.5">
          {/* Bottom System Active Indicator */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-[#EAE6DD] dark:bg-[#152822] text-[#164E43] dark:text-emerald-400 border border-[#DDD8CD] dark:border-[#1E3B33] shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>System Active</span>
          </div>

          <Button 
            variant="ghost" 
            className="w-full justify-start text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors text-xs font-semibold rounded-lg h-9"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Logout
          </Button>
        </div>
      </aside>
      
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

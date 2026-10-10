"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { 
  LayoutDashboard, 
  Bot, 
  Key, 
  LogOut, 
  X, 
  PlusCircle, 
  Sparkles,
  Users,
  ShieldCheck,
  UserCheck,
  Clock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./ui/button"

const baseWaNavItems = [
  { href: "/whatsapp", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/whatsapp/new-followup", icon: Sparkles, label: "New Follow-up" },
  { href: "/whatsapp/campaigns/new", icon: PlusCircle, label: "New Campaign" },
]

const telegramNavItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/bots/new", icon: Bot, label: "New Bot" },
  { href: "/api-keys", icon: Key, label: "API Keys" },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = React.useState(false)
  const [authData, setAuthData] = React.useState<any>(null)

  React.useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  React.useEffect(() => {
    const loadAuth = () => {
      fetch(`/api/auth?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.authenticated) setAuthData(d)
        })
        .catch(() => {})
    }
    loadAuth()
    const timer = setInterval(loadAuth, 15000)
    return () => clearInterval(timer)
  }, [])

  const isAdmin = !authData || authData.role === "admin"
  const waNavItems = isAdmin
    ? [...baseWaNavItems, { href: "/whatsapp/clients", icon: Users, label: "Clients Panel" }]
    : baseWaNavItems.filter((item) => item.href !== "/whatsapp/new-followup")

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' })
      if (typeof window !== 'undefined') {
        localStorage.removeItem('wa_cached_campaigns')
        localStorage.removeItem('wa_cached_accounts')
        localStorage.removeItem('wa_cached_stats')
        localStorage.removeItem('wa_cached_followup')
      }
    } catch (e) {
      console.error(e)
    }
    router.push("/")
    router.refresh()
  }

  const clientInfo = authData?.client
  const remainingDays = clientInfo?.remainingDays
  const isExpired = clientInfo?.isExpired

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button 
        type="button"
        aria-label="Toggle navigation menu"
        className="md:hidden fixed top-3 left-3 z-40 w-11 h-11 flex flex-col items-center justify-center gap-1.5 rounded-[15px] bg-[#FBF9F4] dark:bg-[#161C25] border border-[#E4DFD2] dark:border-[#222B36] shadow-sm text-[#1B1D1A] dark:text-[#E9EEF2] active:scale-95 transition-transform cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="w-4 h-[2px] rounded-full bg-current" />
        <span className="w-2.5 h-[2px] rounded-full bg-current self-start ml-3.5" />
        <span className="w-4 h-[2px] rounded-full bg-current" />
      </button>

      {/* Sidebar Panel */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-[220px] md:w-64 flex flex-col justify-between bg-[#F3F0E8] dark:bg-[#12171F] border-r border-[#E4DFD2] dark:border-[#222B36] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:shadow-none select-none",
        "rounded-r-[24px] md:rounded-none shadow-[14px_0_36px_-18px_rgba(0,0,0,0.35)] md:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="flex h-[64px] items-center justify-between px-3.5 border-b border-[#E4DFD2] dark:border-[#222B36]">
            <Link href="/whatsapp" className="flex items-center gap-2.5">
              <div className="w-[34px] h-[34px] rounded-[10px] bg-[#E7E2D5] dark:bg-[#1C2530] border border-[#DDD7C8] dark:border-[#28323F] flex items-center justify-center text-[#164F43] dark:text-[#34D399] shadow-xs">
                <Bot className="h-4 w-4" />
              </div>
              <span className="text-[19px] font-bold tracking-tight text-[#1B1D1A] dark:text-[#E9EEF2]">
                {isAdmin ? "Panel" : (authData?.clientName || "Panel")}
              </span>
            </Link>

            <button 
              aria-label="Close menu"
              className="md:hidden text-[#6B706A] dark:text-[#7C8794] hover:text-[#1B1D1A] dark:hover:text-white p-1.5 rounded-lg active:scale-95 transition-transform"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Nav Items */}
          <nav className="p-2.5 space-y-3">
            {/* UPPER SECTION: WHATSAPP */}
            <div>
              <div className="px-2.5 mb-1.5 text-[10.5px] font-bold tracking-[0.14em] text-[#6B706A] dark:text-[#7C8794] uppercase">
                WHATSAPP
              </div>
              <div className="space-y-1">
                {waNavItems.map((item) => {
                  const isActive = item.href === '/whatsapp' 
                    ? pathname === '/whatsapp'
                    : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-[13.5px] font-semibold transition-all duration-150 group active:scale-[0.98]",
                        isActive 
                          ? "bg-[#164E43] text-white font-bold shadow-sm" 
                          : "text-[#1B1D1A] dark:text-[#E9EEF2] hover:bg-[#E7E2D5] dark:hover:bg-[#1A222C]"
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

            {isAdmin && (
              <>
                <div className="h-[1px] bg-[#E4DFD2] dark:border-t dark:border-[#222B36] mx-1.5" />
                <div>
                  <div className="px-2.5 mb-1.5 text-[10.5px] font-bold tracking-[0.14em] text-[#6B706A] dark:text-[#7C8794] uppercase">
                    TELEGRAM
                  </div>
                  <div className="space-y-1">
                    {telegramNavItems.map((item) => {
                      const isActive = item.href === '/dashboard'
                        ? (pathname === '/dashboard' || (pathname.startsWith('/bots') && pathname !== '/bots/new'))
                        : pathname.startsWith(item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-[13.5px] font-semibold transition-all duration-150 group active:scale-[0.98]",
                            isActive 
                              ? "bg-[#164E43] text-white font-bold shadow-sm" 
                              : "text-[#1B1D1A] dark:text-[#E9EEF2] hover:bg-[#E7E2D5] dark:hover:bg-[#1A222C]"
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
              </>
            )}
          </nav>
        </div>

        {/* Footer Area with Profile / Day Pop-up Badge & Logout */}
        <div className="p-2.5 border-t border-[#E4DFD2] dark:border-[#222B36] space-y-2">
          {/* Client Profile Card with Pop-up Day Badge */}
          {authData?.role === "client" && clientInfo ? (
            <div className="relative pt-2">
              {/* Pop-up Day Number Badge on top of Profile */}
              {remainingDays !== null && remainingDays !== undefined && (
                <div
                  className={cn(
                    "absolute -top-1 right-2.5 z-10 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide shadow-md border flex items-center gap-1",
                    isExpired || remainingDays <= 0
                      ? "bg-red-600 text-white border-red-500 animate-pulse"
                      : remainingDays <= 5
                      ? "bg-amber-500 text-white border-amber-400"
                      : "bg-[#164E43] text-white border-[#1F6E5E]"
                  )}
                >
                  <Clock className="w-2.5 h-2.5" />
                  <span>{isExpired || remainingDays <= 0 ? "0 Days (Off)" : `${remainingDays}d Left`}</span>
                </div>
              )}

              <div className="rounded-[14px] bg-[#E7E2D5] dark:bg-[#1A222C] border border-[#E4DFD2] dark:border-[#222B36] p-2.5 shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#164E43]/15 dark:bg-[#34D399]/15 text-[#164E43] dark:text-[#34D399] flex items-center justify-center font-bold text-xs shrink-0">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[#1B1D1A] dark:text-[#E9EEF2] truncate">
                      {clientInfo.name}
                    </div>
                    <div className="text-[10px] text-[#6B706A] dark:text-[#7C8794]">
                      Max {clientInfo.maxWhatsappNumbers} SIM • {clientInfo.maxCampaigns} Camp
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-10 rounded-[12px] bg-[#E7E2D5] dark:bg-[#1A222C] border border-[#E4DFD2] dark:border-[#222B36] flex items-center justify-between px-3 text-[13px] font-bold text-[#1B1D1A] dark:text-[#E9EEF2] shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#1F9D6B] dark:bg-[#34D399] animate-pulse" />
                <span>System Active</span>
              </div>
              {isAdmin && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#164E43]/15 dark:bg-[#34D399]/15 text-[#164E43] dark:text-[#34D399] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Admin
                </span>
              )}
            </div>
          )}

          <Button 
            variant="ghost" 
            className="w-full justify-start text-[#6B706A] dark:text-[#7C8794] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors text-xs font-bold rounded-[12px] h-8 px-3"
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
          className="fixed inset-0 bg-[rgba(8,12,10,0.52)] backdrop-blur-[3px] z-30 md:hidden transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Bot, 
  Key, 
  LogOut, 
  X, 
  PlusCircle, 
  Zap, 
  Users, 
  Target,
  MessageSquare,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "./LanguageProvider";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = React.useState(false);
  const [authData, setAuthData] = React.useState<any>(null);
  const [activeChannel, setActiveChannel] = React.useState<'whatsapp' | 'telegram'>(() => {
    if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/bots') || pathname?.startsWith('/api-keys')) {
      return 'telegram';
    }
    return 'whatsapp';
  });

  const waNavItems = React.useMemo(() => [
    { href: "/whatsapp", icon: LayoutDashboard, label: t("Overview & Dashboard", "ওভারভিউ ও ড্যাশবোর্ড"), shortLabel: t("Overview", "ওভারভিউ") },
    { href: "/whatsapp/targeted-followup", icon: Target, label: t("Targeted Follow-up", "টার্গেটেড ফলো-আপ"), shortLabel: t("Targeted", "টার্গেটেড") },
    { href: "/whatsapp/new-followup", icon: Zap, label: t("Smart Auto-Sequence", "স্মার্ট অটো-সিকোয়েন্স"), shortLabel: t("Sequence", "সিকোয়েন্স") },
    { href: "/whatsapp/campaigns/new", icon: PlusCircle, label: t("Create Ad Campaign", "অ্যাড ক্যাম্পেইন তৈরি করুন"), shortLabel: t("Campaigns", "ক্যাম্পেইন") },
  ], [t]);

  const telegramNavItems = React.useMemo(() => [
    { href: "/dashboard", icon: Bot, label: t("Telegram Bots", "টেলিগ্রাম বটসমূহ"), shortLabel: t("Bots", "বটসমূহ") },
    { href: "/bots/new", icon: PlusCircle, label: t("Add New Bot", "নতুন বট যুক্ত করুন"), shortLabel: t("Add Bot", "নতুন বট") },
    { href: "/api-keys", icon: Key, label: t("AI API Keys", "এআই এপিআই কী"), shortLabel: t("API Keys", "এপিআই কী") },
  ], [t]);

  React.useEffect(() => {
    setIsOpen(false);
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/bots') || pathname.startsWith('/api-keys')) {
      setActiveChannel('telegram');
    } else {
      setActiveChannel('whatsapp');
    }
  }, [pathname]);

  React.useEffect(() => {
    const loadAuth = async () => {
      try {
        if (typeof window !== 'undefined' && localStorage.getItem('jalabot_logged_out') === 'true') {
          window.location.assign('/login');
          return;
        }
        const res = await fetch(`/api/auth?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const text = await res.text();
        if (!text || text.trim().startsWith('<')) return;
        const d = JSON.parse(text);
        if (d?.authenticated) {
          // If client logged in within iframe where cookies are restricted, honor local session meta
          try {
            const localMeta = localStorage.getItem('jalabot_session_meta');
            if (localMeta) {
              const parsed = JSON.parse(localMeta);
              if (parsed?.role === 'client' && d.role === 'admin') {
                setAuthData({ ...d, role: 'client', client: { name: parsed.clientName || 'Client', id: parsed.clientId } });
                return;
              }
            }
          } catch {}
          setAuthData(d);
        }
      } catch {}
    };
    loadAuth();
    const timer = setInterval(loadAuth, 25000);
    return () => clearInterval(timer);
  }, []);

  const isAdmin = !authData || authData.role === "admin";
  const clientInfo = authData?.client;
  const remainingDays = clientInfo?.remainingDays;

  const currentNav = activeChannel === 'whatsapp' ? waNavItems : telegramNavItems;

  const handleLogout = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('jalabot_logged_out', 'true');
        localStorage.removeItem('jalabot_session_meta');
        localStorage.removeItem('wa_cached_campaigns');
        localStorage.removeItem('wa_cached_accounts');
        localStorage.removeItem('wa_cached_stats');
        localStorage.removeItem('wa_cached_followup');
        const isHttps = window.location.protocol === 'https:';
        const cookieAttr = isHttps
          ? 'path=/; max-age=0; SameSite=None; Secure; Partitioned'
          : 'path=/; max-age=0; SameSite=Lax';
        document.cookie = `tg-auto-session=; ${cookieAttr}`;
      }
      await fetch('/api/auth', { method: 'DELETE' });
    } catch {}
    if (typeof window !== 'undefined') {
      window.location.assign('/login');
    } else {
      router.push('/login');
    }
  };


  return (
    <>
      {/* Mobile Hamburger Button inside Header Left Slot */}
      <button 
        type="button"
        aria-label="Toggle navigation menu"
        className="md:hidden fixed top-2.5 left-3 z-40 w-9 h-9 flex items-center justify-center rounded-lg bg-card border border-border text-foreground active:scale-95 transition-transform"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Desktop & Drawer Sidebar Panel */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 flex flex-col justify-between bg-card border-r border-border transition-transform duration-200 ease-out select-none",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {/* Brand Header */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
            <Link prefetch={false} href="/whatsapp" className="flex items-center gap-2.5 min-w-0 group">
              <img
                src="/jalabot-logo.svg"
                alt="JalaBot Logo"
                className="w-8 h-8 rounded-lg shrink-0 shadow-xs group-hover:scale-105 transition-transform"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-extrabold tracking-tight text-foreground truncate leading-tight">
                  {t('JalaBot', 'জালাবট')}
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground truncate leading-tight">
                  {t('Automation Suite', 'অটোমেশন স্যুট')}
                </span>
              </div>
            </Link>

            <button 
              aria-label="Close menu"
              className="md:hidden text-muted-foreground hover:text-foreground p-1.5 rounded-lg active:scale-95 transition-transform"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Channel Selector Segment */}
          <div className="p-3 border-b border-border">
            <div className="text-[11px] font-semibold text-muted-foreground px-1 mb-2">
              {t('Active Channel', 'সক্রিয় চ্যানেল')}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveChannel('telegram');
                  router.push('/dashboard');
                }}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap bg-[#0088CC] hover:bg-[#0077B5] dark:bg-[#229ED9] dark:hover:bg-[#1E8CC0] text-white shadow-xs",
                  activeChannel === 'telegram'
                    ? "ring-2 ring-[#0088CC]/40 dark:ring-[#229ED9]/50 ring-offset-1 ring-offset-card"
                    : "opacity-90 hover:opacity-100"
                )}
              >
                <Bot className="w-3.5 h-3.5 shrink-0" />
                <span>{t('Telegram', 'টেলিগ্রাম')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveChannel('whatsapp');
                  router.push('/whatsapp');
                }}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap bg-[#075E54] hover:bg-[#064E46] dark:bg-[#00A884] dark:hover:bg-[#008f6f] text-white dark:text-[#0B141A] shadow-xs",
                  activeChannel === 'whatsapp'
                    ? "ring-2 ring-[#075E54]/40 dark:ring-[#00A884]/50 ring-offset-1 ring-offset-card"
                    : "opacity-90 hover:opacity-100"
                )}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span>{t('WhatsApp', 'হোয়াটসঅ্যাপ')}</span>
              </button>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="p-3 space-y-1 flex-1">
            <div className={cn(
              "text-[11px] font-semibold px-2 py-1",
              activeChannel === 'telegram' ? "text-[#0088CC] dark:text-[#229ED9]" : "text-muted-foreground"
            )}>
              {activeChannel === 'whatsapp' ? t('WhatsApp Management', 'হোয়াটসঅ্যাপ ম্যানেজমেন্ট') : t('Telegram Bot Hub', 'টেলিগ্রাম বট হাব')}
            </div>

            {currentNav.map((item) => {
              const isActive = item.href === '/whatsapp' || item.href === '/dashboard'
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  prefetch={false}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors duration-150",
                    isActive 
                      ? activeChannel === 'telegram'
                        ? "bg-[#0088CC]/12 dark:bg-[#229ED9]/15 text-[#0088CC] dark:text-[#229ED9] font-bold"
                        : "bg-[#075E54]/10 dark:bg-[#00A884]/15 text-[#075E54] dark:text-[#00A884] font-bold" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                </Link>
              );
            })}

            {/* Extra Admin Options */}
            {isAdmin && activeChannel === 'whatsapp' && (
              <div className="pt-2 mt-2 border-t border-border">
                <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1">
                  {t('Administration', 'অ্যাডমিনিস্ট্রেশন')}
                </div>
                <Link
                  prefetch={false}
                  href="/whatsapp/clients"
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors",
                    pathname === '/whatsapp/clients'
                      ? "bg-[#075E54]/10 dark:bg-[#00A884]/15 text-[#075E54] dark:text-[#00A884] font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Users className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t('Clients & Access', 'ক্লায়েন্ট ও অ্যাক্সেস')}</span>
                  </div>
                </Link>
              </div>
            )}
          </nav>
        </div>

        {/* Footer Area with Profile status */}
        <div className="p-3 border-t border-border space-y-2 shrink-0 bg-card">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/70 text-xs">
            <div className="min-w-0">
              <div className="font-bold text-foreground truncate">
                {isAdmin ? t('Admin Account', 'অ্যাডমিন অ্যাকাউন্ট') : (clientInfo?.name || 'Client')}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {isAdmin ? t('Master Access', 'মাস্টার অ্যাক্সেস') : `${remainingDays ?? 30} ${t('days left', 'দিন বাকি')}`}
              </div>
            </div>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#075E54]/10 dark:bg-[#00A884]/15 text-[#075E54] dark:text-[#00A884]">
              {isAdmin ? t('Admin', 'অ্যাডমিন') : t('Client', 'ক্লায়েন্ট')}
            </span>
          </div>

          <button 
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10 cursor-pointer"
            onClick={handleLogout}
          >
            <span className="flex items-center gap-2">
              <LogOut className="h-3.5 w-3.5" />
              <span>{t('Log Out', 'লগ আউট')}</span>
            </span>
          </button>
        </div>

      </aside>

      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Android / Mobile Ergonomic Bottom Navigation Bar */}
      <nav
        aria-label="Mobile quick navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-card/95 backdrop-blur-md border-t border-border flex items-center justify-around px-1 select-none"
      >
        {currentNav.map((item) => {
          const isActive = item.href === '/whatsapp' || item.href === '/dashboard'
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              prefetch={false}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-lg min-w-[64px] transition-colors",
                isActive
                  ? activeChannel === 'telegram'
                    ? "text-[#0088CC] dark:text-[#229ED9] font-bold"
                    : "text-[#075E54] dark:text-[#00A884] font-bold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[10px] truncate max-w-[76px]">{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

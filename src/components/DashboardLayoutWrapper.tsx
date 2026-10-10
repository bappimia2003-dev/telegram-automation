'use client';

import * as React from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ToastProvider } from '@/components/ui/toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { usePathname } from 'next/navigation';
import { Clock, AlertTriangle, User, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

function getHeaderTitle(pathname: string): string {
  if (!pathname || pathname === '/' || pathname === '/dashboard') return 'Dashboard';
  if (pathname === '/api-keys') return 'API Keys';
  if (pathname === '/whatsapp') return 'WhatsApp';
  if (pathname === '/whatsapp/clients') return 'Clients Panel';
  if (pathname === '/whatsapp/new-followup') return 'New Follow-up';
  if (pathname === '/whatsapp/campaigns/new') return 'New Campaign';
  if (pathname.startsWith('/whatsapp/campaigns/')) return 'Campaign Details';
  if (pathname.startsWith('/whatsapp/numbers/')) return 'WhatsApp Device';
  if (pathname === '/bots/new') return 'New Bot';
  if (pathname.startsWith('/bots/') && pathname.endsWith('/settings')) return 'Bot Settings';
  if (pathname.startsWith('/bots/')) return 'Manage Bot';

  const parts = pathname.split('/').filter(Boolean);
  const lastPart = parts.pop() || '';
  if (/^[0-9a-fA-F-]{8,}$/.test(lastPart) || /^[0-9]+$/.test(lastPart)) {
    const parentPart = parts.pop();
    if (parentPart) {
      return parentPart.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return '';
  }

  return lastPart.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const displayTitle = getHeaderTitle(pathname);
  const [authData, setAuthData] = React.useState<any>(null);

  React.useEffect(() => {
    const loadAuth = () => {
      fetch(`/api/auth?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (d?.authenticated) setAuthData(d);
        })
        .catch(() => {});
    };
    loadAuth();
    const timer = setInterval(loadAuth, 15000);
    return () => clearInterval(timer);
  }, []);

  const isClient = authData?.role === 'client';
  const clientInfo = authData?.client;
  const remainingDays = clientInfo?.remainingDays;
  const isExpired = clientInfo?.isExpired;

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[#F4F1EB] dark:bg-[#111215] text-gray-900 dark:text-gray-100 relative transition-colors duration-200">
        <Sidebar />
        
        <div className="flex-1 md:ml-64 flex flex-col min-h-screen w-full min-w-0">
          <header className="h-16 border-b border-[#E6E2D8] dark:border-[#1F2429] bg-[#F4F1EB] dark:bg-[#111215] flex items-center justify-between px-4 sm:px-6 md:px-8 sticky top-0 z-20 transition-colors duration-200">
            <div className="flex items-center gap-3 pl-12 md:pl-0">
              {displayTitle && (
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                  {displayTitle}
                </h2>
              )}
            </div>
            
            <div className="flex items-center space-x-2.5 sm:space-x-3.5">
              {/* Day / Night Theme Toggle */}
              <ThemeToggle />

              {/* Profile Pill with Pop-up Day Counter Badge */}
              {isClient && clientInfo ? (
                <div className="relative pt-1">
                  {remainingDays !== null && remainingDays !== undefined && (
                    <span
                      className={cn(
                        "absolute -top-2 -right-1 z-10 px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-tight shadow-sm border flex items-center gap-1 leading-none",
                        isExpired || remainingDays <= 0
                          ? "bg-red-600 text-white border-red-400 animate-pulse"
                          : remainingDays <= 5
                          ? "bg-amber-500 text-white border-amber-300"
                          : "bg-[#164E43] text-white border-[#227968]"
                      )}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      <span>{isExpired || remainingDays <= 0 ? '0d (Off)' : `${remainingDays} Days`}</span>
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#1B1D1A] dark:text-[#E9EEF2] bg-[#FAF8F5] dark:bg-[#181A1F] px-3.5 py-1.5 rounded-full border border-[#E6E2D8] dark:border-[#262930] shadow-sm">
                    <span
                      className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        isExpired ? "bg-red-500" : "bg-[#15803D] dark:bg-[#10B981] animate-pulse"
                      )}
                    />
                    <User className="w-3.5 h-3.5 text-[#164E43] dark:text-[#34D399]" />
                    <span className="truncate max-w-[110px] sm:max-w-[160px]">{clientInfo.name}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center text-xs sm:text-sm font-bold text-[#164E43] dark:text-[#34D399] bg-[#FAF8F5] dark:bg-[#181A1F] px-3.5 py-1.5 rounded-full border border-[#E6E2D8] dark:border-[#262930] shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#15803D] dark:bg-[#10B981] mr-2 animate-pulse" />
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
                  <span className="hidden sm:inline">System Active</span>
                  <span className="sm:hidden">Active</span>
                </div>
              )}
            </div>
          </header>

          {/* Expired Subscription Banner for Clients */}
          {isClient && isExpired && (
            <div className="bg-red-600/10 dark:bg-red-950/40 border-b border-red-500/30 px-4 sm:px-8 py-2.5 flex items-center justify-between text-xs sm:text-sm text-red-700 dark:text-red-300 font-semibold">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>
                  আপনার সাবস্ক্রিপশনের নির্ধারিত সময় শেষ হয়ে গেছে (0 Days Left)। সকল ক্যাম্পেইন স্বয়ংক্রিয়ভাবে অফ হয়ে গেছে। পুনরায় চালু করতে অ্যাডমিনের সাথে যোগাযোগ করুন।
                </span>
              </div>
            </div>
          )}

          <main className="flex-1 p-4 sm:p-6 md:p-8 w-full">
            <div className="max-w-6xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

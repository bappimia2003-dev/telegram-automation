'use client';

import * as React from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ToastProvider } from '@/components/ui/toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/components/LanguageProvider';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Plus, ChevronRight } from 'lucide-react';

function getBreadcrumb(pathname: string, t: (en: string, bn: string) => string): { channel: string; page: string } {
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/bots') || pathname.startsWith('/api-keys')) {
    if (pathname === '/dashboard') return { channel: t('Telegram', 'টেলিগ্রাম'), page: t('Bots Overview', 'বট ওভারভিউ') };
    if (pathname === '/bots/new') return { channel: t('Telegram', 'টেলিগ্রাম'), page: t('New Bot', 'নতুন বট') };
    if (pathname === '/api-keys') return { channel: t('Telegram', 'টেলিগ্রাম'), page: t('API Keys', 'এপিআই কী') };
    return { channel: t('Telegram', 'টেলিগ্রাম'), page: t('Bot Settings', 'বট সেটিংস') };
  }
  if (pathname === '/whatsapp/clients') return { channel: t('WhatsApp', 'হোয়াটসঅ্যাপ'), page: t('Clients Management', 'ক্লায়েন্ট ম্যানেজমেন্ট') };
  if (pathname === '/whatsapp/new-followup') return { channel: t('WhatsApp', 'হোয়াটসঅ্যাপ'), page: t('Smart Sequence', 'স্মার্ট সিকোয়েন্স') };
  if (pathname === '/whatsapp/targeted-followup') return { channel: t('WhatsApp', 'হোয়াটসঅ্যাপ'), page: t('Targeted Follow-up', 'টার্গেটেড ফলো-আপ') };
  if (pathname === '/whatsapp/campaigns/new') return { channel: t('WhatsApp', 'হোয়াটসঅ্যাপ'), page: t('New Campaign', 'নতুন ক্যাম্পেইন') };
  if (pathname.startsWith('/whatsapp/campaigns/')) return { channel: t('WhatsApp', 'হোয়াটসঅ্যাপ'), page: t('Campaign Details', 'ক্যাম্পেইনের বিবরণ') };
  if (pathname.startsWith('/whatsapp/numbers/')) return { channel: t('WhatsApp', 'হোয়াটসঅ্যাপ'), page: t('Device Console', 'ডিভাইস কনসোল') };
  return { channel: t('WhatsApp', 'হোয়াটসঅ্যাপ'), page: t('Overview & Campaigns', 'ওভারভিউ ও ক্যাম্পেইন') };
}

export function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const breadcrumb = getBreadcrumb(pathname, t);
  const isWhatsApp = !pathname.startsWith('/dashboard') && !pathname.startsWith('/bots') && !pathname.startsWith('/api-keys');

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-background text-foreground transition-colors duration-150">
        <Sidebar />
        
        <div className="flex-1 md:ml-64 flex flex-col min-h-screen w-full min-w-0">
          {/* Sticky Top Bar following Top Bar Contract */}
          <header className="h-14 border-b border-border bg-card/90 backdrop-blur-md flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 sticky top-0 z-20">
            {/* Zone 1: Mobile Brand + Contextual Breadcrumb */}
            <div className="flex items-center gap-2 pl-10 md:pl-0 text-xs sm:text-sm min-w-0">
              <Link prefetch={false} href="/whatsapp" className="flex md:hidden items-center gap-1.5 shrink-0 mr-1">
                <img
                  src="/jalabot-logo.svg"
                  alt="JalaBot"
                  className="w-6 h-6 rounded-md shrink-0"
                />
                <span className="font-extrabold text-foreground tracking-tight">
                  {t('JalaBot', 'জালাবট')}
                </span>
              </Link>
              <span className="hidden sm:inline text-muted-foreground font-medium whitespace-nowrap shrink-0">
                {breadcrumb.channel}
              </span>
              <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
              <span className="font-bold text-foreground truncate">
                {breadcrumb.page}
              </span>
            </div>

            {/* Zone 3: Language Toggle + Day/Night Toggle + 1 Primary CTA */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Bangla / English Language Toggle */}
              <LanguageToggle />

              {/* Day / Night Theme Toggle */}
              <ThemeToggle />

              <div className="h-4 w-px bg-border hidden sm:block" />

              {/* Quick Primary CTA */}
              {isWhatsApp ? (
                <Link prefetch={false} href="/whatsapp/campaigns/new" className="shrink-0">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 h-8 bg-[#075E54] hover:bg-[#064E46] dark:bg-[#00A884] dark:hover:bg-[#008f6f] text-white dark:text-[#0B141A] px-3 rounded-lg text-xs font-bold transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">{t('New Campaign', 'নতুন ক্যাম্পেইন')}</span>
                    <span className="sm:hidden">{t('Create', 'তৈরি করুন')}</span>
                  </button>
                </Link>
              ) : (
                <Link prefetch={false} href="/bots/new" className="shrink-0">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 h-8 bg-[#0088CC] hover:bg-[#0077B5] dark:bg-[#229ED9] dark:hover:bg-[#1E8CC0] text-white px-3 rounded-lg text-xs font-bold transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('New Bot', 'নতুন বট')}</span>
                  </button>
                </Link>
              )}
            </div>
          </header>

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 pb-20 md:pb-10 w-full max-w-[1440px] mx-auto">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

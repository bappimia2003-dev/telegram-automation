'use client';

import * as React from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ToastProvider } from '@/components/ui/toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { usePathname } from 'next/navigation';

function getHeaderTitle(pathname: string): string {
  if (!pathname || pathname === '/' || pathname === '/dashboard') return 'Dashboard';
  if (pathname === '/api-keys') return 'API Keys';
  if (pathname === '/whatsapp') return 'WhatsApp';
  if (pathname === '/whatsapp/new-followup') return 'New Follow-up';
  if (pathname === '/whatsapp/campaigns/new') return 'New Campaign';
  if (pathname.startsWith('/whatsapp/campaigns/')) return 'Campaign Details';
  if (pathname.startsWith('/whatsapp/numbers/')) return 'WhatsApp Device';
  if (pathname === '/bots/new') return 'New Bot';
  if (pathname.startsWith('/bots/') && pathname.endsWith('/settings')) return 'Bot Settings';
  if (pathname.startsWith('/bots/')) return 'Manage Bot';

  const parts = pathname.split('/').filter(Boolean);
  const lastPart = parts.pop() || '';
  // Never display raw UUIDs, hexadecimal strings or numeric IDs in the header
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
            
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Day / Night Theme Toggle */}
              <ThemeToggle />

              {/* System Active Badge (High-contrast badge from screenshots) */}
              <div className="flex items-center text-xs sm:text-sm font-bold text-[#164E43] dark:text-[#34D399] bg-[#FAF8F5] dark:bg-[#181A1F] px-3.5 py-1.5 rounded-full border border-[#E6E2D8] dark:border-[#262930] shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-[#15803D] dark:bg-[#10B981] mr-2 animate-pulse" />
                <span className="hidden sm:inline">System Active</span>
                <span className="sm:hidden">Active</span>
              </div>
            </div>
          </header>

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

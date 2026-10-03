'use client';

import * as React from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ToastProvider } from '@/components/ui/toast';
import { usePathname } from 'next/navigation';

export function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Format pathname for top bar title
  const parts = pathname.split('/').filter(Boolean);
  const lastPart = parts.pop()?.replace(/-/g, ' ') || 'Dashboard';
  const displayTitle = lastPart.charAt(0).toUpperCase() + lastPart.slice(1);

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-background text-foreground relative">
        <Sidebar />
        
        <div className="flex-1 md:ml-64 flex flex-col min-h-screen w-full min-w-0">
          <header className="h-16 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 md:px-8 sticky top-0 z-20">
            <div className="flex items-center gap-3 pl-12 md:pl-0">
              <h2 className="text-base sm:text-lg font-semibold capitalize text-foreground truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                {displayTitle}
              </h2>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="flex items-center text-xs sm:text-sm text-green-500 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                <span className="hidden sm:inline">System Active</span>
                <span className="sm:hidden">Active</span>
              </span>
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

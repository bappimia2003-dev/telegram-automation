'use client';

import { Sidebar } from '@/components/Sidebar';
import { ToastProvider } from '@/components/ui/toast';
import { usePathname } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Format pathname for top bar title
  const title = pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Dashboard';
  const displayTitle = title.charAt(0).toUpperCase() + title.slice(1);

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 ml-64 flex flex-col min-h-screen">
          <header className="h-16 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10">
            <div>
              <h2 className="text-lg font-semibold capitalize text-foreground">{displayTitle}</h2>
            </div>
            <div className="flex items-center space-x-4">
              <span className="flex items-center text-sm text-green-500 bg-green-500/10 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                System Active
              </span>
            </div>
          </header>
          <main className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

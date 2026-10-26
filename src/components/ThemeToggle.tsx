'use client';

import * as React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useLanguage } from './LanguageProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleTheme();
      }}
      title={isDark ? t('Switch to Day Mode', 'ডে মোডে পরিবর্তন করুন') : t('Switch to Night Mode', 'নাইট মোডে পরিবর্তন করুন')}
      aria-label="Toggle theme mode"
      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold transition-all duration-150 border border-border bg-secondary/70 hover:bg-secondary text-foreground active:scale-95 cursor-pointer select-none whitespace-nowrap shrink-0"
    >
      {mounted ? (
        isDark ? (
          <>
            <Moon className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
            <span>{t('Night', 'রাত')}</span>
          </>
        ) : (
          <>
            <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
            <span>{t('Day', 'দিন')}</span>
          </>
        )
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
          <span>{t('Night', 'রাত')}</span>
        </>
      )}
    </button>
  );
}

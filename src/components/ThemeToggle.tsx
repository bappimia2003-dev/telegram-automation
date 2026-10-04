'use client';

import * as React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
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
      title={isDark ? "Switch to Day Mode" : "Switch to Night Mode"}
      aria-label="Toggle theme mode"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border border-[#E6E2D8] dark:border-[#2A3038] bg-[#FAF8F5] dark:bg-[#1A1D22] text-gray-800 dark:text-gray-200 hover:shadow-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)] cursor-pointer select-none"
    >
      {mounted ? (
        isDark ? (
          <>
            <Moon className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>Night</span>
          </>
        ) : (
          <>
            <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>Day</span>
          </>
        )
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span>Night</span>
        </>
      )}
    </button>
  );
}

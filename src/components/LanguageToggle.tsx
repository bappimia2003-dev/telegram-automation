'use client';

import * as React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

export function LanguageToggle() {
  const { lang, toggleLanguage } = useLanguage();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isBangla = mounted && lang === 'bn';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLanguage();
      }}
      title={isBangla ? 'Switch language to English' : 'ভাষা বাংলায় পরিবর্তন করুন (Switch to Bangla)'}
      aria-label="Toggle language between English and Bangla"
      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold transition-all duration-150 border border-border bg-secondary/70 hover:bg-secondary text-foreground active:scale-95 cursor-pointer select-none whitespace-nowrap shrink-0"
    >
      <Languages className="w-3.5 h-3.5 text-[#075E54] dark:text-[#00A884] shrink-0" />
      <span className="font-bold tracking-tight">
        {isBangla ? 'English' : 'বাংলা'}
      </span>
    </button>
  );
}

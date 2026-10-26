import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono, Hind_Siliguri } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import { LanguageProvider } from '@/components/LanguageProvider';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
});

const hindSiliguri = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bangla',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#0B141A' },
  ],
};

export const metadata: Metadata = {
  title: 'JalaBot — WhatsApp & Telegram Automation Suite',
  description: 'JalaBot International Multi-Channel WhatsApp Business & Telegram Automation Platform',
  icons: {
    icon: '/jalabot-logo.svg',
    shortcut: '/jalabot-logo.svg',
    apple: '/jalabot-logo.svg',
  },
};

const themeScript = `
  try {
    const saved = localStorage.getItem('app-theme');
    if (saved === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
    const savedLang = localStorage.getItem('app-language');
    if (savedLang === 'bn' || savedLang === 'en') {
      document.documentElement.lang = savedLang;
      document.documentElement.setAttribute('data-lang', savedLang);
    }
  } catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${plusJakarta.variable} ${jetbrainsMono.variable} ${hindSiliguri.variable} font-sans antialiased min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-[#00A884]/20`}>
        <ThemeProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

export type Language = 'en' | 'bn';

interface LanguageContextType {
  lang: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (en: string, bn: string) => string;
}

// Comprehensive English <-> Bangla dictionary for instant full-app translation
const EN_TO_BN: Record<string, string> = {
  // Brand & Sidebar
  'JalaBot': 'জালাবট',
  'Automation Suite': 'অটোমেশন স্যুট',
  'WA Automation': 'হোয়াটসঅ্যাপ অটোমেশন',
  'Enterprise Suite': 'এন্টারপ্রাইজ স্যুট',
  'Active Channel': 'সক্রিয় চ্যানেল',
  'WhatsApp': 'হোয়াটসঅ্যাপ',
  'Telegram': 'টেলিগ্রাম',
  'WhatsApp Management': 'হোয়াটসঅ্যাপ ম্যানেজমেন্ট',
  'Telegram Bot Hub': 'টেলিগ্রাম বট হাব',
  'Overview & Dashboard': 'ওভারভিউ ও ড্যাশবোর্ড',
  'Targeted Follow-up': 'টার্গেটেড ফলো-আপ',
  'Smart Auto-Sequence': 'স্মার্ট অটো-সিকোয়েন্স',
  'Create Ad Campaign': 'অ্যাড ক্যাম্পেইন তৈরি করুন',
  'Telegram Bots': 'টেলিগ্রাম বটসমূহ',
  'Add New Bot': 'নতুন বট যুক্ত করুন',
  'Gemini API Keys': 'জেমিনি এপিআই কী',
  'Administration': 'অ্যাডমিনিস্ট্রেশন',
  'Clients & Access': 'ক্লায়েন্ট ও অ্যাক্সেস',
  'System Online': 'সিস্টেম অনলাইন',
  'Admin Mode (No Login)': 'অ্যাডমিন মোড (লগইন ছাড়া)',
  'Reset Session': 'সেশন রিসেট করুন',
  'Overview': 'ওভারভিউ',
  'Targeted': 'টার্গেটেড',
  'Sequence': 'সিকোয়েন্স',
  'Campaigns': 'ক্যাম্পেইন',

  // Top Bar Breadcrumbs & Actions
  'Overview & Campaigns': 'ওভারভিউ ও ক্যাম্পেইন',
  'Clients Management': 'ক্লায়েন্ট ম্যানেজমেন্ট',
  'Smart Sequence': 'স্মার্ট সিকোয়েন্স',
  'New Campaign': 'নতুন ক্যাম্পেইন',
  'Campaign Details': 'ক্যাম্পেইনের বিবরণ',
  'Device Console': 'ডিভাইস কনসোল',
  'Bots Overview': 'বট ওভারভিউ',
  'New Bot': 'নতুন বট',
  'API Keys': 'এপিআই কী',
  'Bot Settings': 'বট সেটিংস',
  'Engine Active': 'ইঞ্জিন সচল',
  'Create': 'তৈরি করুন',
  'Day': 'দিন',
  'Night': 'রাত',

  // WhatsApp Dashboard
  'WhatsApp Business Command': 'হোয়াটসঅ্যাপ বিজনেস কমান্ড সেন্টার',
  'Manage multi-SIM connections, automated auto-replies, and scheduled delivery campaigns': 'মাল্টি-সিম সংযোগ, স্বয়ংক্রিয় অটো-রিপ্লাই এবং শিডিউলড মেসেজ ক্যাম্পেইন পরিচালনা করুন',
  'Connect Device': 'ডিভাইস যুক্ত করুন',
  'Create Campaign': 'ক্যাম্পেইন তৈরি করুন',
  'Connected Numbers': 'সংযুক্ত নাম্বারসমূহ',
  'registered devices': 'নিবন্ধিত ডিভাইস',
  'Active Campaigns': 'সচল ক্যাম্পেইন',
  'Messages Sent': 'প্রেরিত মেসেজ',
  'Delivered via Baileys engine': 'বেইলিস ইঞ্জিনের মাধ্যমে ডেলিভারকৃত',
  'Unique Leads': 'ইউনিক কাস্টমার লিড',
  'Direct customer inquiries': 'সরাসরি কাস্টমার ইনবক্স মেসেজ',
  'Connected WhatsApp Numbers': 'সংযুক্ত হোয়াটসঅ্যাপ নাম্বারসমূহ',
  'Add WhatsApp Number': 'হোয়াটসঅ্যাপ নাম্বার যুক্ত করুন',
  'No WhatsApp numbers added yet': 'এখনো কোনো হোয়াটসঅ্যাপ নাম্বার যুক্ত করা হয়নি',
  'Primary WhatsApp': 'প্রাইমারি হোয়াটসঅ্যাপ',
  'Device linked': 'ডিভাইস সংযুক্ত',
  'No phone linked': 'ফোন সংযুক্ত নেই',
  'Active': 'সচল',
  'Scan QR': 'কিউআর স্ক্যান',
  'Offline': 'অফলাইন',
  'Status': 'স্ট্যাটাস',
  'Online & Active': 'অনলাইন ও সচল',
  'Open Dashboard': 'ড্যাশবোর্ড খুলুন',
  'Open Dashboard (ম্যানেজ করুন)': 'ড্যাশবোর্ড খুলুন (ম্যানেজ করুন)',
  'Scan QR Code': 'কিউআর কোড স্ক্যান করুন',
  'Disconnect': 'সংযোগ বিচ্ছিন্ন করুন',
  'Campaigns Directory': 'ক্যাম্পেইন তালিকা',
  'Activate': 'সচল করুন',
  'Pause': 'বিরতি দিন',
  'All': 'সবগুলো',
  'Paused': 'বিরতি',
  'Device:': 'ডিভাইস:',
  'All Devices': 'সকল ডিভাইস',
  'All Numbers': 'সকল নাম্বার',
  'No campaigns match your filters': 'আপনার ফিল্টারের সাথে কোনো ক্যাম্পেইন মেলেনি',
  'Try clearing your search query or switching filters.': 'সার্চ ক্লিয়ার করুন অথবা ফিল্টার পরিবর্তন করে দেখুন।',
  'Create your first campaign to begin automated messaging.': 'স্বয়ংক্রিয় মেসেজিং শুরু করতে আপনার প্রথম ক্যাম্পেইন তৈরি করুন।',
  'Campaign & Trigger': 'ক্যাম্পেইন ও ট্রিগার',
  'Device / Account': 'ডিভাইস / অ্যাকাউন্ট',
  'Device & Number': 'ডিভাইস ও নাম্বার',
  'Connection': 'সংযোগ',
  'Webhook Status': 'ওয়েবহুক স্ট্যাটাস',
  'Webhook': 'ওয়েবহুক',
  'Webhook:': 'ওয়েবহুক:',
  'Delivery Rate': 'ডেলিভারি রেট',
  'Delivery Rate:': 'ডেলিভারি রেট:',
  'Sent / Camps': 'প্রেরিত / ক্যাম্পেইন',
  'Synced': 'সিঙ্কড',
  'Listening': 'লিসেনিং',
  'Standby': 'স্ট্যান্ডবাই',
  'Muted': 'মিউট',
  'Awaiting QR': 'কিউআর অপেক্ষমান',
  'Handshake': 'হ্যান্ডশেক',
  'Idle': 'নিষ্ক্রিয়',
  'Wait SIM': 'সিম অপেক্ষমান',
  'Online': 'অনলাইন',
  'Unlinked': 'অসংযুক্ত',
  'Console': 'কনসোল',
  'Add SIM': 'সিম যুক্ত',
  'Dashboard': 'ড্যাশবোর্ড',
  'Delivered': 'ডেলিভারকৃত',
  'Actions': 'অ্যাকশন',
  'Default Fallback': 'ডিফল্ট ক্যাম্পেইন',
  '· Default Fallback': '· ডিফল্ট ক্যাম্পেইন',
  'Auto-Send Sequence': 'অটো-সেন্ড সিকোয়েন্স',
  'Live Message Delivery Activity': 'লাইভ মেসেজ ডেলিভারি লগ',
  'Failed': 'ব্যর্থ',
  'Loading recent message dispatches...': 'সাম্প্রতিক মেসেজ লগ লোড হচ্ছে...',
  'No delivery logs match your search.': 'আপনার সার্চের সাথে কোনো ডেলিভারি লগ মেলেনি।',
  'No message activity recorded yet. Inbound triggers will appear here in real-time.': 'এখনো কোনো মেসেজ লগ রেকর্ড হয়নি। রিয়েল-টাইম মেসেজ এখানে দেখা যাবে।',

  // Number Detail & QR Scanner
  'Back to WhatsApp Dashboard': 'হোয়াটসঅ্যাপ ড্যাশবোর্ডে ফিরে যান',
  'Edit Name & Phone': 'নাম ও নাম্বার পরিবর্তন',
  'Connected': 'সংযুক্ত',
  'Scan Required': 'স্ক্যান প্রয়োজন',
  'Disconnected': 'সংযোগ বিচ্ছিন্ন',
  'No phone linked yet - scan QR code below': 'এখনো ফোন সংযুক্ত হয়নি — নিচের কিউআর কোডটি স্ক্যান করুন',
  'Disconnect Device': 'ডিভাইস বিচ্ছিন্ন করুন',
  'Refresh Connection': 'সংযোগ রিফ্রেশ করুন',
  'Assigned Campaigns': 'নির্ধারিত ক্যাম্পেইন',
  'Delivered by Number': 'এই নাম্বার থেকে প্রেরিত',
  'Campaigns on this Number': 'এই নাম্বারের ক্যাম্পেইনসমূহ',
  'Add Campaign': 'ক্যাম্পেইন যুক্ত করুন',
  'No campaigns assigned to this number yet': 'এই নাম্বারে এখনো কোনো ক্যাম্পেইন যুক্ত করা হয়নি',
  'Create Campaign for this Number': 'এই নাম্বারের জন্য ক্যাম্পেইন তৈরি করুন',
  'Recent Delivery Logs': 'সাম্প্রতিক ডেলিভারি লগ',
  'No message logs yet for this number.': 'এই নাম্বারের জন্য এখনো কোনো মেসেজ লগ নেই।',
  'Edit Number Details': 'নাম্বারের তথ্য পরিবর্তন করুন',
  'Update SIM nickname or phone number': 'সিমের নাম অথবা ফোন নাম্বার আপডেট করুন',
  'SIM / Account Nickname *': 'সিম / অ্যাকাউন্টের নাম *',
  'WhatsApp Phone Number': 'হোয়াটসঅ্যাপ ফোন নাম্বার',
  'Cancel': 'বাতিল করুন',
  'Update Details': 'আপডেট করুন',
  'Saving...': 'সংরক্ষণ হচ্ছে...',
  'Generating QR session...': 'কিউআর সেশন তৈরি হচ্ছে...',
  'Establishing secure Baileys handshake with WhatsApp': 'হোয়াটসঅ্যাপের সাথে সুরক্ষিত সংযোগ স্থাপন করা হচ্ছে',
  'Camera scan active': 'ক্যামেরা স্ক্যান সচল',
  'Force Refresh QR Code': 'কিউআর কোড পুনরায় লোড করুন',
  'Refreshing...': 'রিফ্রেশ হচ্ছে...',
  'Pair Device': 'ডিভাইস পেয়ার করুন',
  'Scan with WhatsApp on your phone': 'আপনার ফোনের হোয়াটসঅ্যাপ দিয়ে স্ক্যান করুন',
  'Follow the instructions below to link this number with 24/7 automated auto-replies.': '২৪/৭ স্বয়ংক্রিয় অটো-রিপ্লাই চালু করতে নিচের নির্দেশনা অনুসরণ করে নাম্বারটি যুক্ত করুন।',
  'Connection Handshake': 'সংযোগের ধাপসমূহ',
  '1. QR Active': '১. কিউআর প্রস্তুত',
  'Ready for camera': 'স্ক্যানের জন্য প্রস্তুত',
  '2. Scan Screen': '২. স্ক্রিন স্ক্যান করুন',
  'Point camera now': 'ক্যামেরা ধরুন',
  '3. Authenticate': '৩. যাচাইকরণ',
  'Sync encryption key': 'সেশন সিঙ্ক হচ্ছে',

  // Telegram Dashboard & Modals
  'Telegram Bot Infrastructure': 'টেলিগ্রাম বট ইনফ্রাস্ট্রাকচার',
  'Manage automated Telegram bots, webhook triggers, and AI responses': 'স্বয়ংক্রিয় টেলিগ্রাম বট, ওয়েবহুক ট্রিগার এবং এআই রেসপন্স পরিচালনা করুন',
  'Configure multi-model Gemini bots, webhook endpoints, and automated responder rules': 'মাল্টি-মডেল জেমিনি বট, ওয়েবহুক এবং স্বয়ংক্রিয় রিপ্লাই রুলস কনফিগার করুন',
  'Total Bots': 'মোট বট',
  'Active Bots': 'সচল বট',
  'Total Messages': 'মোট মেসেজ',
  'Messages Handled': 'প্রসেসকৃত মেসেজ',
  'Configured API Keys': 'কনফিগারকৃত এপিআই কী',
  'Configured Bots': 'কনফিগারকৃত বটসমূহ',
  'No bots created yet': 'এখনো কোনো বট তৈরি করা হয়নি',
  'Connect a Telegram bot token to get started.': 'শুরু করতে একটি টেলিগ্রাম বট টোকেন যুক্ত করুন।',
  'Create First Bot': 'প্রথম বট তৈরি করুন',
  'Configured bots': 'কনফিগারকৃত বট',
  'Currently running': 'বর্তমানে সচল',
  'Processed across all bots': 'সকল বটের মাধ্যমে প্রসেসকৃত',
  'Available for rotation': 'রোটেশনের জন্য প্রস্তুত',
  'Your Bots': 'আপনার বটসমূহ',
  'No bots configured': 'কোনো বট কনফিগার করা হয়নি',
  'Get started by creating your first automated Telegram bot.': 'আপনার প্রথম স্বয়ংক্রিয় টেলিগ্রাম বট তৈরি করে শুরু করুন।',
  'Link a new WhatsApp SIM or Business device': 'নতুন হোয়াটসঅ্যাপ সিম বা বিজনেস ডিভাইস যুক্ত করুন',
  'WhatsApp Phone Number (Optional)': 'হোয়াটসঅ্যাপ ফোন নাম্বার (ঐচ্ছিক)',
  'Save & Get QR Code': 'সেভ করুন ও কিউআর কোড নিন',
  'Creating...': 'তৈরি হচ্ছে...',
  'Successfully Connected!': 'সফলভাবে সংযুক্ত হয়েছে!',
  'Done': 'সম্পন্ন',
  'Manage & Logs': 'ম্যানেজ ও লগ',
  'Auto delay': 'অটো ডিলে',
  '3-Step Follow-up': '৩-ধাপ ফলো-আপ',
  'Keywords:': 'কীওয়ার্ডসমূহ:',
  'Text': 'টেক্সট',
  'Image': 'ছবি',
  'Audio': 'অডিও',
  'Video': 'ভিডিও',
  'Document': 'ডকুমেন্ট',
};

const BN_TO_EN: Record<string, string> = Object.entries(EN_TO_BN).reduce((acc, [en, bn]) => {
  acc[bn] = en;
  return acc;
}, {} as Record<string, string>);

const PLACEHOLDER_EN_TO_BN: Record<string, string> = {
  'Search campaigns...': 'ক্যাম্পেইন খুঁজুন...',
  'Filter recipient phone...': 'প্রাপকের নাম্বার খুঁজুন...',
  'e.g. 8801712345678': 'উদাঃ 8801712345678',
  'e.g. Sales Support SIM 2': 'উদাঃ সেলস সাপোর্ট সিম ২',
};

const PLACEHOLDER_BN_TO_EN: Record<string, string> = Object.entries(PLACEHOLDER_EN_TO_BN).reduce(
  (acc, [en, bn]) => {
    acc[bn] = en;
    return acc;
  },
  {} as Record<string, string>
);

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  toggleLanguage: () => {},
  setLanguage: () => {},
  t: (en) => en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');
  const langRef = useRef<Language>('en');
  langRef.current = lang;

  useEffect(() => {
    try {
      const saved = localStorage.getItem('app-language') as Language | null;
      if (saved === 'bn' || saved === 'en') {
        setLangState(saved);
        document.documentElement.lang = saved;
        document.documentElement.setAttribute('data-lang', saved);
      }
    } catch {}
  }, []);

  const translateDomNode = useCallback((root: Node, targetLang: Language) => {
    if (typeof window === 'undefined') return;
    const dict = targetLang === 'bn' ? EN_TO_BN : BN_TO_EN;
    const placeholderDict = targetLang === 'bn' ? PLACEHOLDER_EN_TO_BN : PLACEHOLDER_BN_TO_EN;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const parentTag = node.parentElement?.tagName;
      if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'TEXTAREA' || parentTag === 'CODE') {
        continue;
      }
      const raw = node.nodeValue || '';
      const trimmed = raw.trim();
      if (!trimmed) continue;

      if (dict[trimmed]) {
        node.nodeValue = raw.replace(trimmed, dict[trimmed]);
      } else if (targetLang === 'bn') {
        // Dynamic pattern translations (e.g. "Out of 5 total", "3 registered devices")
        const outOfMatch = trimmed.match(/^Out of (\d+) total$/);
        if (outOfMatch) {
          node.nodeValue = raw.replace(trimmed, `মোট ${outOfMatch[1]}টির মধ্যে`);
          continue;
        }
        const regMatch = trimmed.match(/^(\d+) registered devices$/);
        if (regMatch) {
          node.nodeValue = raw.replace(trimmed, `${regMatch[1]}টি নিবন্ধিত ডিভাইস`);
          continue;
        }
        const syncMatch = trimmed.match(/^Auto-sync in (\d+)s$/);
        if (syncMatch) {
          node.nodeValue = raw.replace(trimmed, `অটো-সিঙ্ক ${syncMatch[1]} সেকেন্ডে`);
          continue;
        }
      } else if (targetLang === 'en') {
        const outOfBn = trimmed.match(/^মোট (\d+)টির মধ্যে$/);
        if (outOfBn) {
          node.nodeValue = raw.replace(trimmed, `Out of ${outOfBn[1]} total`);
          continue;
        }
        const regBn = trimmed.match(/^(\d+)টি নিবন্ধিত ডিভাইস$/);
        if (regBn) {
          node.nodeValue = raw.replace(trimmed, `${regBn[1]} registered devices`);
          continue;
        }
        const syncBn = trimmed.match(/^অটো-সিঙ্ক (\d+) সেকেন্ডে$/);
        if (syncBn) {
          node.nodeValue = raw.replace(trimmed, `Auto-sync in ${syncBn[1]}s`);
          continue;
        }
      }
    }

    if (root instanceof Element || root instanceof Document) {
      const inputs = (root as Element | Document).querySelectorAll?.('input[placeholder], textarea[placeholder]');
      inputs?.forEach((el) => {
        const ph = el.getAttribute('placeholder')?.trim();
        if (ph && placeholderDict[ph]) {
          el.setAttribute('placeholder', placeholderDict[ph]);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.lang = lang;
    document.documentElement.setAttribute('data-lang', lang);

    translateDomNode(document.body, lang);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((added) => {
            translateDomNode(added, langRef.current);
          });
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [lang, translateDomNode]);

  const setLanguage = useCallback((nextLang: Language) => {
    setLangState(nextLang);
    try {
      localStorage.setItem('app-language', nextLang);
    } catch {}
  }, []);

  const toggleLanguage = useCallback(() => {
    setLangState((prev) => {
      const next = prev === 'en' ? 'bn' : 'en';
      try {
        localStorage.setItem('app-language', next);
      } catch {}
      return next;
    });
  }, []);

  const t = useCallback(
    (en: string, bn: string) => {
      return lang === 'bn' ? bn : en;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, toggleLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);

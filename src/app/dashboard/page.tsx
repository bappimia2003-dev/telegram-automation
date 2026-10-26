'use client';

import { useState, useEffect, useRef } from 'react';
import { StatsCard } from '@/components/StatsCard';
import { BotCard } from '@/components/BotCard';
import { useLanguage } from '@/components/LanguageProvider';
import {
  Bot,
  Activity,
  MessageSquare,
  Key,
  Plus,
  Smartphone,
  AlertTriangle,
  Trash2,
  Loader2,
  X,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function DashboardPage() {
  const { t } = useLanguage();
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteBot, setConfirmDeleteBot] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [countdown, setCountdown] = useState<number>(3);
  const [deleteProgress, setDeleteProgress] = useState<number>(0);
  const [deleteStage, setDeleteStage] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [stats, setStats] = useState({
    totalBots: 0,
    activeBots: 0,
    totalMessages: 0,
    apiKeys: 0
  });

  const fetchDashboardData = async () => {
    try {
      const [botsRes, statsRes] = await Promise.all([
        fetch(`/api/bots?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/stats?t=${Date.now()}`, { cache: 'no-store' })
      ]);
      const botsData = await botsRes.json().catch(() => []);
      const statsData = await statsRes.json().catch(() => ({}));
      const botList = Array.isArray(botsData) ? botsData : botsData.bots || [];
      setBots(botList);
      
      const activeCount = botList.filter((b: any) => b.isActive || b.status === 'active' || b.status === 'Active').length;
      setStats({
        totalBots: statsData.totalBots ?? botList.length,
        activeBots: statsData.activeBots ?? activeCount,
        totalMessages: statsData.totalMessages ?? botList.reduce((acc: number, b: any) => acc + (b.messageCount || 0), 0),
        apiKeys: statsData.totalApiKeys ?? statsData.apiKeys ?? 0
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const resetDeleteModalState = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setDeleting(false);
    setCountdown(3);
    setDeleteProgress(0);
    setDeleteStage('');
    setDeleteError(null);
  };

  const openDeleteModal = (bot: any) => {
    resetDeleteModalState();
    setConfirmDeleteBot(bot);
  };

  const closeDeleteModal = () => {
    resetDeleteModalState();
    setConfirmDeleteBot(null);
  };

  const handleConfirmDeleteWithCountdown = async () => {
    if (!confirmDeleteBot || deleting) return;
    const targetBot = confirmDeleteBot;

    setDeleting(true);
    setDeleteError(null);
    setCountdown(3);
    setDeleteProgress(15);
    setDeleteStage(
      t('Unlinking Telegram webhook & preparing deletion...', 'টেলিগ্রাম ওয়েবহুক বিচ্ছিন্ন ও মুছে ফেলার প্রস্তুতি চলছে...')
    );

    // Visual countdown (3 -> 2 -> 1) before/during the API call so user sees clear visual feedback
    await new Promise<void>((resolve) => {
      let remaining = 3;
      timerRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining === 2) {
          setCountdown(2);
          setDeleteProgress(45);
          setDeleteStage(
            t('Stopping active bot responders & clearing queue...', 'সচল বট রেসপন্ডার ও কিউ বন্ধ করা হচ্ছে...')
          );
        } else if (remaining === 1) {
          setCountdown(1);
          setDeleteProgress(75);
          setDeleteStage(
            t('Deleting bot configuration from server...', 'সার্ভার থেকে বট কনফিগারেশন মুছে ফেলা হচ্ছে...')
          );
        } else {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setCountdown(0);
          setDeleteProgress(90);
          resolve();
        }
      }, 650);
    });

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const res = await fetch(`/api/bots/${targetBot.id}`, {
        method: 'DELETE',
        signal: controller.signal
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || t('Failed to delete bot from server.', 'সার্ভার থেকে বট মুছে ফেলতে সমস্যা হয়েছে।'));
      }

      setDeleteProgress(100);
      setDeleteStage(t('Bot deleted successfully!', 'বট সফলভাবে মুছে ফেলা হয়েছে!'));
      setBots(prev => prev.filter(b => b.id !== targetBot.id));

      await fetchDashboardData();

      setTimeout(() => {
        closeDeleteModal();
      }, 350);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Failed to delete bot:', error);
      setDeleteError(error?.message || t('Failed to delete bot. Please try again.', 'বট মুছে ফেলতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।'));
      setDeleting(false);
      setCountdown(3);
      setDeleteProgress(0);
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 rounded-2xl bg-card border border-border day-box-shadow" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-card border border-border day-box-shadow" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-56 rounded-2xl bg-card border border-border day-box-shadow" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header Toolbar with Telegram Blue Brand Accent & Channel Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-card border border-border p-4 sm:px-5 day-box-shadow">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#0088CC]/12 dark:bg-[#229ED9]/15 text-[#0088CC] dark:text-[#229ED9] flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-[#0088CC] dark:bg-[#229ED9] text-white shadow-xs">
                <Bot className="w-3 h-3" />
                <span>{t('Telegram Active', 'টেলিগ্রাম সক্রিয়')}</span>
              </span>
              <Link
                prefetch={false}
                href="/whatsapp"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#075E54] hover:bg-[#064E46] dark:bg-[#00A884] text-white dark:text-[#0B141A] transition-all"
              >
                <Smartphone className="w-3 h-3" />
                <span>{t('WhatsApp Command', 'হোয়াটসঅ্যাপ কমান্ড')}</span>
              </Link>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
              {t('Telegram Bot Command Center', 'টেলিগ্রাম বট কমান্ড সেন্টার')}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(
                'Configure multi-bot responders, webhook endpoints, and automated reply workflows',
                'মাল্টি-বট অটো-রেসপন্ডার, ওয়েবহুক এন্ডপয়েন্ট এবং স্বয়ংক্রিয় রিপ্লাই পরিচালনা করুন'
              )}
            </p>
          </div>
        </div>

        <Link prefetch={false} href="/bots/new" className="w-full sm:w-auto">
          <button 
            type="button"
            className="w-full sm:w-auto flex items-center justify-center space-x-1.5 bg-[#0088CC] hover:bg-[#0077B5] dark:bg-[#229ED9] dark:hover:bg-[#1E8CC0] text-white px-4 h-9 rounded-xl transition-transform active:scale-95 day-box-shadow font-bold text-xs cursor-pointer"
          >
            <Plus size={15} />
            <span>{t('Add New Bot', 'নতুন বট যুক্ত করুন')}</span>
          </button>
        </Link>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatsCard title={t('Total Bots', 'মোট বট')} value={stats.totalBots.toString()} subtitle={t('Registered bots', 'নিবন্ধিত বট')} icon={Bot} />
        <StatsCard title={t('Active Bots', 'সচল বট')} value={stats.activeBots.toString()} subtitle={t('Webhook online', 'ওয়েবহুক সচল')} icon={Activity} />
        <StatsCard title={t('Messages Handled', 'প্রেরিত মেসেজ')} value={stats.totalMessages.toString()} subtitle={t('Automated replies', 'স্বয়ংক্রিয় উত্তর')} icon={MessageSquare} />
        <StatsCard title={t('Configured Keys', 'কনফিগারকৃত কী')} value={stats.apiKeys.toString()} subtitle={t('Failover pool', 'ফেইলওভার পুল')} icon={Key} />
      </div>

      {/* Bots Section */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 day-box-shadow space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
            <span>{t('Configured Telegram Bots', 'কনফিগারকৃত টেলিগ্রাম বটসমূহ')}</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-[#0088CC]/12 text-[#0088CC] dark:bg-[#229ED9]/15 dark:text-[#229ED9]">
              {bots.length}
            </span>
          </h2>
        </div>

        {bots.length === 0 ? (
          <div className="text-center py-12 bg-secondary/30 rounded-xl border border-dashed border-border">
            <Bot size={36} className="mx-auto mb-2 text-[#0088CC] dark:text-[#229ED9] opacity-75" />
            <h3 className="text-sm font-bold text-foreground mb-1">{t('No bots created yet', 'এখনো কোনো বট তৈরি করা হয়নি')}</h3>
            <p className="text-xs text-muted-foreground mb-4">{t('Connect a Telegram bot token to get started.', 'শুরু করতে একটি টেলিগ্রাম বট টোকেন যুক্ত করুন।')}</p>
            <Link 
              prefetch={false}
              href="/bots/new"
              className="inline-flex items-center space-x-1.5 bg-[#0088CC] hover:bg-[#0077B5] dark:bg-[#229ED9] text-white px-4 py-2 rounded-xl transition-all shadow-xs font-bold text-xs"
            >
              <Plus size={15} />
              <span>{t('Create First Bot', 'প্রথম বট তৈরি করুন')}</span>
            </Link>
          </div>
        ) : (
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {bots.map(bot => (
              <motion.div key={bot.id} variants={item}>
                <BotCard 
                  bot={bot} 
                  onDelete={() => openDeleteModal(bot)} 
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Prominent Bot Deletion Confirmation Modal with Visual Countdown & Loading Progress */}
      <AnimatePresence>
        {confirmDeleteBot && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
            onClick={() => {
              if (!deleting) closeDeleteModal();
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-md rounded-2xl bg-card border-2 border-red-500/40 dark:border-red-500/50 day-box-shadow overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Warning Header Strip */}
              <div className="bg-red-600/10 dark:bg-red-950/50 border-b border-red-500/20 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-md shrink-0">
                    {deleting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ShieldAlert className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-red-600 text-white mb-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {t('Permanent Action', 'স্থায়ীভাবে মুছে ফেলা')}
                    </span>
                    <h3 className="text-base font-extrabold text-foreground tracking-tight">
                      {t('Delete Telegram Bot?', 'টেলিগ্রাম বট মুছে ফেলবেন?')}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                  title={t('Close', 'বন্ধ করুন')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4">
                {/* Target Bot Details Card */}
                <div className="p-3.5 rounded-xl bg-secondary/60 border border-border flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#0088CC]/15 text-[#0088CC] dark:text-[#229ED9] flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-foreground truncate">
                        {confirmDeleteBot.name || 'Telegram Bot'}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">
                        ID: {confirmDeleteBot.id} • {confirmDeleteBot.messageCount ?? 0} {t('msgs', 'মেসেজ')}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase shrink-0 ${
                      confirmDeleteBot.isActive || confirmDeleteBot.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    {confirmDeleteBot.isActive || confirmDeleteBot.status === 'active'
                      ? t('Active', 'সচল')
                      : t('Paused', 'বন্ধ')}
                  </span>
                </div>

                {/* Warning Explanation OR Visual Countdown & Progress Bar */}
                {!deleting ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(
                      `Are you sure you want to permanently delete "${confirmDeleteBot.name || 'this bot'}"? Its webhook connection, auto-reply rules, and chat history will be removed immediately.`,
                      `আপনি কি নিশ্চিতভাবে "${confirmDeleteBot.name || 'এই বট'}" স্থায়ীভাবে মুছে ফেলতে চান? এর ওয়েবহুক সংযোগ, অটো-রিপ্লাই নিয়ম এবং চ্যাট হিস্ট্রি সাথে সাথে মুছে যাবে।`
                    )}
                  </p>
                ) : (
                  <div className="p-4 rounded-xl bg-red-500/8 dark:bg-red-950/30 border border-red-500/25 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {deleteProgress >= 100 ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <Loader2 className="w-4 h-4 text-red-600 dark:text-red-400 animate-spin shrink-0" />
                        )}
                        <span className="text-xs font-bold text-foreground truncate">
                          {deleteStage}
                        </span>
                      </div>

                      {/* Visual Countdown Badge */}
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-red-600 text-white font-mono text-xs font-extrabold shrink-0 shadow-xs">
                        {countdown > 0 ? `${countdown}s` : `${deleteProgress}%`}
                      </span>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-red-500/15 overflow-hidden">
                      <div
                        className="h-full bg-red-600 dark:bg-red-500 transition-all duration-500 ease-out rounded-full"
                        style={{ width: `${deleteProgress}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-muted-foreground flex items-center justify-between">
                      <span>
                        {countdown > 0
                          ? t(`Executing deletion in ${countdown}s...`, `${countdown} সেকেন্ডের মধ্যে মুছে ফেলা হচ্ছে...`)
                          : t('Finalizing server request...', 'সার্ভার রিকোয়েস্ট সম্পন্ন হচ্ছে...')}
                      </span>
                      <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                        {deleteProgress}%
                      </span>
                    </p>
                  </div>
                )}

                {deleteError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-600 dark:text-red-400">
                    {deleteError}
                  </div>
                )}

                {/* Action Buttons (OK / Cancel) */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    className="px-4 py-2.5 rounded-xl border border-border bg-secondary/70 hover:bg-secondary text-foreground text-xs font-bold transition-colors cursor-pointer"
                  >
                    {deleting
                      ? t('Cancel / Abort (বাতিল)', 'বাতিল করুন (Abort)')
                      : t('Cancel (বাতিল)', 'বাতিল (Cancel)')}
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleConfirmDeleteWithCountdown}
                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-80 cursor-pointer"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>
                          {countdown > 0
                            ? t(`Deleting in ${countdown}s...`, `মুছে ফেলা হচ্ছে (${countdown}s)...`)
                            : t('Deleting Bot...', 'বট মুছে ফেলা হচ্ছে...')}
                        </span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t('OK, Delete Bot (ওকে)', 'ওকে, বট মুছুন (OK)')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


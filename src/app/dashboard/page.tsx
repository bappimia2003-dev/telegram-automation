'use client';

import { useState, useEffect } from 'react';
import { StatsCard } from '@/components/StatsCard';
import { BotCard } from '@/components/BotCard';
import { Bot, Activity, MessageSquare, Key, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function DashboardPage() {
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, []);

  const handleDeleteBot = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bot?')) return;
    try {
      await fetch(`/api/bots/${id}`, { method: 'DELETE' });
      await fetchDashboardData();
    } catch (error) {
      console.error('Failed to delete bot:', error);
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 rounded-2xl bg-[#FBF9F4] dark:bg-[#0B2820] border border-[#E6E2D8] dark:border-[#13382E]" />
          ))}
        </div>
        <div className="flex justify-between items-center">
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 rounded-2xl bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Quick Action Button */}
      <div className="flex items-center justify-end">
        <Link href="/bots/new" className="w-full sm:w-auto">
          <button 
            type="button"
            className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-[#164E43] hover:bg-[#124238] text-white px-5 h-11 sm:h-10 rounded-[14px] sm:rounded-xl transition-transform active:scale-95 shadow-sm font-bold text-sm sm:text-xs"
          >
            <Plus size={16} />
            <span>Add New Bot</span>
          </button>
        </Link>
      </div>

      {/* KPI Stats Grid (2 cols on mobile, 4 cols on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatsCard title="Total Bots" value={stats.totalBots.toString()} icon={Bot} />
        <StatsCard title="Active Bots" value={stats.activeBots.toString()} icon={Activity} />
        <StatsCard title="Total Messages" value={stats.totalMessages.toString()} icon={MessageSquare} />
        <StatsCard title="API Keys" value={stats.apiKeys.toString()} icon={Key} />
      </div>

      {/* Bots Section */}
      <div className="space-y-4 pt-2 border-t border-[#E4DFD2] dark:border-[#262930]">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white font-['Sora',sans-serif] flex items-center gap-2">
            <span>Your Bots</span>
            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#E3F1EA] dark:bg-[#1E2D27] text-[#164F43] dark:text-[#5FD1A5]">
              {bots.length}
            </span>
          </h2>
        </div>

        {bots.length === 0 ? (
          <div className="text-center py-14 bg-[#FBF9F4] dark:bg-[#181A1F] rounded-2xl border border-dashed border-[#E6E2D8] dark:border-[#262930] shadow-sm">
            <Bot size={44} className="mx-auto mb-3 text-gray-400 dark:text-gray-600" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">No bots created yet</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">Create your first bot to get started!</p>
            <Link 
              href="/bots/new"
              className="inline-flex items-center space-x-1.5 bg-[#164E43] hover:bg-[#124238] text-white px-5 py-2.5 rounded-xl transition-all shadow-sm font-semibold text-xs"
            >
              <Plus size={16} />
              <span>Create First Bot</span>
            </Link>
          </div>
        ) : (
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6"
          >
            {bots.map(bot => (
              <motion.div key={bot.id} variants={item}>
                <BotCard 
                  bot={bot} 
                  onDelete={() => handleDeleteBot(bot.id)} 
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

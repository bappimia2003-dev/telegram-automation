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
        fetch('/api/bots'),
        fetch('/api/stats')
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
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-card/50 rounded-xl border border-border/50" />)}
        </div>
        <div className="flex justify-between items-center"><div className="h-8 w-32 bg-card/50 rounded" /><div className="h-10 w-32 bg-card/50 rounded" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-64 bg-card/50 rounded-xl border border-border/50" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your automation system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Total Bots" value={stats.totalBots.toString()} icon={Bot} />
        <StatsCard title="Active Bots" value={stats.activeBots.toString()} icon={Activity} />
        <StatsCard title="Total Messages" value={stats.totalMessages.toString()} icon={MessageSquare} />
        <StatsCard title="API Keys" value={stats.apiKeys.toString()} icon={Key} />
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Your Bots</h2>
          <Link 
            href="/bots/new"
            className="flex items-center space-x-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={18} />
            <span>Add New Bot</span>
          </Link>
        </div>

        {bots.length === 0 ? (
          <div className="text-center py-12 bg-card/30 rounded-xl border border-dashed border-border">
            <Bot size={48} className="mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium text-white mb-2">No bots created yet</h3>
            <p className="text-muted-foreground mb-6">Create your first bot to get started!</p>
            <Link 
              href="/bots/new"
              className="inline-flex items-center space-x-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus size={18} />
              <span>Create First Bot</span>
            </Link>
          </div>
        ) : (
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
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

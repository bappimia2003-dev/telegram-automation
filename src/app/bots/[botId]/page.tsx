'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ChevronRight, Power, Settings, MessageSquare, Trash2, 
  Bot, Clock, Calendar, AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function BotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const botId = params.botId as string;
  
  const [bot, setBot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    const fetchBot = async () => {
      try {
        const res = await fetch(`/api/bots/${botId}`);
        if (!res.ok) throw new Error('Failed to fetch bot');
        const data = await res.json();
        setBot(data.bot);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (botId) fetchBot();
  }, [botId]);

  const toggleStatus = async () => {
    setToggling(true);
    try {
      const method = bot.status === 'active' ? 'DELETE' : 'POST';
      const res = await fetch(`/api/bots/${botId}/webhook`, { method });
      if (res.ok) {
        setBot({ ...bot, status: bot.status === 'active' ? 'inactive' : 'active' });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this bot? This cannot be undone.')) return;
    try {
      await fetch(`/api/bots/${botId}`, { method: 'DELETE' });
      router.push('/dashboard');
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="h-8 w-48 bg-card rounded" />
      <div className="h-32 bg-card rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-64 bg-card rounded-xl" />
        <div className="h-64 bg-card rounded-xl" />
      </div>
    </div>;
  }

  if (!bot) return <div>Bot not found</div>;

  return (
    <div className="space-y-8 pb-12">
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
        <ChevronRight size={14} />
        <span className="text-foreground">{bot.name}</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">{bot.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Bot size={16} /> @{bot.username || 'bot_username'}</span>
            <span className="flex items-center gap-1"><Calendar size={16} /> Created {new Date(bot.createdAt).toLocaleDateString()}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${bot.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
              {bot.status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={toggleStatus}
            disabled={toggling}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${bot.status === 'active' ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'}`}
          >
            <Power size={18} />
            {toggling ? 'Updating...' : bot.status === 'active' ? 'Stop Bot' : 'Start Bot'}
          </button>
          <Link href={`/bots/${botId}/settings`} className="flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-lg transition-colors">
            <Settings size={18} /> Settings
          </Link>
          <button onClick={handleDelete} className="flex items-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 px-4 py-2 rounded-lg transition-colors">
            <Trash2 size={18} /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card/50 border border-border/50 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare className="text-blue-500" />
            <h3 className="font-medium text-white">Messages Processed</h3>
          </div>
          <p className="text-3xl font-bold text-white">{bot.stats?.messagesProcessed || 0}</p>
        </div>
        <div className="bg-card/50 border border-border/50 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Bot className="text-purple-500" />
            <h3 className="font-medium text-white">Current Model</h3>
          </div>
          <p className="text-lg font-medium text-white truncate">{bot.model || 'gemini-1.5-flash'}</p>
        </div>
        <div className="bg-card/50 border border-border/50 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="text-emerald-500" />
            <h3 className="font-medium text-white">Last Active</h3>
          </div>
          <p className="text-lg font-medium text-white">{bot.lastActive ? new Date(bot.lastActive).toLocaleString() : 'Never'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
            <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between bg-card/80">
              <h3 className="font-semibold text-white">Recent Activity</h3>
              <Link href={`/bots/${botId}/chat`} className="text-sm text-primary hover:underline">View full chat log</Link>
            </div>
            <div className="p-6">
              {/* Preview of last messages would go here */}
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="mx-auto mb-3 opacity-20" size={32} />
                <p>No recent messages to display.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border/50 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4">Configuration Summary</h3>
            <div className="space-y-4">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Personality</span>
                <p className="text-sm text-white mt-1 line-clamp-3">{bot.systemPrompt || 'No specific personality defined.'}</p>
              </div>
              <div className="pt-3 border-t border-border/50">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">API Key Used</span>
                <p className="text-sm text-white mt-1 truncate">{bot.apiKeyName || 'Default Key'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

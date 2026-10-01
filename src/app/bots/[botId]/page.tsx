'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ChevronRight, Power, Settings, MessageSquare, Trash2, 
  Bot, Clock, Calendar, ArrowRight
} from 'lucide-react';

export default function BotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const botId = params.botId as string;
  
  const [bot, setBot] = useState<any>(null);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState('');

  const fetchBot = async () => {
    try {
      const [botRes, msgRes] = await Promise.all([
        fetch(`/api/bots/${botId}`),
        fetch(`/api/bots/${botId}/messages?limit=5`)
      ]);
      if (!botRes.ok) throw new Error('Failed to fetch bot');
      const data = await botRes.json();
      setBot(data.bot || data);

      if (msgRes.ok) {
        const msgs = await msgRes.json();
        setRecentMessages(Array.isArray(msgs) ? msgs : msgs.messages || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (botId) fetchBot();
  }, [botId]);

  const isActive = bot?.isActive !== undefined ? Boolean(bot.isActive) : (bot?.status === 'active' || bot?.status === 'Active');

  const toggleStatus = async () => {
    setToggling(true);
    setToggleError('');
    try {
      const method = isActive ? 'DELETE' : 'POST';
      const res = await fetch(`/api/bots/${botId}/webhook`, { method });
      if (res.ok) {
        setBot({ ...bot, isActive: !isActive, status: !isActive ? 'active' : 'inactive' });
      } else {
        const err = await res.json().catch(() => ({}));
        setToggleError(err.error || 'Failed to update webhook with Telegram');
      }
    } catch (error: any) {
      console.error(error);
      setToggleError(error?.message || 'Network error updating bot status');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this bot? This action cannot be undone.')) return;
    try {
      await fetch(`/api/bots/${botId}`, { method: 'DELETE' });
      router.push('/dashboard');
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-8 max-w-5xl mx-auto">
        <div className="h-8 w-48 bg-card rounded" />
        <div className="h-32 bg-card rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-card rounded-xl" />
          <div className="h-64 bg-card rounded-xl" />
        </div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold">Bot not found</h2>
        <Link href="/dashboard" className="text-primary hover:underline mt-4 inline-block">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
        <ChevronRight size={14} />
        <span className="text-foreground">{bot.name}</span>
      </nav>

      {toggleError && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {toggleError}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">{bot.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 font-mono text-xs"><Bot size={16} /> Token: {bot.telegramToken ? `${bot.telegramToken.substring(0, 8)}...` : 'Configured'}</span>
            <span className="flex items-center gap-1"><Calendar size={16} /> Created {new Date(bot.createdAt || Date.now()).toLocaleDateString()}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${isActive ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
              {isActive ? 'Active (Live on Telegram)' : 'Inactive (Stopped)'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={toggleStatus}
            disabled={toggling}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${isActive ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30' : 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/30'}`}
          >
            <Power size={18} />
            {toggling ? 'Connecting...' : isActive ? 'Stop Webhook' : 'Activate Webhook'}
          </button>
          <Link href={`/bots/${botId}/settings`} className="flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-lg transition-colors border border-border/50">
            <Settings size={18} /> Settings
          </Link>
          <button onClick={handleDelete} className="flex items-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 px-4 py-2 rounded-lg transition-colors border border-red-500/20">
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
          <p className="text-3xl font-bold text-white">{bot.messageCount ?? bot.stats?.messagesProcessed ?? 0}</p>
        </div>
        <div className="bg-card/50 border border-border/50 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Bot className="text-purple-500" />
            <h3 className="font-medium text-white">Current AI Model</h3>
          </div>
          <p className="text-lg font-medium text-white truncate">{bot.currentModel || bot.model || 'gemini-2.0-flash'}</p>
        </div>
        <div className="bg-card/50 border border-border/50 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="text-emerald-500" />
            <h3 className="font-medium text-white">Webhook Status</h3>
          </div>
          <p className="text-sm font-medium text-muted-foreground truncate">{bot.webhookUrl || (isActive ? 'Registered' : 'Not Registered')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
            <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between bg-card/80">
              <h3 className="font-semibold text-white">Recent Telegram Activity</h3>
              <Link href={`/bots/${botId}/chat`} className="text-sm text-primary hover:underline flex items-center gap-1">
                View full chat log <ArrowRight size={14} />
              </Link>
            </div>
            <div className="p-6">
              {recentMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="mx-auto mb-3 opacity-20" size={32} />
                  <p>No recent messages yet. Send a message to your bot on Telegram!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentMessages.slice(-5).map((m: any, idx: number) => (
                    <div key={m.id || idx} className={`p-3 rounded-lg text-sm flex flex-col ${m.direction === 'incoming' ? 'bg-secondary/60 text-foreground mr-8' : 'bg-primary/10 border border-primary/20 text-blue-200 ml-8'}`}>
                      <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                        <span className="font-semibold">{m.direction === 'incoming' ? (m.senderName || 'Telegram User') : bot.name}</span>
                        <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border/50 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4">AI Configuration</h3>
            <div className="space-y-4">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Personality Prompt</span>
                <p className="text-sm text-white mt-1 line-clamp-4 bg-secondary/40 p-2.5 rounded border border-border/40">
                  {bot.aiPersonality || bot.systemPrompt || 'No specific personality defined.'}
                </p>
              </div>
              <div className="pt-3 border-t border-border/50">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Response Style</span>
                <p className="text-sm text-white mt-1 capitalize">{bot.responseStyle || 'Friendly'}</p>
              </div>
              <div className="pt-3 border-t border-border/50">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Max Tokens</span>
                <p className="text-sm text-white mt-1">{bot.maxTokens || 500} tokens</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

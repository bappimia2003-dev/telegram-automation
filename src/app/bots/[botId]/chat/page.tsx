'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, MessageSquare, RefreshCw } from 'lucide-react';
import { ChatLog } from '@/components/ChatLog';

export default function BotChatLogPage() {
  const params = useParams();
  const botId = params.botId as string;
  
  const [botName, setBotName] = useState('Loading...');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [stats, setStats] = useState({ total: 0, today: 0 });

  const fetchMessages = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      // First get bot details to show name
      const botRes = await fetch(`/api/bots/${botId}`);
      if (botRes.ok) {
        const botData = await botRes.json();
        setBotName(botData.name || botData.bot?.name || 'Unknown Bot');
      }
      
      const res = await fetch(`/api/bots/${botId}/messages`);
      const data = await res.json();
      const msgList = Array.isArray(data) ? data : data.messages || [];
      setMessages(msgList);
      
      // Calculate basic stats
      const today = new Date().setHours(0,0,0,0);
      const todaysMsgs = msgList.filter((m: any) => new Date(m.timestamp).getTime() >= today).length;
      setStats({ total: msgList.length, today: todaysMsgs });
      
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (botId) {
      fetchMessages();
      // Auto-refresh every 10 seconds
      const interval = setInterval(() => fetchMessages(true), 10000);
      return () => clearInterval(interval);
    }
  }, [botId]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 h-[calc(100vh-8rem)] flex flex-col">
      <div className="space-y-4 shrink-0">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          <ChevronRight size={14} />
          <Link href={`/bots/${botId}`} className="hover:text-white transition-colors">{botName}</Link>
          <ChevronRight size={14} />
          <span className="text-foreground">Chat Log</span>
        </nav>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Chat Log - {botName}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Total messages: <strong className="text-white">{stats.total}</strong></span>
              <span>Today: <strong className="text-white">{stats.today}</strong></span>
            </div>
          </div>
          
          <button 
            onClick={() => fetchMessages(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors text-sm"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <RefreshCw size={32} className="animate-spin text-muted-foreground opacity-50" />
          </div>
        ) : (
          <ChatLog messages={messages} botName={botName} />
        )}
      </div>
    </div>
  );
}

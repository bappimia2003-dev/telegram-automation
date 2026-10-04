'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ChevronRight, Power, Settings, MessageSquare, Trash2, 
  Bot, Clock, Calendar, ArrowRight,
  Mic, Image as ImageIcon, FileText, Globe, Sparkles,
  Film, Store, Video, Music, FileSpreadsheet, CheckCircle2
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
        fetch(`/api/bots/${botId}?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/bots/${botId}/messages?limit=5&t=${Date.now()}`, { cache: 'no-store' })
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
        <div className="h-8 w-48 bg-white rounded-xl border border-gray-200" />
        <div className="h-32 bg-white rounded-2xl border border-gray-200" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-white rounded-2xl border border-gray-200" />
          <div className="h-64 bg-white rounded-2xl border border-gray-200" />
        </div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-gray-900">Bot not found</h2>
        <Link href="/dashboard" className="text-green-700 hover:underline mt-4 inline-block font-semibold">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">
      <nav className="flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-900 transition-colors">Dashboard</Link>
        <ChevronRight size={14} />
        <span className="text-gray-900 font-medium">{bot.name}</span>
      </nav>

      {toggleError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
          {toggleError}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">{bot.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1 font-mono text-xs"><Bot size={16} /> Token: {bot.telegramToken ? `${bot.telegramToken.substring(0, 8)}...` : 'Configured'}</span>
            <span className="flex items-center gap-1"><Calendar size={16} /> Created {new Date(bot.createdAt || Date.now()).toLocaleDateString()}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
              {isActive ? 'Active (Live on Telegram)' : 'Inactive (Stopped)'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={toggleStatus}
            disabled={toggling}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all shadow-sm ${isActive ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200' : 'bg-green-700 text-white hover:bg-green-600'}`}
          >
            <Power size={16} />
            {toggling ? 'Connecting...' : isActive ? 'Stop Webhook' : 'Activate Webhook'}
          </button>
          <Link href={`/bots/${botId}/settings`} className="flex items-center gap-2 bg-white text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-xl font-semibold text-sm transition-colors border border-gray-200 shadow-sm">
            <Settings size={16} /> Settings
          </Link>
          <button onClick={handleDelete} className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-xl font-semibold text-sm transition-colors border border-red-200">
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare className="text-green-700" />
            <h3 className="font-semibold text-gray-700 text-sm">Messages Processed</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{bot.messageCount ?? bot.stats?.messagesProcessed ?? 0}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Bot className="text-green-700" />
            <h3 className="font-semibold text-gray-700 text-sm">Current AI Model</h3>
          </div>
          <p className="text-lg font-bold text-gray-900 truncate">{bot.currentModel || bot.model || 'gemini-2.0-flash'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="text-green-700" />
            <h3 className="font-semibold text-gray-700 text-sm">Webhook Status</h3>
          </div>
          <p className="text-sm font-medium text-gray-600 truncate">{bot.webhookUrl || (isActive ? 'Registered' : 'Not Registered')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between bg-white">
              <h3 className="font-bold text-gray-900">Recent Telegram Activity</h3>
              <Link href={`/bots/${botId}/chat`} className="text-sm text-green-700 hover:underline flex items-center gap-1 font-semibold">
                View full chat log <ArrowRight size={14} />
              </Link>
            </div>
            <div className="p-6">
              {recentMessages.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <MessageSquare className="mx-auto mb-3 opacity-30 text-green-700" size={32} />
                  <p className="font-medium text-gray-600">No recent messages yet</p>
                  <p className="text-xs text-gray-400 mt-1">Send a message to your bot on Telegram!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentMessages.slice(-5).map((m: any, idx: number) => (
                    <div key={m.id || idx} className={`p-3.5 rounded-2xl text-sm flex flex-col ${m.direction === 'incoming' ? 'bg-gray-100 text-gray-900 mr-8 border border-gray-200/60' : 'bg-green-700 text-white ml-8 shadow-sm'}`}>
                      <div className={`flex justify-between items-center text-xs mb-1 ${m.direction === 'incoming' ? 'text-gray-500' : 'text-green-100'}`}>
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
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">AI Configuration</h3>
            <div className="space-y-4">
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Personality Prompt</span>
                <p className="text-sm text-gray-700 mt-1 line-clamp-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  {bot.aiPersonality || bot.systemPrompt || 'No specific personality defined.'}
                </p>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Response Style</span>
                <p className="text-sm text-gray-900 font-semibold mt-1 capitalize">{bot.responseStyle || 'Friendly'}</p>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Max Tokens</span>
                <p className="text-sm text-gray-900 font-semibold mt-1">{bot.maxTokens || 500} tokens</p>
              </div>
            </div>
          </div>

          {/* AI Superpowers Status Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-green-700" />
                <h3 className="font-bold text-gray-900 text-sm">AI Superpowers</h3>
              </div>
              <Link href={`/bots/${botId}/settings`} className="text-xs text-green-700 hover:underline font-semibold">
                Configure
              </Link>
            </div>
            
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-gray-600">
                  <Mic className="w-3.5 h-3.5 text-blue-600" /> Voice & Audio
                </span>
                <span className={`px-2.5 py-0.5 rounded-full font-semibold ${bot.enableVoice !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'}`}>
                  {bot.enableVoice !== false ? 'Active' : 'Off'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-gray-600">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-600" /> Image Vision
                </span>
                <span className={`px-2.5 py-0.5 rounded-full font-semibold ${bot.enableVision !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'}`}>
                  {bot.enableVision !== false ? 'Active' : 'Off'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-gray-600">
                  <FileText className="w-3.5 h-3.5 text-amber-600" /> Document Reader
                </span>
                <span className={`px-2.5 py-0.5 rounded-full font-semibold ${bot.enableFiles !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'}`}>
                  {bot.enableFiles !== false ? 'Active' : 'Off'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-gray-600">
                  <Globe className="w-3.5 h-3.5 text-teal-600" /> Live Web Search
                </span>
                <span className={`px-2.5 py-0.5 rounded-full font-semibold ${bot.enableWebSearch ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'}`}>
                  {bot.enableWebSearch ? 'Active' : 'Off'}
                </span>
              </div>
            </div>
          </div>

          {/* Welcome Media Automation Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-green-700" />
                <h3 className="font-bold text-gray-900 text-sm">Welcome Media (/start)</h3>
              </div>
              <Link href={`/bots/${botId}/settings`} className="text-xs text-green-700 hover:underline font-semibold">
                Configure
              </Link>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Status</span>
                <span className={`px-2.5 py-0.5 rounded-full font-semibold ${bot.enableWelcomeMedia ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'}`}>
                  {bot.enableWelcomeMedia ? 'Active (ON)' : 'Disabled (OFF)'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-gray-600">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-600" /> Welcome Image
                </span>
                <span className="text-gray-500 font-mono text-[11px]">
                  {bot.welcomeImageUrl ? 'Configured ✅' : 'None'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-gray-600">
                  <Mic className="w-3.5 h-3.5 text-blue-600" /> Audio / Voice Note
                </span>
                <span className="text-gray-500 font-mono text-[11px]">
                  {bot.welcomeAudioUrl ? (bot.welcomeAudioType === 'audio' ? 'MP3 Audio ✅' : 'Voice Note ✅') : 'None'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-gray-600">
                  <Video className="w-3.5 h-3.5 text-purple-600" /> Welcome Video
                </span>
                <span className="text-gray-500 font-mono text-[11px]">
                  {bot.welcomeVideoUrl ? 'Configured ✅' : 'None'}
                </span>
              </div>
            </div>
          </div>

          {/* Shop Knowledge & Product Training Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-green-700" />
                <h3 className="font-bold text-gray-900 text-sm">Shop & Product Brain</h3>
              </div>
              <Link href={`/bots/${botId}/settings`} className="text-xs text-green-700 hover:underline font-semibold">
                Edit Products
              </Link>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-gray-600">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" /> Work Info
                </span>
                <span className={`px-2.5 py-0.5 rounded-full font-semibold ${bot.workInfo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'}`}>
                  {bot.workInfo ? 'Loaded ✅' : 'Not Set'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-gray-600">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600" /> Product Sheet
                </span>
                <span className={`px-2.5 py-0.5 rounded-full font-semibold ${bot.productFileUrl ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'}`}>
                  {bot.productFileName || (bot.productFileUrl ? 'Uploaded ✅' : 'None')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

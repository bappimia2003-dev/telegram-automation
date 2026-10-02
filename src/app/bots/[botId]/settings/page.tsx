'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BotForm } from '@/components/BotForm';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export default function BotSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const botId = params.botId as string;
  
  const [bot, setBot] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [botRes, keysRes] = await Promise.all([
          fetch(`/api/bots/${botId}?t=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/api/api-keys?t=${Date.now()}`, { cache: 'no-store' })
        ]);
        const botData = await botRes.json();
        const keysData = await keysRes.json();
        setBot(botData.bot || botData);
        setApiKeys(Array.isArray(keysData) ? keysData : keysData.keys || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    if (botId) fetchData();
  }, [botId]);

  const handleSubmit = async (formData: any) => {
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/bots/${botId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update bot');
      }

      const updatedBot = await res.json();
      setBot(updatedBot);

      // If auto-activate status changed, handle webhook accordingly
      const shouldBeActive = Boolean(formData.autoActivate || formData.isActive);
      const wasActive = Boolean(bot?.isActive);
      if (shouldBeActive !== wasActive) {
        try {
          await fetch(`/api/bots/${botId}/webhook`, {
            method: shouldBeActive ? 'POST' : 'DELETE'
          });
        } catch (wbErr) {
          console.error('Webhook sync warning:', wbErr);
        }
      }

      setSuccessMsg('✅ বটের সেটিংস সফলভাবে সংরক্ষিত হয়েছে! (Settings saved successfully)');
      setTimeout(() => {
        router.push(`/bots/${botId}`);
        router.refresh();
      }, 700);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || 'Failed to update bot');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 animate-pulse">
        <div className="h-8 w-48 bg-card rounded" />
        <div className="h-96 bg-card rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div className="space-y-4">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          <ChevronRight size={14} />
          <Link href={`/bots/${botId}`} className="hover:text-white transition-colors">{bot?.name || 'Bot'}</Link>
          <ChevronRight size={14} />
          <span className="text-foreground">Settings</span>
        </nav>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Edit Bot Settings</h1>
          <p className="text-muted-foreground">Update configuration for {bot?.name}</p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium animate-in fade-in">
          {successMsg}
        </div>
      )}

      <div className="bg-card/50 border border-border/50 rounded-xl p-6 backdrop-blur-sm">
        <BotForm 
          bot={bot}
          apiKeys={apiKeys} 
          onSubmit={handleSubmit} 
          loading={submitting} 
        />
      </div>
    </div>
  );
}

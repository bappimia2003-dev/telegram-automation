'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BotForm } from '@/components/BotForm';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export default function NewBotPage() {
  const router = useRouter();
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        const res = await fetch('/api/api-keys');
        const data = await res.json();
        setApiKeys(Array.isArray(data) ? data : data.keys || []);
      } catch (error) {
        console.error('Failed to fetch API keys:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchApiKeys();
  }, []);

  const handleSubmit = async (formData: any) => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create bot');
      }

      const newBot = await res.json();

      // If user enabled auto-activate, trigger the webhook registration right away
      if (formData.autoActivate && newBot?.id) {
        try {
          await fetch(`/api/bots/${newBot.id}/webhook`, { method: 'POST' });
        } catch (wbErr) {
          console.error('Auto-activate webhook warning:', wbErr);
        }
      }

      router.push('/dashboard');
      router.refresh();
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || 'Failed to create bot');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div className="space-y-4">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          <ChevronRight size={14} />
          <span className="text-foreground">New Bot</span>
        </nav>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Create New Bot</h1>
          <p className="text-muted-foreground">Configure a new Telegram AI bot for your system.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {errorMsg}
        </div>
      )}

      <div className="bg-card/50 border border-border/50 rounded-xl p-6 backdrop-blur-sm">
        {loading ? (
          <div className="h-96 animate-pulse flex flex-col space-y-4">
            <div className="h-10 bg-muted rounded w-full" />
            <div className="h-10 bg-muted rounded w-full" />
            <div className="h-32 bg-muted rounded w-full" />
          </div>
        ) : (
          <BotForm 
            apiKeys={apiKeys} 
            onSubmit={handleSubmit} 
            loading={submitting} 
          />
        )}
      </div>
    </div>
  );
}

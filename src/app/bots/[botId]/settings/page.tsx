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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [botRes, keysRes] = await Promise.all([
          fetch(`/api/bots/${botId}`),
          fetch('/api/api-keys')
        ]);
        const botData = await botRes.json();
        const keysData = await keysRes.json();
        setBot(botData.bot);
        setApiKeys(keysData.keys || []);
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
    try {
      const res = await fetch(`/api/bots/${botId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        router.push(`/bots/${botId}`);
        router.refresh();
      } else {
        throw new Error('Failed to update bot');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto h-96 animate-pulse bg-card rounded-xl" />;
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

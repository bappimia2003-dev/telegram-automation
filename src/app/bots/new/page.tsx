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

  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        const res = await fetch('/api/api-keys');
        const data = await res.json();
        setApiKeys(data.keys || []);
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
    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        // Here you would typically dispatch a success toast
        router.push('/dashboard');
        router.refresh();
      } else {
        throw new Error('Failed to create bot');
      }
    } catch (error) {
      console.error(error);
      // Here you would typically dispatch an error toast
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

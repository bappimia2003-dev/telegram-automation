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
        <nav className="flex items-center space-x-2 text-sm text-[#4B5563] dark:text-[#9CA3AF]">
          <Link href="/dashboard" className="hover:text-gray-900 dark:hover:text-white transition-colors">Dashboard</Link>
          <ChevronRight size={14} />
          <span className="text-gray-900 dark:text-white font-medium">New Bot</span>
        </nav>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">Create New Bot</h1>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {/* Main Form Board */}
      <div className="bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] rounded-2xl p-5 sm:p-7 shadow-sm transition-colors">
        {loading ? (
          <div className="h-96 animate-pulse flex flex-col space-y-4">
            <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-xl w-full" />
            <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-xl w-full" />
            <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl w-full" />
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

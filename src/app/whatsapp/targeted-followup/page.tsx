'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Target,
  Send,
  Users,
  Clock,
  Moon,
  Sun,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  RotateCcw,
  Upload,
  Image as ImageIcon,
  Volume2,
  Video,
  FileText,
  FileCheck,
  Sparkles,
  Phone,
  Search,
  Filter,
  Check,
  Smartphone,
  Trash2,
  Sliders,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Flame,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { uploadFile } from '@/lib/uploadHelper';

interface Recipient {
  phone: string;
  name?: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';
  sentAt?: string;
  error?: string;
  sentFromAccountId?: string;
}

interface TargetedJob {
  id: string;
  title: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'stopped';
  assignedAccountId: string;
  ratePerHour: number;
  targetDurationHours?: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  deduplicateAgainstHistory: boolean;
  messageText: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  documentUrl?: string;
  documentName?: string;
  sendOrder: string;
  delayBetweenSends: number;
  recipients: Recipient[];
  totalNumbers: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt?: string;
  lastSentAt?: string;
  nextScheduledSendAt?: string;
  completedAt?: string;
  updatedAt: string;
}

// Clean and normalize phone numbers
function cleanPhone(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.toString().replace(/[^0-9]/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('01')) {
    cleaned = '88' + cleaned;
  }
  return cleaned;
}

// Check if currently quiet hours in Bangladesh Time (00:00 to 08:00)
function checkIsQuietHoursNow(start = '00:00', end = '08:00'): boolean {
  try {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const bdTime = new Date(utcMs + (6 * 3600000));
    const mins = bdTime.getHours() * 60 + bdTime.getMinutes();
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    const sMins = (sH || 0) * 60 + (sM || 0);
    const eMins = (eH || 0) * 60 + (eM || 0);
    return mins >= sMins && mins < eMins;
  } catch {
    return false;
  }
}

export default function TargetedFollowupPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'monitor'>('config');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form Configuration State
  const [campaignTitle, setCampaignTitle] = useState('টার্গেটেড স্পেশাল ফলো-আপ');
  const [assignedAccountId, setAssignedAccountId] = useState('all');
  const [rawNumbers, setRawNumbers] = useState('');
  const [ratePerHour, setRatePerHour] = useState<number>(20);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
  const [deduplicateAgainstHistory, setDeduplicateAgainstHistory] = useState(true);
  
  // Message & Media
  const [messageText, setMessageText] = useState(
    'আসসালামু আলাইকুম {name}!\nআপনার সাথে পূর্বে আমাদের কথা হয়েছিল। আমাদের অফারটি কি আপনার পছন্দ হয়েছে নাকি কোনো বিশেষ প্রশ্ন আছে? জানালে আনন্দিত হব।'
  );
  const [imageUrl, setImageUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [delayBetweenSends, setDelayBetweenSends] = useState(3);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  // Live Job State from API
  const [job, setJob] = useState<TargetedJob | null>(null);
  const [queueSearch, setQueueSearch] = useState('');
  const [queueFilter, setQueueFilter] = useState<'all' | 'pending' | 'sent' | 'failed'>('all');
  const [secondsUntilNext, setSecondsUntilNext] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load connected accounts and active job
  const fetchState = async () => {
    try {
      // 1. Fetch WhatsApp accounts
      const accRes = await fetch('/api/whatsapp/accounts');
      if (accRes.ok) {
        const accData = await accRes.json();
        setAccounts(accData.accounts || []);
      }

      // 2. Fetch active job status
      const jobRes = await fetch('/api/whatsapp/targeted-followup');
      if (jobRes.ok) {
        const jobData = await jobRes.json();
        if (jobData.ok && jobData.job) {
          setJob(jobData.job);
          if (jobData.job.status === 'running') {
            setActiveTab('monitor');
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch targeted followup data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer for next scheduled message
  useEffect(() => {
    if (!job?.nextScheduledSendAt || job.status !== 'running') {
      setSecondsUntilNext(null);
      return;
    }

    const timer = setInterval(() => {
      const target = new Date(job.nextScheduledSendAt!).getTime();
      const diff = Math.max(0, Math.round((target - Date.now()) / 1000));
      setSecondsUntilNext(diff);
    }, 1000);

    return () => clearInterval(timer);
  }, [job?.nextScheduledSendAt, job?.status]);

  // Real-time Number Parsing & Deduplication
  const parsedNumbersData = useMemo(() => {
    const lines = rawNumbers
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const seen = new Set<string>();
    const valid: { phone: string; name?: string }[] = [];
    let duplicates = 0;

    for (const line of lines) {
      let p = line;
      let n = '';
      if (line.includes(':')) {
        const parts = line.split(':');
        n = parts[0].trim();
        p = parts[1].trim();
      } else if (line.includes('|')) {
        const parts = line.split('|');
        n = parts[0].trim();
        p = parts[1].trim();
      }

      const normalized = cleanPhone(p);
      if (normalized.length >= 10) {
        if (!seen.has(normalized)) {
          seen.add(normalized);
          valid.push({ phone: normalized, name: n || undefined });
        } else {
          duplicates++;
        }
      }
    }

    const clamped = valid.slice(0, 300);
    const exceeded = valid.length > 300 ? valid.length - 300 : 0;

    return {
      numbers: clamped,
      totalCount: clamped.length,
      duplicates,
      exceeded,
    };
  }, [rawNumbers]);

  // Pacing calculations
  const pacingInfo = useMemo(() => {
    const total = parsedNumbersData.totalCount;
    const rate = Math.max(1, ratePerHour);
    const delaySec = Math.round(3600 / rate);
    const estActiveHours = total > 0 ? (total / rate).toFixed(1) : '0';
    return {
      delaySec,
      delayMinutes: (delaySec / 60).toFixed(1),
      estActiveHours,
    };
  }, [parsedNumbersData.totalCount, ratePerHour]);

  const isQuietHoursNow = checkIsQuietHoursNow();

  // Media file upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'audio' | 'video' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingType(type);
    try {
      const res = await uploadFile(file, type);
      if (res.url) {
        if (type === 'image') setImageUrl(res.url);
        else if (type === 'audio') setAudioUrl(res.url);
        else if (type === 'video') setVideoUrl(res.url);
        else if (type === 'document') {
          setDocumentUrl(res.url);
          setDocumentName(res.filename || file.name);
        }
      }
    } catch (err: any) {
      alert(`ফাইল আপলোড ব্যর্থ হয়েছে: ${err.message}`);
    } finally {
      setUploadingType(null);
    }
  };

  // Import numbers from text/csv file
  const handleImportNumbersFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawNumbers((prev) => (prev ? prev + '\n' + content : content));
      }
    };
    reader.readAsText(file);
  };

  // Actions
  const handleStartCampaign = async () => {
    if (parsedNumbersData.totalCount === 0) {
      alert('দয়া করে অন্তত ১টি এবং সর্বোচ্চ ৩০০টি বৈধ হোয়াটসঅ্যাপ নাম্বার ইনপুট করুন।');
      return;
    }
    if (!messageText.trim() && !imageUrl && !audioUrl && !videoUrl && !documentUrl) {
      alert('দয়া করে কোনো মেসেজ টেক্সট অথবা মিডিয়া ফাইল যুক্ত করুন।');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/whatsapp/targeted-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          title: campaignTitle,
          assignedAccountId,
          rawNumbers,
          ratePerHour,
          quietHoursEnabled,
          quietHoursStart: '00:00',
          quietHoursEnd: '08:00',
          deduplicateAgainstHistory,
          messageText,
          imageUrl,
          audioUrl,
          videoUrl,
          documentUrl,
          documentName,
          delayBetweenSends,
        }),
      });

      const data = await res.json();
      if (data.ok && data.job) {
        setJob(data.job);
        setActiveTab('monitor');
      } else {
        alert(data.error || 'ক্যাম্পেইন শুরু করতে সমস্যা হয়েছে।');
      }
    } catch (err: any) {
      alert(`এরর: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePause = async () => {
    try {
      const res = await fetch('/api/whatsapp/targeted-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' }),
      });
      const data = await res.json();
      if (data.job) setJob(data.job);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResume = async () => {
    try {
      const res = await fetch('/api/whatsapp/targeted-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      });
      const data = await res.json();
      if (data.job) setJob(data.job);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStop = async () => {
    if (!confirm('আপনি কি নিশ্চিত যে চলমান ফলো-আপ ক্যাম্পেইনটি সম্পূর্ণ বন্ধ ও রিসেট করতে চান?')) return;
    try {
      const res = await fetch('/api/whatsapp/targeted-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      const data = await res.json();
      setJob(null);
      setActiveTab('config');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filtered queue recipients for monitor
  const filteredRecipients = useMemo(() => {
    if (!job?.recipients) return [];
    return job.recipients.filter((r) => {
      const matchesSearch =
        r.phone.includes(queueSearch) || (r.name && r.name.toLowerCase().includes(queueSearch.toLowerCase()));
      const matchesFilter = queueFilter === 'all' || r.status === queueFilter;
      return matchesSearch && matchesFilter;
    });
  }, [job?.recipients, queueSearch, queueFilter]);

  const progressPercent = job?.totalNumbers ? Math.round((job.sentCount / job.totalNumbers) * 100) : 0;

  return (
    <div className="space-y-4 max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-6 pb-24 font-['Sora',sans-serif]">
      {/* 1. Header Banner with Status */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#123E35] via-[#164E43] to-[#0A2620] text-white p-4 sm:p-6 shadow-md border border-[#227968]/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/30 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                <span>টার্গেটেড ফলো-আপ ভল্ট</span>
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 text-white/90 border border-white/15">
                সর্বোচ্চ ৩০০ নাম্বার
              </span>
              {isQuietHoursNow && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Moon className="w-3.5 h-3.5" />
                  <span>নাইট সাইলেন্স সক্রিয় (১২:০০ AM - ৮:০০ AM)</span>
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight">
              স্মার্ট পেইসড ফলো-আপ সিস্টেম
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl">
              নির্দিষ্ট ৩০০ গ্রাহকের তালিকায় প্রতি ঘন্টায় নিয়ন্ত্রিত গতিতে ফাইল ও টেক্সট সহ ফলো-আপ বার্তা পাঠান। ব্যান প্রতিরোধে রয়েছে রাতের নীরবতা ও অ্যান্টি-স্প্যাম ডুপ্লিকেট ফিল্টার।
            </p>
          </div>

          {/* Tab Switcher Pills */}
          <div className="flex items-center bg-black/20 p-1 rounded-xl border border-white/10 shrink-0 self-start md:self-center">
            <button
              onClick={() => setActiveTab('config')}
              className={cn(
                'px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                activeTab === 'config'
                  ? 'bg-white text-[#164E43] shadow-sm'
                  : 'text-white/80 hover:text-white'
              )}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>সেটিংস ও নাম্বার</span>
            </button>
            <button
              onClick={() => setActiveTab('monitor')}
              className={cn(
                'px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 relative',
                activeTab === 'monitor'
                  ? 'bg-white text-[#164E43] shadow-sm'
                  : 'text-white/80 hover:text-white'
              )}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>লাইভ মনিটর ও কিউ</span>
              {job?.status === 'running' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Content Tabs */}
      {activeTab === 'config' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Numbers Input & Settings (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Card 1: WhatsApp Account & Numbers */}
            <Card className="border-[#E6E2D8] dark:border-[#262930] shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-extrabold text-gray-900 dark:text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#164E43] dark:text-[#34D399]" />
                    <span>১. গ্রাহকের নাম্বার ও প্রেরক সিম</span>
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-bold',
                      parsedNumbersData.totalCount > 0
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300'
                        : 'text-gray-500'
                    )}
                  >
                    {parsedNumbersData.totalCount} / ৩০০ নাম্বার
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  নিচে প্রতি লাইনে একটি করে নাম্বার পেস্ট করুন। নাম সহ দিতে চাইলে <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">01830086837, নাম</code> ফরম্যাটে দিতে পারেন।
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5">
                {/* Sender Account Selection */}
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 block">
                    প্রেরক হোয়াটসঅ্যাপ সিম (Sender WhatsApp Account):
                  </label>
                  <select
                    value={assignedAccountId}
                    onChange={(e) => setAssignedAccountId(e.target.value)}
                    className="w-full text-xs font-semibold h-10 px-3 rounded-xl border border-[#E6E2D8] dark:border-[#262930] bg-[#FAF8F5] dark:bg-[#181A1F] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#164E43]"
                  >
                    <option value="all">🔄 স্মার্ট রাউন্ড-রবিন (সব সচল সিম থেকে পর্যায়ক্রমে ভাগ করে পাঠাবে)</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        📱 {acc.name} ({acc.phoneNumber || 'No number'}) — {acc.status}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Big Textarea for Numbers */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      গ্রাহকদের নাম্বার তালিকা (Up to 300 numbers):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".txt,.csv"
                        ref={fileInputRef}
                        onChange={handleImportNumbersFile}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-7 text-[11px] px-2 text-[#164E43] dark:text-[#34D399] hover:bg-[#164E43]/10"
                      >
                        <Upload className="w-3 h-3 mr-1" />
                        ফাইল থেকে লোড
                      </Button>
                      {rawNumbers && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setRawNumbers('')}
                          className="h-7 text-[11px] px-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          মুছুন
                        </Button>
                      )}
                    </div>
                  </div>

                  <Textarea
                    rows={8}
                    value={rawNumbers}
                    onChange={(e) => setRawNumbers(e.target.value)}
                    placeholder="01830086837&#10;01993466370: সাবির ভাই&#10;+8801712345678, রফিক সাহেব&#10;01642137119"
                    className="font-mono text-xs rounded-xl bg-[#FAF8F5] dark:bg-[#181A1F] border-[#E6E2D8] dark:border-[#262930] focus:ring-[#164E43]"
                  />

                  {/* Summary badges */}
                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>বৈধ নাম্বার: <strong>{parsedNumbersData.totalCount}</strong></span>
                      {parsedNumbersData.duplicates > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          ({parsedNumbersData.duplicates}টি ডুপ্লিকেট বাদ)
                        </span>
                      )}
                      {parsedNumbersData.exceeded > 0 && (
                        <span className="text-red-500 font-semibold">
                          ({parsedNumbersData.exceeded}টি অতিরিক্ত বাদ পড়েছে)
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-gray-600 dark:text-gray-400">
                      অবশিষ্ট স্লট: {300 - parsedNumbersData.totalCount}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Speed, Rate & Night Safety */}
            <Card className="border-[#E6E2D8] dark:border-[#262930] shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#164E43] dark:text-[#34D399]" />
                  <span>২. গতি ও নাইট সাইলেন্স রুল</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  প্রতি ঘন্টায় কতটি করে মেসেজ পাঠাতে চান তা নির্ধারণ করুন।
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Rate per hour slider */}
                <div className="space-y-2 p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                        প্রতি ঘন্টায় মেসেজের সংখ্যা (Rate per hour):
                      </span>
                      <p className="text-[11px] text-gray-500">
                        {pacingInfo.delayMinutes} মিনিটে ১টি করে মেসেজ যাবে (অ্যান্টি-ব্যান ভ্যারিয়েশন সহ)
                      </p>
                    </div>
                    <span className="text-base font-black px-3 py-1 rounded-lg bg-[#164E43] text-white">
                      {ratePerHour} / ঘণ্টা
                    </span>
                  </div>

                  <Slider
                    value={ratePerHour}
                    min={5}
                    max={60}
                    step={1}
                    onChange={(val) => setRatePerHour(val)}
                    className="py-2"
                  />

                  <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase">
                    <span>ধীর ও নিরাপদ (৫/ঘণ্টা)</span>
                    <span>মাঝারি (২০/ঘণ্টা)</span>
                    <span>দ্রুত (৬০/ঘণ্টা)</span>
                  </div>
                </div>

                {/* Night Silence Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
                  <div className="space-y-0.5 max-w-[80%]">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                        নাইট সাইলেন্স রুল (রাত ১২:০০ টা - সকাল ৮:০০ টা বন্ধ)
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300">
                      রাত ১২টা বাজলে মেসেজ পাঠানো স্বয়ংক্রিয়ভাবে স্থগিত হয়ে যাবে এবং সকাল ৮টা বাজলে স্বয়ংক্রিয়ভাবে চালু হবে। গ্রাহক বিরক্ত হবে না এবং ব্যান ঝুঁকি শূন্য থাকবে।
                    </p>
                  </div>
                  <Switch checked={quietHoursEnabled} onCheckedChange={setQuietHoursEnabled} />
                </div>

                {/* Deduplication Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930]">
                  <div className="space-y-0.5 max-w-[85%]">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                        একই মানুষকে দুইবার মেসেজ পাঠাবেন না (Strict Deduplication)
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      এই তালিকায় বা পূর্বে সফলভাবে মেসেজ পাঠানো হয়েছে এমন নাম্বারকে দ্বিতীয়বার আর মেসেজ পাঠাবে না।
                    </p>
                  </div>
                  <Switch
                    checked={deduplicateAgainstHistory}
                    onCheckedChange={setDeduplicateAgainstHistory}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Message & Media Composer (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border-[#E6E2D8] dark:border-[#262930] shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#164E43] dark:text-[#34D399]" />
                  <span>৩. বার্তা ও ফাইল অ্যাটাচমেন্ট</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  টেক্সটের সাথে ছবি, অডিও, ভিডিও অথবা পিডিএফ ক্যাটালগ যুক্ত করুন।
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5">
                {/* Campaign Title */}
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">
                    ক্যাম্পেইন শিরোনাম (Internal Title):
                  </label>
                  <Input
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    placeholder="টার্গেটেড স্পেশাল অফার"
                    className="h-9 text-xs rounded-lg"
                  />
                </div>

                {/* Message Text with Tags */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      মেসেজ কনটেন্ট:
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setMessageText((prev) => prev + ' {name}')}
                        className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-[#164E43] dark:text-[#34D399]"
                      >
                        + {'{name}'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMessageText((prev) => prev + ' {time}')}
                        className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      >
                        + {'{time}'}
                      </button>
                    </div>
                  </div>
                  <Textarea
                    rows={6}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="আপনার বার্তা লিখুন..."
                    className="text-xs rounded-xl bg-[#FAF8F5] dark:bg-[#181A1F] border-[#E6E2D8] dark:border-[#262930]"
                  />
                </div>

                {/* Media Upload Buttons */}
                <div className="space-y-2 pt-1 border-t border-[#E6E2D8] dark:border-[#262930]">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                    মিডিয়া ফাইল যুক্ত করুন (Cloudflare R2 স্টোরেজ):
                  </label>

                  {/* Image Attachment */}
                  <div className="flex items-center justify-between p-2 rounded-xl border border-[#E6E2D8] dark:border-[#262930] bg-[#FAF8F5] dark:bg-[#181A1F]">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div className="text-xs truncate">
                        <span className="font-bold block text-gray-900 dark:text-white">ছবি (Image)</span>
                        <span className="text-[10px] text-gray-500 truncate block">
                          {imageUrl ? imageUrl.split('/').pop() : 'কোনো ছবি যুক্ত করা হয়নি'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {imageUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setImageUrl('')}
                          className="h-7 w-7 p-0 text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, 'image')}
                        />
                        <span className="inline-flex items-center h-7 px-2.5 rounded-lg text-xs font-bold bg-[#164E43] text-white hover:bg-[#124238]">
                          {uploadingType === 'image' ? 'আপলোড হচ্ছে...' : imageUrl ? 'পরিবর্তন' : 'আপলোড'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Audio Attachment */}
                  <div className="flex items-center justify-between p-2 rounded-xl border border-[#E6E2D8] dark:border-[#262930] bg-[#FAF8F5] dark:bg-[#181A1F]">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div className="text-xs truncate">
                        <span className="font-bold block text-gray-900 dark:text-white">ভয়েস / অডিও (Audio)</span>
                        <span className="text-[10px] text-gray-500 truncate block">
                          {audioUrl ? audioUrl.split('/').pop() : 'কোনো অডিও যুক্ত করা হয়নি'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {audioUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setAudioUrl('')}
                          className="h-7 w-7 p-0 text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, 'audio')}
                        />
                        <span className="inline-flex items-center h-7 px-2.5 rounded-lg text-xs font-bold bg-[#164E43] text-white hover:bg-[#124238]">
                          {uploadingType === 'audio' ? 'আপলোড হচ্ছে...' : audioUrl ? 'পরিবর্তন' : 'আপলোড'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Document Attachment */}
                  <div className="flex items-center justify-between p-2 rounded-xl border border-[#E6E2D8] dark:border-[#262930] bg-[#FAF8F5] dark:bg-[#181A1F]">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="text-xs truncate">
                        <span className="font-bold block text-gray-900 dark:text-white">পিডিএফ / ফাইল (Document)</span>
                        <span className="text-[10px] text-gray-500 truncate block">
                          {documentName || (documentUrl ? documentUrl.split('/').pop() : 'কোনো ডকুমেন্ট যুক্ত করা হয়নি')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {documentUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDocumentUrl('');
                            setDocumentName('');
                          }}
                          className="h-7 w-7 p-0 text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, 'document')}
                        />
                        <span className="inline-flex items-center h-7 px-2.5 rounded-lg text-xs font-bold bg-[#164E43] text-white hover:bg-[#124238]">
                          {uploadingType === 'document' ? 'আপলোড হচ্ছে...' : documentUrl ? 'পরিবর্তন' : 'আপলোড'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Start Campaign Action Button */}
                <div className="pt-2">
                  <Button
                    type="button"
                    disabled={submitting || parsedNumbersData.totalCount === 0}
                    onClick={handleStartCampaign}
                    className="w-full h-12 rounded-xl bg-[#164E43] hover:bg-[#124238] text-white font-black text-sm shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {submitting
                        ? 'ক্যাম্পেইন প্রস্তুত হচ্ছে...'
                        : `ক্যাম্পেইন শুরু করুন (${parsedNumbersData.totalCount} জন গ্রাহক)`}
                    </span>
                  </Button>
                  <p className="text-[11px] text-center text-gray-500 mt-2">
                    ⏱️ আনুমানিক সময়: {pacingInfo.estActiveHours} ঘণ্টা ({ratePerHour}/ঘণ্টা হারে)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Monitor & Live Queue Tab */
        <div className="space-y-4">
          {/* Progress Overview Card */}
          <Card className="border-[#E6E2D8] dark:border-[#262930] shadow-sm overflow-hidden">
            <CardHeader className="bg-[#FAF8F5] dark:bg-[#181A1F] border-b border-[#E6E2D8] dark:border-[#262930] pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'w-2.5 h-2.5 rounded-full',
                        job?.status === 'running'
                          ? 'bg-emerald-500 animate-pulse'
                          : job?.status === 'paused'
                          ? 'bg-amber-500'
                          : 'bg-gray-400'
                      )}
                    />
                    <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                      {job?.title || 'কোনো সক্রিয় ক্যাম্পেইন নেই'}
                    </h2>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-black uppercase tracking-wider',
                        job?.status === 'running'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : job?.status === 'paused'
                          ? 'bg-amber-50 text-amber-700 border-amber-300'
                          : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {job?.status === 'running'
                        ? 'চলমান (Running)'
                        : job?.status === 'paused'
                        ? 'স্থগিত (Paused)'
                        : job?.status === 'completed'
                        ? 'সম্পন্ন (Completed)'
                        : 'অপেক্ষারত (Idle)'}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    গতি: {job?.ratePerHour || ratePerHour} মেসেজ / ঘণ্টা • প্রতি{' '}
                    {((job?.minDelaySeconds || pacingInfo.delaySec) / 60).toFixed(1)} মিনিটে একটি
                  </p>
                </div>

                {/* Queue Control Buttons */}
                {job && (
                  <div className="flex items-center gap-2">
                    {job.status === 'running' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handlePause}
                        className="h-9 px-3 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs font-bold"
                      >
                        <Pause className="w-3.5 h-3.5 mr-1" />
                        স্থগিত করুন
                      </Button>
                    ) : job.status === 'paused' ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleResume}
                        className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        <Play className="w-3.5 h-3.5 mr-1" />
                        চালু করুন
                      </Button>
                    ) : null}

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleStop}
                      className="h-9 px-3 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-bold"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      রিসেট / বন্ধ
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
                  <span>অগ্রগতি ({progressPercent}%)</span>
                  <span>
                    {job?.sentCount || 0} / {job?.totalNumbers || 0} পাঠানো সম্পন্ন
                  </span>
                </div>
                <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#164E43] to-[#34D399] transition-all duration-500 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Countdown or Quiet Hours Notification */}
              {isQuietHoursNow && job?.quietHoursEnabled && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                  <Moon className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>
                    <strong>নাইট সাইলেন্স চালু আছে:</strong> রাত ১২:০০ থেকে সকাল ৮:০০ পর্যন্ত মেসেজ পাঠানো বন্ধ রয়েছে। সকাল ৮:০০ টায় স্বয়ংক্রিয়ভাবে আবার মেসেজ পাঠানো শুরু হবে।
                  </span>
                </div>
              )}

              {job?.status === 'running' && !isQuietHoursNow && secondsUntilNext !== null && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600 animate-spin" />
                    <span>পরবর্তী মেসেজ পাঠানোর বাকি: <strong>{secondsUntilNext} সেকেন্ড</strong></span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    নির্ধারিত সময়: {job.nextScheduledSendAt ? new Date(job.nextScheduledSendAt).toLocaleTimeString('bn-BD') : ''}
                  </span>
                </div>
              )}

              {/* 4 Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] text-center">
                  <div className="text-[11px] font-bold text-gray-500">মোট নাম্বার</div>
                  <div className="text-xl font-black text-gray-900 dark:text-white mt-0.5">
                    {job?.totalNumbers || 0}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 text-center">
                  <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">সফলভাবে প্রেরিত</div>
                  <div className="text-xl font-black text-emerald-600 mt-0.5">
                    {job?.sentCount || 0}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 text-center">
                  <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400">অপেক্ষারত (Queue)</div>
                  <div className="text-xl font-black text-blue-600 mt-0.5">
                    {job ? job.totalNumbers - job.sentCount - job.failedCount : 0}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-red-50/60 dark:bg-red-950/20 border border-red-200/50 text-center">
                  <div className="text-[11px] font-bold text-red-700 dark:text-red-400">ব্যর্থ (Failed)</div>
                  <div className="text-xl font-black text-red-600 mt-0.5">
                    {job?.failedCount || 0}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Queue List Table */}
          <Card className="border-[#E6E2D8] dark:border-[#262930] shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#164E43] dark:text-[#34D399]" />
                  <span>গ্রাহক কিউ তালিকা ({filteredRecipients.length})</span>
                </CardTitle>

                {/* Search & Filter Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative w-48">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                    <Input
                      value={queueSearch}
                      onChange={(e) => setQueueSearch(e.target.value)}
                      placeholder="নাম্বার খুঁজুন..."
                      className="h-8 pl-8 text-xs rounded-lg"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-[#FAF8F5] dark:bg-[#181A1F] p-0.5 rounded-lg border border-[#E6E2D8] dark:border-[#262930] text-xs">
                    {(['all', 'pending', 'sent', 'failed'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setQueueFilter(f)}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-[11px] font-bold capitalize transition-all',
                          queueFilter === f
                            ? 'bg-[#164E43] text-white'
                            : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                        )}
                      >
                        {f === 'all' ? 'সব' : f === 'pending' ? 'অপেক্ষারত' : f === 'sent' ? 'প্রেরিত' : 'ব্যর্থ'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] dark:bg-[#181A1F] border-b border-[#E6E2D8] dark:border-[#262930] text-[11px] font-bold text-gray-500 uppercase sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-4 w-12">#</th>
                      <th className="py-2.5 px-4">গ্রাহক</th>
                      <th className="py-2.5 px-4">স্ট্যাটাস</th>
                      <th className="py-2.5 px-4">প্রেরক সিম</th>
                      <th className="py-2.5 px-4 text-right">সময়</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E2D8] dark:divide-[#262930]">
                    {filteredRecipients.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400">
                          কোনো গ্রাহক পাওয়া যায়নি
                        </td>
                      </tr>
                    ) : (
                      filteredRecipients.map((r, idx) => (
                        <tr key={r.phone + idx} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                          <td className="py-2.5 px-4 font-mono text-gray-400">{idx + 1}</td>
                          <td className="py-2.5 px-4 font-medium text-gray-900 dark:text-white">
                            <div>+{r.phone}</div>
                            {r.name && <div className="text-[10px] text-gray-500">{r.name}</div>}
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1',
                                r.status === 'sent'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : r.status === 'sending'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 animate-pulse'
                                  : r.status === 'failed'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                              )}
                            >
                              {r.status === 'sent' && <Check className="w-3 h-3" />}
                              {r.status === 'pending' && <Clock className="w-3 h-3" />}
                              {r.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                              {r.status === 'sending' && <Send className="w-3 h-3" />}
                              {r.status === 'sent'
                                ? 'সফল'
                                : r.status === 'sending'
                                ? 'পাঠানো হচ্ছে...'
                                : r.status === 'failed'
                                ? 'ব্যর্থ'
                                : 'অপেক্ষারত'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-gray-500 text-[11px]">
                            {r.sentFromAccountId ? `SIM: ${r.sentFromAccountId}` : 'অপেক্ষারত'}
                          </td>
                          <td className="py-2.5 px-4 text-right text-gray-500 text-[11px] font-mono">
                            {r.sentAt ? new Date(r.sentAt).toLocaleTimeString('bn-BD') : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

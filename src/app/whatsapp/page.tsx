'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { StatsCard } from '@/components/StatsCard';
import { WhatsAppNumbers } from '@/components/WhatsAppNumbers';
import { CampaignCard } from '@/components/CampaignCard';
import { WhatsAppMessageLog } from '@/components/WhatsAppMessageLog';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Send, 
  Layers, 
  Users, 
  CheckCircle2, 
  Smartphone,
  Sparkles,
  Phone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WaCampaign, WaDashboardStats, WaConnection } from '@/lib/whatsappTypes';

export default function WhatsAppDashboardPage() {
  const [followupData, setFollowupData] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('wa_cached_followup');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  });
  const [campaigns, setCampaigns] = useState<WaCampaign[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('wa_cached_campaigns');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });
  const [accounts, setAccounts] = useState<WaConnection[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('wa_cached_accounts');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [stats, setStats] = useState<WaDashboardStats>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('wa_cached_stats');
        if (cached) {
          return JSON.parse(cached);
        }
      } catch {}
    }
    return {
      totalCampaigns: 0,
      activeCampaigns: 0,
      totalSent: 0,
      uniqueUsers: 0,
      connectionStatus: 'disconnected',
    };
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('wa_cached_campaigns');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return false;
        }
      } catch {}
    }
    return true;
  });

  const fetchDashboardData = async () => {
    try {
      const [campRes, statusRes, accountsRes, followupRes] = await Promise.all([
        fetch(`/api/whatsapp/campaigns?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/whatsapp/status?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/whatsapp/accounts?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/whatsapp/followup?t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      const campData = await campRes.json().catch(() => ({}));
      const statusData = await statusRes.json().catch(() => ({}));
      const accountsData = await accountsRes.json().catch(() => ({}));
      const fupData = await followupRes.json().catch(() => ({}));

      if (fupData && fupData.ok) {
        setFollowupData(fupData);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('wa_cached_followup', JSON.stringify(fupData));
          } catch {}
        }
      }

      const list: WaCampaign[] = Array.isArray(campData.campaigns) ? campData.campaigns : [];
      setCampaigns(list);
      if (list.length > 0 && typeof window !== 'undefined') {
        try {
          localStorage.setItem('wa_cached_campaigns', JSON.stringify(list));
        } catch {}
      }

      const accs: WaConnection[] = Array.isArray(accountsData.accounts) ? accountsData.accounts : [];
      setAccounts(accs);
      if (accs.length > 0 && typeof window !== 'undefined') {
        try {
          localStorage.setItem('wa_cached_accounts', JSON.stringify(accs));
        } catch {}
      }

      let freshStats: WaDashboardStats;
      if (statusData.ok && statusData.stats) {
        freshStats = statusData.stats;
      } else {
        freshStats = {
          totalCampaigns: list.length,
          activeCampaigns: list.filter(c => c.isActive).length,
          totalSent: list.reduce((sum, c) => sum + (c.totalSent || 0), 0),
          uniqueUsers: 0,
          connectionStatus: statusData.connection?.status || 'disconnected',
        };
      }
      setStats(freshStats);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('wa_cached_stats', JSON.stringify(freshStats));
        } catch {}
      }
    } catch (err) {
      console.error('Failed to fetch WhatsApp dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign? All message logs for this campaign will also be deleted.')) {
      return;
    }
    try {
      await fetch(`/api/whatsapp/campaigns/${id}`, { method: 'DELETE' });
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed deleting campaign:', err);
    }
  };

  const handleToggleFollowup = async () => {
    if (!followupData) return;
    const currentVal = Boolean(followupData.settings?.auto_followup);
    const newVal = !currentVal;

    setFollowupData((prev: any) => ({
      ...prev,
      settings: { ...prev?.settings, auto_followup: newVal },
    }));

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wa_followup_auto_followup', String(newVal));
      } catch {}
    }

    try {
      await fetch('/api/whatsapp/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_setting',
          key: 'auto_followup',
          value: newVal,
        }),
      });
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to toggle followup from main page:', err);
    }
  };

  // Filtered campaigns based on tab selection
  const filteredCampaigns = campaigns.filter(c => {
    if (selectedFilter === 'all') return true;
    return c.accountId === selectedFilter || (!c.accountId && selectedFilter === 'main') || c.accountId === 'all';
  });

  const connectedAccountsCount = accounts.filter(a => a.status === 'connected').length;

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </span>
            WhatsApp Automation
          </h1>
        </div>

        <Link href="/whatsapp/campaigns/new">
          <Button className="bg-[#164E43] hover:bg-[#124238] text-white font-semibold text-xs h-9 px-4 shadow-sm rounded-xl">
            <Plus className="w-4 h-4 mr-1.5" />
            New Campaign
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard
          title="WhatsApp Numbers"
          value={`${connectedAccountsCount} / ${accounts.length || 1} Connected`}
          icon={Smartphone}
        />
        <StatsCard
          title="Running Campaigns"
          value={stats.activeCampaigns}
          icon={CheckCircle2}
        />
        <StatsCard
          title="Total Delivered"
          value={stats.totalSent}
          icon={Send}
        />
        <StatsCard
          title="Unique Customers"
          value={stats.uniqueUsers}
          icon={Users}
        />
      </div>

      {/* 1. Connected WhatsApp Numbers Section */}
      <WhatsAppNumbers 
        accounts={accounts}
        campaigns={campaigns} 
        onDataChange={fetchDashboardData} 
      />

      {/* 1.5 Active Auto Follow-up Live Monitor Card */}
      <div className={cn(
        "p-4 sm:p-5 rounded-2xl border shadow-sm transition-all",
        followupData?.settings?.auto_followup
          ? "bg-gradient-to-br from-emerald-500/10 via-[#FAF8F5] to-[#F5F2EB] dark:from-emerald-950/20 dark:via-[#15171C] dark:to-[#121418] border-emerald-500/30 dark:border-emerald-700/40"
          : "bg-[#FAF8F5] dark:bg-[#181A1F] border-[#E6E2D8] dark:border-[#262930]"
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
              followupData?.settings?.auto_followup
                ? "bg-[#164E43] text-white shadow-emerald-900/20"
                : "bg-gray-200 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400"
            )}>
              <Sparkles className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "w-2.5 h-2.5 rounded-full shrink-0",
                  followupData?.settings?.auto_followup ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
                )} />
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                  স্মার্ট ফলো-আপ সিস্টেম (Auto Follow-up Engine)
                </h3>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[11px] font-bold border",
                  followupData?.settings?.auto_followup
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-700"
                )}>
                  {followupData?.settings?.auto_followup ? 'সক্রিয় ও রানিং (ACTIVE)' : 'বন্ধ আছে (PAUSED)'}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-300 mt-1 flex-wrap font-medium">
                <span>🔄 ভ্যারিয়েশন: <strong>{followupData?.variants?.length || 0}টি সংরক্ষিত</strong> ({followupData?.variants?.filter((v: any) => v.isActive)?.length || 0}টি রোটেশনে)</span>
                <span>•</span>
                <span>⏱️ বিরতি: <strong>{followupData?.settings?.min_delay_minutes || 45}-{followupData?.settings?.max_delay_minutes || 90} মি.</strong></span>
                <span>•</span>
                <span>👥 ব্যাচ: <strong>{followupData?.settings?.min_batch_people || 3}-{followupData?.settings?.max_batch_people || 5} জন</strong></span>
                <span>•</span>
                <span>📱 সিম: <strong>{followupData?.settings?.assigned_account_name || 'All Connected'}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleFollowup}
              className={cn(
                "h-9 px-3.5 text-xs font-bold rounded-xl border transition-colors",
                followupData?.settings?.auto_followup
                  ? "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
                  : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              )}
            >
              {followupData?.settings?.auto_followup ? 'পজ করুন (Pause)' : '▶️ চালু করুন (Turn ON)'}
            </Button>

            <Link href="/whatsapp/new-followup">
              <Button className="bg-[#164E43] hover:bg-[#124238] text-white font-bold text-xs h-9 px-4 rounded-xl shadow-sm">
                ⚙️ ভ্যারিয়েশন ও সেটিংস এডিট
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. All Running Campaigns Section (Outside window overview) */}
      <div className="space-y-3 pt-3 border-t border-[#E6E2D8] dark:border-[#262930]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              All Running Campaigns
            </h2>
          </div>

          <Link href="/whatsapp/campaigns/new">
            <Button variant="outline" size="sm" className="text-xs border-[#E6E2D8] dark:border-[#262930] text-emerald-700 dark:text-emerald-400 hover:bg-[#EDE8DE] dark:hover:bg-[#1F2228] h-8 px-3 rounded-lg">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Campaign
            </Button>
          </Link>
        </div>


        {/* Filter Tabs by Number */}
        {accounts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 pb-1">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                selectedFilter === 'all'
                  ? 'bg-[#164E43] text-white border-[#164E43] shadow-xs'
                  : 'bg-[#FAF8F5] dark:bg-[#181A1F] border-[#E6E2D8] dark:border-[#262930] text-gray-800 dark:text-gray-200 hover:bg-[#EDE8DE] dark:hover:bg-[#22262C] hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              🌐 All Numbers ({campaigns.length})
            </button>

            {accounts.map(acc => {
              const count = campaigns.filter(c => c.accountId === acc.id || (!c.accountId && acc.id === 'main') || c.accountId === 'all').length;
              const phoneLabel = acc.phoneNumber ? ` (+${acc.phoneNumber.replace(/^\+/, '')})` : '';
              return (
                <button
                  key={acc.id}
                  onClick={() => setSelectedFilter(acc.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    selectedFilter === acc.id
                      ? 'bg-[#164E43] text-white border-[#164E43] shadow-xs'
                      : 'bg-[#FAF8F5] dark:bg-[#181A1F] border-[#E6E2D8] dark:border-[#262930] text-gray-800 dark:text-gray-200 hover:bg-[#EDE8DE] dark:hover:bg-[#22262C] hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Phone className="w-3 h-3 shrink-0 text-emerald-700 dark:text-emerald-400" />
                  <span>{acc.name}{phoneLabel}</span>
                  <span className="opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Campaigns Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-xl bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930]" />
            ))}
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-14 px-4 rounded-2xl bg-[#FBF9F4] dark:bg-[#181A1F] border border-dashed border-[#E6E2D8] dark:border-[#262930]">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              {selectedFilter === 'all' ? 'No campaigns created yet' : 'No campaigns for this number'}
            </h3>
            <Link href={selectedFilter === 'all' ? '/whatsapp/campaigns/new' : `/whatsapp/campaigns/new?accountId=${selectedFilter}`}>
              <Button className="bg-[#164E43] hover:bg-[#124238] text-white font-semibold text-xs px-5 shadow-sm">
                <Plus className="w-4 h-4 mr-1.5" />
                Create New Campaign
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampaigns.map((camp) => (
              <CampaignCard
                key={camp.id}
                campaign={camp}
                accounts={accounts}
                onToggleActive={fetchDashboardData}
                onDelete={handleDeleteCampaign}
              />
            ))}
          </div>
        )}
      </div>

      {/* 3. Message Delivery Logs */}
      <div className="space-y-3 pt-4 border-t border-[#E6E2D8] dark:border-[#262930]">
        <WhatsAppMessageLog />
      </div>
    </div>
  );
}

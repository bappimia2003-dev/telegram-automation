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
  Phone,
  ChevronDown
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
  const [openAddNumberModal, setOpenAddNumberModal] = useState<boolean>(false);
  const [showRunningCampaigns, setShowRunningCampaigns] = useState<boolean>(false);
  const [authData, setAuthData] = useState<any>(null);

  const fetchDashboardData = async () => {
    try {
      const [campRes, statusRes, accountsRes, followupRes, authRes] = await Promise.all([
        fetch(`/api/whatsapp/campaigns?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/whatsapp/status?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/whatsapp/accounts?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/whatsapp/followup?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/auth?t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      const campData = await campRes.json().catch(() => ({}));
      const statusData = await statusRes.json().catch(() => ({}));
      const accountsData = await accountsRes.json().catch(() => ({}));
      const fupData = await followupRes.json().catch(() => ({}));
      const authJson = await authRes.json().catch(() => ({}));

      if (authJson?.authenticated) {
        setAuthData(authJson);
        if (authJson.role === 'client') {
          setShowRunningCampaigns(true);
        }
      }

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
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('wa_cached_campaigns', JSON.stringify(list));
        } catch {}
      }

      const accs: WaConnection[] = Array.isArray(accountsData.accounts) ? accountsData.accounts : [];
      setAccounts(accs);
      if (typeof window !== 'undefined') {
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
  const isClient = authData?.role === 'client';
  const clientInfo = authData?.client;
  const isClientExpired = Boolean(clientInfo?.isExpired);
  const numberQuotaReached = isClient && clientInfo && accounts.length >= clientInfo.maxWhatsappNumbers;
  const campaignQuotaReached = isClient && clientInfo && campaigns.length >= clientInfo.maxCampaigns;

  return (
    <div className="space-y-8 pb-16">
      {/* Client Profile & Quota Summary Card (Visible when logged in as Client) */}
      {isClient && clientInfo && (
        <div className="rounded-2xl bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              {clientInfo.remainingDays !== null && clientInfo.remainingDays !== undefined && (
                <span
                  className={cn(
                    "absolute -top-2.5 -right-2.5 z-10 px-2 py-0.5 rounded-full text-[10px] font-extrabold shadow-sm border leading-tight",
                    isClientExpired || clientInfo.remainingDays <= 0
                      ? "bg-red-600 text-white border-red-400 animate-pulse"
                      : clientInfo.remainingDays <= 5
                      ? "bg-amber-500 text-white border-amber-300"
                      : "bg-[#164E43] text-white border-[#227968]"
                  )}
                >
                  {isClientExpired || clientInfo.remainingDays <= 0 ? '0d' : `${clientInfo.remainingDays}d`}
                </span>
              )}
              <div className="w-12 h-12 rounded-2xl bg-[#164E43]/10 dark:bg-[#34D399]/10 border border-[#164E43]/20 dark:border-[#34D399]/20 flex items-center justify-center text-[#164E43] dark:text-[#34D399] font-extrabold text-lg">
                {clientInfo.name.charAt(0).toUpperCase()}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">{clientInfo.name}</h3>
                <span
                  className={cn(
                    "text-[11px] font-bold px-2.5 py-0.5 rounded-full border",
                    isClientExpired
                      ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                  )}
                >
                  {isClientExpired
                    ? '⚠️ Expired — Campaigns Auto Off'
                    : clientInfo.remainingDays !== null
                    ? `⏳ ${clientInfo.remainingDays} Days Remaining`
                    : 'Active Plan'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                আপনার নির্ধারিত প্যানেল লিমিট ও সাবস্ক্রিপশন স্ট্যাটাস
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
            <div className="px-3.5 py-2 rounded-xl bg-[#F4F1EB] dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#262930]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                WhatsApp Numbers
              </div>
              <div className="text-sm font-extrabold text-gray-900 dark:text-white mt-0.5">
                {accounts.length} / {clientInfo.maxWhatsappNumbers} Used
              </div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-[#F4F1EB] dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#262930]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Campaigns Quota
              </div>
              <div className="text-sm font-extrabold text-gray-900 dark:text-white mt-0.5">
                {campaigns.length} / {clientInfo.maxCampaigns} Used
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto sm:justify-end">
        {!isClient && (
          <Link href="/whatsapp/clients" className="col-span-2 sm:col-span-1 w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full h-11 sm:h-10 px-4 rounded-[14px] sm:rounded-xl border-[1.5px] border-[#E6E2D8] dark:border-[#262930] bg-[#FBF9F4] dark:bg-[#181A1F] text-gray-900 dark:text-white hover:bg-[#EDE8DE] dark:hover:bg-[#22262C] font-bold text-sm sm:text-xs flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4 shrink-0 text-[#164E43] dark:text-[#34D399]" />
              <span>Clients Panel</span>
            </Button>
          </Link>
        )}

        {isClientExpired || campaignQuotaReached ? (
          <Button
            type="button"
            onClick={() =>
              alert(
                isClientExpired
                  ? 'আপনার প্ল্যানের মেয়াদ শেষ হয়ে গেছে (0 Days Left)। নতুন ক্যাম্পেইন তৈরি করতে অ্যাডমিনের সাথে যোগাযোগ করুন।'
                  : `আপনার ক্যাম্পেইন লিমিট পূর্ণ হয়ে গেছে (${clientInfo?.maxCampaigns}/${clientInfo?.maxCampaigns})।`
              )
            }
            className="w-full sm:w-auto h-11 sm:h-10 px-4 rounded-[14px] sm:rounded-xl bg-gray-400 dark:bg-gray-700 text-white font-bold text-sm sm:text-xs flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>New Campaign {campaignQuotaReached ? '(Full)' : '(Expired)'}</span>
          </Button>
        ) : (
          <Link href="/whatsapp/campaigns/new" className="w-full sm:w-auto">
            <Button className="w-full h-11 sm:h-10 px-4 rounded-[14px] sm:rounded-xl bg-[#164E43] hover:bg-[#124238] text-white font-bold text-sm sm:text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
              <Plus className="w-4 h-4 shrink-0" />
              <span>New Campaign</span>
            </Button>
          </Link>
        )}

        <Button 
          type="button"
          onClick={() => {
            if (isClientExpired) {
              alert('আপনার প্ল্যানের মেয়াদ শেষ হয়ে গেছে (0 Days Left)। অ্যাডমিনের সাথে যোগাযোগ করুন।');
              return;
            }
            if (numberQuotaReached) {
              alert(`আপনার হোয়াটসঅ্যাপ নাম্বার লিমিট পূর্ণ হয়ে গেছে (${clientInfo?.maxWhatsappNumbers}/${clientInfo?.maxWhatsappNumbers})।`);
              return;
            }
            setOpenAddNumberModal(true);
          }}
          variant="outline"
          className="w-full sm:w-auto h-11 sm:h-10 px-4 rounded-[14px] sm:rounded-xl border-[1.5px] border-[#164F43] dark:border-[#34D399] text-[#164F43] dark:text-[#34D399] hover:bg-[#164F43]/10 dark:hover:bg-[#34D399]/10 font-bold text-sm sm:text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Add Number {numberQuotaReached ? `(${accounts.length}/${clientInfo?.maxWhatsappNumbers})` : ''}</span>
        </Button>
      </div>

      {/* Stats Cards (2 cols on mobile, 4 cols on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatsCard
          title="WhatsApp Numbers"
          value={
            isClient && clientInfo
              ? `${accounts.length} / ${clientInfo.maxWhatsappNumbers} Allowed`
              : `${connectedAccountsCount} / ${accounts.length || 1} Connected`
          }
          icon={Smartphone}
        />
        <StatsCard
          title="Running Campaigns"
          value={
            isClient && clientInfo
              ? `${stats.activeCampaigns} (${campaigns.length}/${clientInfo.maxCampaigns})`
              : stats.activeCampaigns
          }
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
        externalAddModalOpen={openAddNumberModal}
        onCloseExternalAddModal={() => setOpenAddNumberModal(false)}
      />

      {/* 2. All Running Campaigns Section (Collapsible - shows ONLY on click) */}
      <div className="space-y-3 pt-3 border-t border-[#E6E2D8] dark:border-[#262930]">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowRunningCampaigns(prev => !prev)}
            className="flex items-center gap-2 group cursor-pointer text-left focus:outline-none select-none hover:opacity-80 transition-opacity"
          >
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 font-['Sora',sans-serif]">
              <span>All Running Campaigns</span>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-[#E3F1EA] dark:bg-[#1E2D27] text-[#164F43] dark:text-[#5FD1A5]">
                {campaigns.length}
              </span>
            </h2>
          </button>

          <Link href="/whatsapp/campaigns/new">
            <Button variant="outline" size="sm" className="text-xs border-[#E6E2D8] dark:border-[#262930] text-emerald-700 dark:text-emerald-400 hover:bg-[#EDE8DE] dark:hover:bg-[#1F2228] h-8 px-3 rounded-lg">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Campaign
            </Button>
          </Link>
        </div>

        {/* Filter Tabs & Campaigns Grid (Shown ONLY when clicked) */}
        {showRunningCampaigns && (
          <div className="space-y-3 pt-1">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-start">
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
        )}
      </div>

      {/* 3. Message Delivery Logs */}
      <div className="space-y-3 pt-4 border-t border-[#E6E2D8] dark:border-[#262930]">
        <WhatsAppMessageLog />
      </div>
    </div>
  );
}

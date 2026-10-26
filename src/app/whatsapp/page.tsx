'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { StatsCard } from '@/components/StatsCard';
import { WhatsAppNumbers } from '@/components/WhatsAppNumbers';
import { CampaignCard } from '@/components/CampaignCard';
import { WhatsAppMessageLog } from '@/components/WhatsAppMessageLog';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useLanguage } from '@/components/LanguageProvider';
import { 
  Plus, 
  Send, 
  Users, 
  CheckCircle2, 
  Smartphone,
  Phone,
  Search,
  Table as TableIcon,
  LayoutGrid,
  Trash2,
  Edit,
  MessageSquare,
  Layers,
  Bot,
  Webhook,
  Play,
  Pause,
  CheckSquare,
  ChevronDown,
  Loader2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WaCampaign, WaDashboardStats, WaConnection, WaMessageLog } from '@/lib/whatsappTypes';

export default function WhatsAppDashboardPage() {
  const { t } = useLanguage();
  const [followupData, setFollowupData] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
  const [accounts, setAccounts] = useState<WaConnection[]>([]);
  const [logs, setLogs] = useState<WaMessageLog[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<WaDashboardStats>({
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalSent: 0,
    uniqueUsers: 0,
    connectionStatus: 'disconnected',
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [openAddNumberModal, setOpenAddNumberModal] = useState<boolean>(false);
  const [authData, setAuthData] = useState<any>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeleteCamp, setConfirmDeleteCamp] = useState<WaCampaign | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState<'activate' | 'pause' | 'delete' | null>(null);
  const [bulkMenuOpen, setBulkMenuOpen] = useState<boolean>(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState<boolean>(false);

  const safeFetchJson = async (url: string) => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return {};
      const text = await res.text();
      if (!text || text.trim().startsWith('<')) return {};
      return JSON.parse(text);
    } catch {
      return {};
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [campData, statusData, accountsData, fupData, logsData, authJson] = await Promise.all([
        safeFetchJson(`/api/whatsapp/campaigns?t=${Date.now()}`),
        safeFetchJson(`/api/whatsapp/status?t=${Date.now()}`),
        safeFetchJson(`/api/whatsapp/accounts?t=${Date.now()}`),
        safeFetchJson(`/api/whatsapp/followup?t=${Date.now()}`),
        safeFetchJson(`/api/whatsapp/logs?limit=200&t=${Date.now()}`),
        safeFetchJson(`/api/auth?t=${Date.now()}`),
      ]);

      if (authJson?.authenticated) setAuthData(authJson);
      if (fupData && fupData.ok) setFollowupData(fupData);

      let list: WaCampaign[] = Array.isArray(campData.campaigns) ? campData.campaigns : [];
      try {
        const savedDeletedCamps = localStorage.getItem('wa_deleted_campaign_ids');
        if (savedDeletedCamps) {
          const deletedCampSet = new Set(JSON.parse(savedDeletedCamps));
          list = list.filter((c) => !deletedCampSet.has(c.id));
        }
      } catch {}
      list = list.map((c) => ({
        ...c,
        name: c.name === 'Gemini Pro AI Support' ? 'JalaBot Pro Support' : c.name,
      }));
      setCampaigns(list);

      let accs: WaConnection[] = Array.isArray(accountsData.accounts) ? accountsData.accounts : [];
      try {
        const savedDeleted = localStorage.getItem('wa_deleted_account_ids');
        if (savedDeleted) {
          const deletedSet = new Set(JSON.parse(savedDeleted));
          accs = accs.filter((a) => !deletedSet.has(a.id));
        }
      } catch {}
      accs = accs.map((a) => ({
        ...a,
        name: a.name === 'Gemini WhatsApp' ? 'JalaBot Official SIM' : a.name,
      }));
      setAccounts(accs);

      const logList: WaMessageLog[] = Array.isArray(logsData.logs) ? logsData.logs : [];
      setLogs(logList);

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
    } catch {
      // Transient fetch errors are safely ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleCampaign = async (id: string, currentActive: boolean) => {
    setTogglingId(id);
    const newActive = !currentActive;
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, isActive: newActive } : c));
    try {
      await fetch(`/api/whatsapp/campaigns/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newActive }),
      });
      await fetchDashboardData();
    } catch {
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, isActive: currentActive } : c));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    try {
      const saved = localStorage.getItem('wa_deleted_campaign_ids');
      const arr = saved ? JSON.parse(saved) : [];
      if (!arr.includes(id)) arr.push(id);
      localStorage.setItem('wa_deleted_campaign_ids', JSON.stringify(arr));
    } catch {}
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch(`/api/whatsapp/campaigns/${id}`, { method: 'DELETE' });
      await fetchDashboardData();
    } catch {}
  };

  const handleBulkToggle = async (targetActive: boolean) => {
    if (selectedCampaignIds.size === 0 || bulkActionLoading) return;
    const ids = Array.from(selectedCampaignIds);
    setBulkMenuOpen(false);
    setBulkActionLoading(targetActive ? 'activate' : 'pause');

    // Optimistic UI update
    setCampaigns((prev) =>
      prev.map((c) => (selectedCampaignIds.has(c.id) ? { ...c, isActive: targetActive } : c))
    );
    try {
      ids.forEach((id) => {
        localStorage.setItem(`wa_camp_active_${id}`, String(targetActive));
      });
    } catch {}

    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/whatsapp/campaigns/${id}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: targetActive }),
          })
        )
      );
      setSelectedCampaignIds(new Set());
      await fetchDashboardData();
    } catch {
      await fetchDashboardData();
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCampaignIds.size === 0 || bulkActionLoading) return;
    const ids = Array.from(selectedCampaignIds);
    setBulkMenuOpen(false);
    setBulkActionLoading('delete');

    try {
      const saved = localStorage.getItem('wa_deleted_campaign_ids');
      const arr: string[] = saved ? JSON.parse(saved) : [];
      ids.forEach((id) => {
        if (!arr.includes(id)) arr.push(id);
      });
      localStorage.setItem('wa_deleted_campaign_ids', JSON.stringify(arr));
    } catch {}

    setCampaigns((prev) => prev.filter((c) => !selectedCampaignIds.has(c.id)));

    try {
      await Promise.all(
        ids.map((id) => fetch(`/api/whatsapp/campaigns/${id}`, { method: 'DELETE' }))
      );
      setSelectedCampaignIds(new Set());
      await fetchDashboardData();
    } catch {
      await fetchDashboardData();
    } finally {
      setBulkActionLoading(null);
      setConfirmBulkDelete(false);
    }
  };

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      if (selectedFilter !== 'all') {
        const matchesAcc = c.accountId === selectedFilter || (!c.accountId && selectedFilter === 'main') || c.accountId === 'all';
        if (!matchesAcc) return false;
      }
      if (statusFilter === 'active' && !c.isActive) return false;
      if (statusFilter === 'paused' && c.isActive) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesKw = c.keywords?.toLowerCase().includes(q);
        const matchesDesc = c.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesKw && !matchesDesc) return false;
      }

      return true;
    });
  }, [campaigns, selectedFilter, statusFilter, searchQuery]);

  const connectedAccountsCount = accounts.filter(a => a.status === 'connected').length;

  const toggleSelectAll = () => {
    if (selectedCampaignIds.size === filteredCampaigns.length) {
      setSelectedCampaignIds(new Set());
    } else {
      setSelectedCampaignIds(new Set(filteredCampaigns.map(c => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedCampaignIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCampaignIds(next);
  };

  // Compute per-campaign Delivery Rate and Webhook Status
  const getCampaignTelemetry = (camp: WaCampaign) => {
    const campLogs = logs.filter(l => l.campaignId === camp.id);
    const sentLogs = campLogs.filter(l => l.status === 'sent').length;
    const failedLogs = campLogs.filter(l => l.status === 'failed').length;

    let deliveryRate = 100;
    if (sentLogs + failedLogs > 0) {
      deliveryRate = Math.round((sentLogs / (sentLogs + failedLogs)) * 1000) / 10;
    }

    const isAll = !camp.accountId || camp.accountId === 'all';
    const acc = accounts.find(a => a.id === camp.accountId);
    const isDeviceOnline = isAll
      ? accounts.some(a => a.status === 'connected') || accounts.length === 0
      : acc?.status === 'connected';

    const webhookStatus = !camp.isActive
      ? { label: 'Muted', detail: 'Paused', tone: 'text-muted-foreground' }
      : isDeviceOnline
      ? { label: 'Listening', detail: '200 OK', tone: 'text-[#075E54] dark:text-[#00A884]' }
      : { label: 'Standby', detail: 'Wait SIM', tone: 'text-amber-600 dark:text-amber-400' };

    const mediaParts: string[] = [];
    if (camp.welcomeMessage?.trim()) mediaParts.push('Text');
    if (camp.imageUrl?.trim()) mediaParts.push('Image');
    if (camp.audioUrl?.trim()) mediaParts.push('Audio');
    if (camp.videoUrl?.trim()) mediaParts.push('Video');
    if (camp.documentUrl?.trim()) mediaParts.push('Doc');

    return {
      deliveryRate,
      failedLogs,
      webhookStatus,
      isAll,
      acc,
      accountLabel: isAll ? 'All Devices' : (acc?.name || camp.accountId || 'Primary'),
      mediaSummary: mediaParts.length > 0 ? mediaParts.join(' · ') : 'Sequence',
    };
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header Toolbar with Telegram Blue Switcher Above WhatsApp Command Center */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-card border border-border p-4 sm:px-5 day-box-shadow">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#075E54]/12 dark:bg-[#00A884]/15 text-[#075E54] dark:text-[#00A884] flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Link
                prefetch={false}
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-[#0088CC] hover:bg-[#0077B5] dark:bg-[#229ED9] dark:hover:bg-[#1E8CC0] text-white shadow-xs transition-all"
              >
                <Bot className="w-3 h-3" />
                <span>{t('Telegram Bot Hub', 'টেলিগ্রাম বট হাব')}</span>
              </Link>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#075E54]/12 dark:bg-[#00A884]/15 text-[#075E54] dark:text-[#00A884]">
                <Smartphone className="w-3 h-3" />
                <span>{t('WhatsApp Active', 'হোয়াটসঅ্যাপ সক্রিয়')}</span>
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
              {t('WhatsApp Business Command Center', 'হোয়াটসঅ্যাপ বিজনেস কমান্ড সেন্টার')}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(
                'Manage multi-SIM connections, automated auto-replies, and scheduled delivery campaigns',
                'মাল্টি-সিম সংযোগ, স্বয়ংক্রিয় অটো-রিপ্লাই এবং শিডিউলড মেসেজ ক্যাম্পেইন পরিচালনা করুন'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpenAddNumberModal(true)}
            className="text-xs font-semibold h-9 rounded-xl border-border bg-secondary/70 hover:bg-secondary text-foreground cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5 mr-1.5 text-[#075E54] dark:text-[#00A884]" />
            <span>{t('Connect Device', 'ডিভাইস যুক্ত করুন')}</span>
          </Button>

          <Link prefetch={false} href="/whatsapp/campaigns/new">
            <Button
              size="sm"
              className="text-xs font-bold h-9 rounded-xl bg-[#075E54] hover:bg-[#064E46] dark:bg-[#00A884] dark:hover:bg-[#008f6f] text-white dark:text-[#111B21] day-box-shadow cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>{t('Create Campaign', 'ক্যাম্পেইন তৈরি করুন')}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. High-Density KPI Metric Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatsCard
          title="Connected Numbers"
          value={`${connectedAccountsCount} / ${accounts.length || 1}`}
          subtitle={`${accounts.length} registered devices`}
          icon={Smartphone}
        />
        <StatsCard
          title="Active Campaigns"
          value={stats.activeCampaigns}
          subtitle={`Out of ${campaigns.length} total`}
          icon={CheckCircle2}
        />
        <StatsCard
          title="Messages Sent"
          value={stats.totalSent}
          subtitle="Delivered via Baileys engine"
          icon={Send}
        />
        <StatsCard
          title="Unique Leads"
          value={stats.uniqueUsers}
          subtitle="Direct customer inquiries"
          icon={Users}
        />
      </div>

      {/* 3. Connected Numbers High-Density Table & Device Strip */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 day-box-shadow">
        <WhatsAppNumbers 
          accounts={accounts}
          campaigns={campaigns}
          logs={logs}
          onDataChange={fetchDashboardData}
          externalAddModalOpen={openAddNumberModal}
          onCloseExternalAddModal={() => setOpenAddNumberModal(false)}
        />
      </div>

      {/* 4. High-Density Campaigns Section */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 day-box-shadow space-y-4">
        {/* Table Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex flex-wrap items-center gap-3">
            {/* Master Select All Checkbox (Works for both Table and Card views) */}
            <label className="inline-flex items-center gap-2 cursor-pointer select-none px-2.5 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary border border-border text-xs font-bold text-foreground transition-colors">
              <input
                type="checkbox"
                checked={filteredCampaigns.length > 0 && selectedCampaignIds.size === filteredCampaigns.length}
                onChange={toggleSelectAll}
                className="w-3.5 h-3.5 rounded border-border text-[#075E54] focus:ring-0 cursor-pointer"
              />
              <span>{t('Select All', 'সব নির্বাচন')}</span>
            </label>

            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-foreground">
                {t('Campaigns Directory', 'ক্যাম্পেইন তালিকা')}
              </h2>
              <span className="text-xs font-mono tabular-nums font-semibold text-muted-foreground">
                ({filteredCampaigns.length})
              </span>
            </div>
          </div>

          {/* Search, Filter Tabs & View Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#075E54] dark:focus:ring-[#00A884]"
              />
            </div>

            {/* Status Segmented Control */}
            <div className="flex items-center p-0.5 bg-secondary rounded-lg">
              {(['all', 'active', 'paused'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded-md transition-all capitalize cursor-pointer",
                    statusFilter === tab 
                      ? "bg-card text-foreground shadow-xs font-bold" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* View Switcher: Table vs Cards */}
            <div className="flex items-center p-0.5 bg-secondary rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Compact Table View"
                className={cn(
                  "p-1.5 rounded-md transition-all cursor-pointer",
                  viewMode === 'table' ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                title="Card Grid View"
                className={cn(
                  "p-1.5 rounded-md transition-all cursor-pointer",
                  viewMode === 'cards' ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Prominent Bulk Action Menu Bar when 1 or more campaigns are selected */}
        {selectedCampaignIds.size > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-[#075E54]/8 dark:bg-[#00A884]/12 border border-[#075E54]/30 dark:border-[#00A884]/30 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#075E54] dark:bg-[#00A884] text-white dark:text-[#0B141A] text-xs font-extrabold font-mono tabular-nums shadow-xs">
                <CheckSquare className="w-3.5 h-3.5" />
                <span>
                  {selectedCampaignIds.size} {t('Selected', 'টি নির্বাচিত')}
                </span>
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {t(
                  'Apply bulk status changes to all selected campaigns at once:',
                  'নির্বাচিত সব ক্যাম্পেইনে একসাথে বাল্ক অ্যাকশন প্রয়োগ করুন:'
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 relative">
              {/* Quick Activate Selected Button */}
              <button
                type="button"
                disabled={Boolean(bulkActionLoading)}
                onClick={() => handleBulkToggle(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#075E54] hover:bg-[#064E46] dark:bg-[#00A884] dark:hover:bg-[#008f6f] text-white dark:text-[#0B141A] text-xs font-extrabold shadow-xs transition-all cursor-pointer disabled:opacity-60"
              >
                {bulkActionLoading === 'activate' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>{t('Activate Selected', 'সক্রিয় করুন (Activate)')}</span>
              </button>

              {/* Quick Pause Selected Button */}
              <button
                type="button"
                disabled={Boolean(bulkActionLoading)}
                onClick={() => handleBulkToggle(false)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-extrabold transition-all cursor-pointer disabled:opacity-60"
              >
                {bulkActionLoading === 'pause' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
                <span>{t('Pause Selected', 'বিরতি দিন (Pause)')}</span>
              </button>

              {/* Bulk Action Dropdown Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBulkMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-card hover:bg-secondary text-foreground border border-border text-xs font-bold transition-colors cursor-pointer"
                >
                  <span>{t('Bulk Menu', 'বাল্ক মেনু')}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {bulkMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-52 rounded-xl bg-card border border-border day-box-shadow py-1.5 z-50 text-xs">
                    <button
                      type="button"
                      onClick={() => handleBulkToggle(true)}
                      className="w-full px-3.5 py-2 text-left hover:bg-secondary flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{t('Activate All Selected', 'নির্বাচিত সব সক্রিয় করুন')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkToggle(false)}
                      className="w-full px-3.5 py-2 text-left hover:bg-secondary flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400 cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>{t('Pause All Selected', 'নির্বাচিত সব পজ করুন')}</span>
                    </button>
                    <div className="my-1 border-t border-border" />
                    <button
                      type="button"
                      onClick={() => {
                        setBulkMenuOpen(false);
                        setConfirmBulkDelete(true);
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-red-500/10 flex items-center gap-2 font-bold text-red-600 dark:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('Delete Selected Campaigns', 'নির্বাচিত ক্যাম্পেইন মুছুন')}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Clear Selection Button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedCampaignIds(new Set());
                  setBulkMenuOpen(false);
                }}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-xs font-bold transition-colors cursor-pointer"
                title={t('Clear selection', 'নির্বাচন বাতিল করুন')}
              >
                <X className="w-3.5 h-3.5" />
                <span>{t('Clear', 'বাতিল')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Filter by Device Tabs */}
        {accounts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground font-semibold mr-1">Device:</span>
            <button
              onClick={() => setSelectedFilter('all')}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer",
                selectedFilter === 'all'
                  ? "bg-[#075E54] dark:bg-[#00A884] text-white dark:text-[#0B141A] border-transparent"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              All Devices
            </button>
            {accounts.map(acc => {
              const count = campaigns.filter(c => c.accountId === acc.id || (!c.accountId && acc.id === 'main') || c.accountId === 'all').length;
              return (
                <button
                  key={acc.id}
                  onClick={() => setSelectedFilter(acc.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer",
                    selectedFilter === acc.id
                      ? "bg-[#075E54] dark:bg-[#00A884] text-white dark:text-[#0B141A] border-transparent"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Phone className="w-3 h-3" />
                  <span>{acc.name || 'Account'}</span>
                  <span className="opacity-75 font-mono tabular-nums">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Content View: High-Density Table OR Card Grid */}
        {loading ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 bg-secondary rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border bg-secondary/30">
            <Layers className="w-8 h-8 text-[#075E54] dark:text-[#00A884] mx-auto mb-2 opacity-60" />
            <h3 className="text-sm font-bold text-foreground">No campaigns match your filters</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {searchQuery ? 'Try clearing your search query or switching filters.' : 'Create your first campaign to begin automated messaging.'}
            </p>
            <Link prefetch={false} href="/whatsapp/campaigns/new" className="inline-block mt-3">
              <Button size="sm" className="text-xs font-bold bg-[#075E54] dark:bg-[#00A884] text-white dark:text-[#111B21]">
                <Plus className="w-3.5 h-3.5 mr-1" /> Create Campaign
              </Button>
            </Link>
          </div>
        ) : viewMode === 'table' ? (
          /* High-Density Compact Table with Webhook Status & Delivery Rate */
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/60 text-muted-foreground font-semibold border-b border-border select-none">
                <tr className="h-9">
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={selectedCampaignIds.size > 0 && selectedCampaignIds.size === filteredCampaigns.length}
                      onChange={toggleSelectAll}
                      className="rounded border-border text-[#075E54] focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-2">Campaign & Trigger</th>
                  <th className="px-3 py-2 hidden md:table-cell">Device / Account</th>
                  <th className="px-3 py-2">Webhook Status</th>
                  <th className="px-3 py-2 text-right">Delivery Rate</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCampaigns.map((camp) => {
                  const isSelected = selectedCampaignIds.has(camp.id);
                  const tel = getCampaignTelemetry(camp);

                  return (
                    <tr 
                      key={camp.id} 
                      className={cn(
                        "hover:bg-secondary/40 transition-colors",
                        isSelected && "bg-[#075E54]/5 dark:bg-[#00A884]/10"
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(camp.id)}
                          className="rounded border-border text-[#075E54] focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* 1. Campaign Name, Trigger Keywords & Mobile Device Info */}
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5 min-w-[140px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link 
                              prefetch={false}
                              href={`/whatsapp/campaigns/${camp.id}`}
                              className="font-bold text-foreground hover:text-[#075E54] dark:hover:text-[#00A884] transition-colors truncate"
                            >
                              {camp.name}
                            </Link>
                            {camp.isDefault && (
                              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                · Default Fallback
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            {camp.keywords ? (
                              <span className="truncate max-w-[200px]">
                                Keywords: <strong className="text-foreground">{camp.keywords}</strong>
                              </span>
                            ) : (
                              <span>Auto-Send Sequence</span>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>{tel.mediaSummary}</span>
                            <span className="md:hidden" aria-hidden="true">·</span>
                            <span className="md:hidden font-medium text-foreground">{tel.accountLabel}</span>
                          </div>

                          {/* Mobile Inline Actions */}
                          <div className="flex sm:hidden items-center gap-1.5 mt-1.5">
                            <Link prefetch={false} href={`/whatsapp/campaigns/${camp.id}`}>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-bold bg-secondary text-foreground cursor-pointer"
                              >
                                <Edit className="w-3 h-3" />
                                <span>{t('Edit', 'এডিট')}</span>
                              </button>
                            </Link>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteCamp(camp)}
                              className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>{t('Delete', 'ডিলিট')}</span>
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 2. Device / Account (Desktop) */}
                      <td className="px-3 py-2.5 hidden md:table-cell whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Smartphone className="w-3.5 h-3.5 text-[#075E54] dark:text-[#00A884] shrink-0" />
                          <span className="font-medium text-foreground">{tel.accountLabel}</span>
                        </div>
                      </td>

                      {/* 3. Webhook Status (Visible on both Desktop & Mobile) */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Webhook className={cn("w-3.5 h-3.5 shrink-0", tel.webhookStatus.tone)} />
                          <div className="leading-tight">
                            <span className={cn("font-bold block sm:inline", tel.webhookStatus.tone)}>
                              {tel.webhookStatus.label}
                            </span>
                            <span className="hidden lg:inline text-muted-foreground mx-1" aria-hidden="true">·</span>
                            <span className="block lg:inline text-[10px] font-mono tabular-nums text-muted-foreground">
                              {tel.webhookStatus.detail}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 4. Delivery Rate & Total Sent (Visible on both Desktop & Mobile) */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex flex-col items-end">
                          <div className="flex items-center gap-1.5 font-mono tabular-nums">
                            <span className="font-bold text-foreground">{tel.deliveryRate.toFixed(1)}%</span>
                            <span className="text-[11px] text-muted-foreground">({camp.totalSent ?? 0})</span>
                          </div>
                          <div className="w-14 h-1 bg-secondary rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-[#075E54] dark:bg-[#00A884] rounded-full transition-all"
                              style={{ width: `${Math.min(100, Math.max(0, tel.deliveryRate))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 5. Campaign Active / Paused Toggle */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          disabled={togglingId === camp.id}
                          onClick={() => handleToggleCampaign(camp.id, camp.isActive)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                            camp.isActive
                              ? "bg-[#25D366]/15 text-[#075E54] dark:text-[#00A884]"
                              : "bg-secondary text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <span>{camp.isActive ? 'Active' : 'Paused'}</span>
                        </button>
                      </td>

                      {/* 6. Actions */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Link prefetch={false} href={`/whatsapp/campaigns/${camp.id}`}>
                            <button 
                              type="button" 
                              title="Edit / Configure Campaign"
                              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </Link>

                          <button
                            type="button"
                            title="Delete Campaign"
                            onClick={() => setConfirmDeleteCamp(camp)}
                            className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Cards Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCampaigns.map((camp) => (
              <CampaignCard
                key={camp.id}
                campaign={camp}
                accounts={accounts}
                logs={logs}
                selected={selectedCampaignIds.has(camp.id)}
                onToggleSelect={toggleSelectOne}
                onToggleActive={fetchDashboardData}
                onDelete={() => setConfirmDeleteCamp(camp)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm Bulk Delete Campaigns Modal (OK / Cancel) */}
      <ConfirmDialog
        open={confirmBulkDelete}
        title={t('Delete Selected Campaigns?', 'নির্বাচিত ক্যাম্পেইনগুলো মুছে ফেলবেন?')}
        description={t(
          `Are you sure you want to permanently delete ${selectedCampaignIds.size} selected campaign(s)? Click OK to confirm or Cancel to keep them.`,
          `আপনি কি নিশ্চিতভাবে নির্বাচিত ${selectedCampaignIds.size}টি ক্যাম্পেইন স্থায়ীভাবে মুছে ফেলতে চান? নিশ্চিত করতে OK এবং না চাইলে Cancel চাপুন।`
        )}
        confirmLabel={t('OK, Delete All', 'ওকে, সব মুছুন (OK)')}
        cancelLabel={t('Cancel', 'বাতিল (Cancel)')}
        variant="danger"
        loading={bulkActionLoading === 'delete'}
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />

      {/* Confirm Delete Campaign Modal (OK / Cancel) */}
      <ConfirmDialog
        open={Boolean(confirmDeleteCamp)}
        title={t('Delete Campaign?', 'ক্যাম্পেইন মুছে ফেলবেন?')}
        description={
          confirmDeleteCamp
            ? t(
                `Are you sure you want to delete campaign "${confirmDeleteCamp.name}"? Click OK to confirm or Cancel to keep it.`,
                `আপনি কি নিশ্চিতভাবে "${confirmDeleteCamp.name}" ক্যাম্পেইনটি মুছে ফেলতে চান? নিশ্চিত করতে OK এবং না চাইলে Cancel চাপুন।`
              )
            : ''
        }
        confirmLabel={t('OK, Delete', 'ওকে (OK)')}
        cancelLabel={t('Cancel', 'বাতিল (Cancel)')}
        variant="danger"
        onConfirm={async () => {
          if (!confirmDeleteCamp) return;
          const id = confirmDeleteCamp.id;
          setConfirmDeleteCamp(null);
          await handleDeleteCampaign(id);
        }}
        onCancel={() => setConfirmDeleteCamp(null)}
      />

      {/* 5. Live Message Delivery Logs */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 day-box-shadow">
        <WhatsAppMessageLog />
      </div>
    </div>
  );
}

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
import { WaCampaign, WaDashboardStats, WaConnection } from '@/lib/whatsappTypes';

export default function WhatsAppDashboardPage() {
  const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
  const [accounts, setAccounts] = useState<WaConnection[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [stats, setStats] = useState<WaDashboardStats>({
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalSent: 0,
    uniqueUsers: 0,
    connectionStatus: 'disconnected',
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [campRes, statusRes, accountsRes] = await Promise.all([
        fetch(`/api/whatsapp/campaigns?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/whatsapp/status?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/whatsapp/accounts?t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      const campData = await campRes.json().catch(() => ({}));
      const statusData = await statusRes.json().catch(() => ({}));
      const accountsData = await accountsRes.json().catch(() => ({}));

      const list: WaCampaign[] = Array.isArray(campData.campaigns) ? campData.campaigns : [];
      setCampaigns(list);

      const accs: WaConnection[] = Array.isArray(accountsData.accounts) ? accountsData.accounts : [];
      setAccounts(accs);

      if (statusData.ok && statusData.stats) {
        setStats(statusData.stats);
      } else {
        setStats({
          totalCampaigns: list.length,
          activeCampaigns: list.filter(c => c.isActive).length,
          totalSent: list.reduce((sum, c) => sum + (c.totalSent || 0), 0),
          uniqueUsers: 0,
          connectionStatus: statusData.connection?.status || 'disconnected',
        });
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

  // Filtered campaigns based on tab selection
  const filteredCampaigns = campaigns.filter(c => {
    if (selectedFilter === 'all') return true;
    return c.accountId === selectedFilter || (!c.accountId && selectedFilter === 'main');
  });

  const connectedAccountsCount = accounts.filter(a => a.status === 'connected').length;

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-6 h-6" />
            </span>
            WhatsApp Automation
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Auto-send audio, video, image & text files to Facebook Ad leads for all your WhatsApp SIMs.
          </p>
        </div>

        <Link href="/whatsapp/campaigns/new">
          <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-900/30">
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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
        campaigns={campaigns} 
        onDataChange={fetchDashboardData} 
      />

      {/* 2. All Running Campaigns Section (Outside window overview) */}
      <div className="space-y-4 pt-4 border-t border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              All Running Campaigns (সবগুলো রানিং ক্যাম্পেইন)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Overview of all active ad campaigns across your connected numbers. Filter by number or manage any campaign.
            </p>
          </div>

          <Link href="/whatsapp/campaigns/new">
            <Button variant="outline" size="sm" className="text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Campaign
            </Button>
          </Link>
        </div>

        {/* Filter Tabs by Number */}
        {accounts.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1 pb-2">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                selectedFilter === 'all'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                  : 'bg-secondary/40 border-border/40 text-muted-foreground hover:bg-secondary/70 hover:text-white'
              }`}
            >
              🌐 All Numbers ({campaigns.length})
            </button>

            {accounts.map(acc => {
              const count = campaigns.filter(c => c.accountId === acc.id || (!c.accountId && acc.id === 'main') || c.accountId === 'all').length;
              return (
                <button
                  key={acc.id}
                  onClick={() => setSelectedFilter(acc.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedFilter === acc.id
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                      : 'bg-secondary/40 border-border/40 text-muted-foreground hover:bg-secondary/70 hover:text-white'
                  }`}
                >
                  <Phone className="w-3 h-3" />
                  <span>{acc.name}</span>
                  <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Campaigns Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-xl bg-card/40 border border-border/40" />
            ))}
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-14 px-4 rounded-2xl bg-card/20 border border-dashed border-border/60">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              {selectedFilter === 'all' ? 'No campaigns created yet' : 'No campaigns for this number'}
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mb-6">
              Create an ad campaign to automatically send audio, video, image & text when Facebook Ad leads send keywords.
            </p>
            <Link href={selectedFilter === 'all' ? '/whatsapp/campaigns/new' : `/whatsapp/campaigns/new?accountId=${selectedFilter}`}>
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-5">
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
                onToggleActive={fetchDashboardData}
                onDelete={handleDeleteCampaign}
              />
            ))}
          </div>
        )}
      </div>

      {/* 3. Message Delivery Logs */}
      <div className="space-y-3 pt-4 border-t border-border/40">
        <WhatsAppMessageLog />
      </div>
    </div>
  );
}

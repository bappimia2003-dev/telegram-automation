'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { StatsCard } from '@/components/StatsCard';
import { WhatsAppStatus } from '@/components/WhatsAppStatus';
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
  Sparkles
} from 'lucide-react';
import { WaCampaign, WaDashboardStats } from '@/lib/whatsappTypes';

export default function WhatsAppDashboardPage() {
  const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
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
      const [campRes, statusRes] = await Promise.all([
        fetch(`/api/whatsapp/campaigns?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/whatsapp/status?t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      const campData = await campRes.json().catch(() => ({}));
      const statusData = await statusRes.json().catch(() => ({}));

      const list: WaCampaign[] = Array.isArray(campData.campaigns) ? campData.campaigns : [];
      setCampaigns(list);

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
            Auto-send audio, video, image & text messages to Facebook Ad leads with 1-time guarantee.
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
          title="Total Campaigns"
          value={stats.totalCampaigns}
          icon={Layers}
        />
        <StatsCard
          title="Active Campaigns"
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

      {/* Connection & QR Status */}
      <WhatsAppStatus onStatusChange={fetchDashboardData} />

      {/* Campaigns Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Your Ad Campaigns</h2>
            <p className="text-xs text-muted-foreground">
              Each campaign matches specific Facebook Ad quick-reply buttons and sends assigned files.
            </p>
          </div>

          <Link href="/whatsapp/campaigns/new">
            <Button variant="outline" size="sm" className="text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Campaign
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-xl bg-card/40 border border-border/40" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl bg-card/20 border border-dashed border-border/60">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">No campaigns created yet</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mb-6">
              Create your first WhatsApp Ad campaign (e.g. for Gemini Pro or CapCut) to start automatically sending files to leads.
            </p>
            <Link href="/whatsapp/campaigns/new">
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-5">
                <Plus className="w-4 h-4 mr-1.5" />
                Create First Campaign
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((camp) => (
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

      {/* Message Delivery Logs */}
      <div className="space-y-3 pt-4">
        <WhatsAppMessageLog />
      </div>
    </div>
  );
}

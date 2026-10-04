'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Smartphone, 
  ArrowLeft, 
  Plus, 
  QrCode, 
  Power, 
  RefreshCw, 
  CheckCircle2, 
  Layers, 
  Send, 
  Sparkles,
  ShieldCheck,
  Edit3,
  Trash2,
  Clock,
  ExternalLink,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { StatsCard } from '@/components/StatsCard';
import { CampaignCard } from '@/components/CampaignCard';
import { WaCampaign, WaConnection, WaMessageLog } from '@/lib/whatsappTypes';

export default function WhatsAppNumberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;

  const [account, setAccount] = useState<WaConnection | null>(null);
  const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
  const [logs, setLogs] = useState<WaMessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const fetchNumberData = async () => {
    try {
      const [accRes, campRes, logsRes] = await Promise.all([
        fetch(`/api/whatsapp/accounts/${accountId}?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/whatsapp/campaigns?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/whatsapp/logs?limit=20&t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      const accData = await accRes.json().catch(() => ({}));
      const campData = await campRes.json().catch(() => ({}));
      const logsData = await logsRes.json().catch(() => ({}));

      if (accData.ok && accData.account) {
        setAccount(accData.account);
        setEditName(accData.account.name || '');
        setEditPhone(accData.account.phoneNumber || '');
      }

      const allCamps: WaCampaign[] = Array.isArray(campData.campaigns) ? campData.campaigns : [];
      // Filter campaigns belonging to this number or all
      const filtered = allCamps.filter(
        c => c.accountId === accountId || (!c.accountId && accountId === 'main') || c.accountId === 'all'
      );
      setCampaigns(filtered);

      const allLogs: WaMessageLog[] = Array.isArray(logsData.logs) ? logsData.logs : [];
      // Filter logs for this account's campaigns
      const filteredCampIds = new Set(filtered.map(c => c.id));
      setLogs(allLogs.filter(l => filteredCampIds.has(l.campaignId)));
    } catch (err) {
      console.error('Failed to fetch number dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accountId) {
      fetchNumberData();
      const interval = setInterval(fetchNumberData, 4000);
      return () => clearInterval(interval);
    }
  }, [accountId]);

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      await fetch(`/api/whatsapp/accounts/${accountId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' }),
      });
      await fetchNumberData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect this WhatsApp number?')) return;
    setActionLoading(true);
    try {
      await fetch(`/api/whatsapp/accounts/${accountId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      await fetchNumberData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await fetch(`/api/whatsapp/accounts/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), phoneNumber: editPhone.trim() }),
      });
      setShowEdit(false);
      await fetchNumberData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await fetch(`/api/whatsapp/campaigns/${id}`, { method: 'DELETE' });
      await fetchNumberData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !account) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-48 bg-gray-50 rounded" />
        <div className="h-40 bg-white rounded-2xl shadow-sm border border-gray-200" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-white shadow-sm border border-gray-200 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const isConnected = account?.status === 'connected';
  const isPending = account?.status === 'qr_pending' || account?.status === 'connecting';
  const totalSent = campaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0);

  return (
    <div className="space-y-8 pb-16">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link 
          href="/whatsapp" 
          className="flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to All WhatsApp Numbers & Campaigns
        </Link>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowEdit(true)}
            className="text-xs border-gray-200 text-gray-500 hover:text-gray-900 rounded-xl font-semibold shadow-sm"
          >
            <Edit3 className="w-3.5 h-3.5 mr-1" />
            Edit Name & Phone
          </Button>
        </div>
      </div>

      {/* Number Profile & Live Connection Banner */}
      <Card className="border-gray-200 bg-white overflow-hidden relative shadow-sm rounded-2xl">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
                isConnected 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                <Smartphone className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {account?.name || (accountId === 'main' ? 'Primary WhatsApp' : `SIM ${accountId.slice(-4)}`)}
                  </h1>
                  <Badge 
                    variant="outline" 
                    className={`text-xs font-semibold ${
                      isConnected 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : isPending 
                        ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}
                  >
                    {isConnected ? '🟢 Connected' : isPending ? '🟡 Scan QR Code' : '⚪ Disconnected'}
                  </Badge>
                </div>

                <div className="text-sm font-mono text-emerald-700">
                  {account?.phoneNumber ? (
                    <span>+{account.phoneNumber}</span>
                  ) : (
                    <span className="text-gray-500 italic font-sans text-xs">
                      {isConnected ? 'Device linked' : 'No phone linked yet - scan QR below'}
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-500 pt-1">
                  Facebook Ad quick-reply messages matching keywords assigned to this number will auto-deliver files instantly.
                </p>
              </div>
            </div>

            {/* Top Right Action Button */}
            <div className="flex items-center gap-3 shrink-0">
              {isConnected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                  className="border-red-200 text-red-600 hover:bg-red-50 text-xs rounded-xl font-semibold shadow-sm"
                >
                  <Power className="w-3.5 h-3.5 mr-1.5" />
                  Disconnect Number
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleConnect}
                  disabled={actionLoading}
                  className="bg-green-700 hover:bg-green-600 text-white text-xs rounded-xl font-semibold shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Refresh Connection
                </Button>
              )}
            </div>
          </div>

          {/* QR Code Scanner (If not connected) */}
          {!isConnected && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row items-center gap-6">
                <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-200 shrink-0 flex items-center justify-center">
                  {account?.qrCode ? (
                    <img
                      src={account.qrCode}
                      alt="WhatsApp QR Code"
                      className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 sm:w-52 sm:h-52 flex flex-col items-center justify-center text-gray-600 text-xs gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-green-700" />
                      <span>Generating QR code...</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3 text-xs">
                  <h4 className="text-sm font-semibold text-gray-900">
                    এই নম্বরে WhatsApp কানেক্ট করতে QR কোড স্ক্যান করুন:
                  </h4>
                  <ol className="space-y-2 text-gray-500 list-decimal pl-4">
                    <li>আপনার ফোনের <strong className="text-gray-900">WhatsApp</strong> খুলুন</li>
                    <li><strong className="text-gray-900">Settings</strong> বা ৩-ডট মেনুতে যান</li>
                    <li><strong className="text-gray-900">Linked Devices</strong> সিলেক্ট করুন</li>
                    <li><strong className="text-gray-900">Link a Device</strong> এ চাপ দিয়ে ক্যামেরার সামনে এই QR কোডটি ধরুন</li>
                  </ol>
                  <div className="pt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleConnect}
                      disabled={actionLoading}
                      className="text-xs border-gray-200 hover:border-gray-300 rounded-xl font-semibold shadow-sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />
                      Refresh QR Code
                    </Button>
                    <span className="text-[11px] text-gray-500">Auto-refreshes every 4s</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats for this Number */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatsCard
          title="Assigned Campaigns"
          value={campaigns.length}
          icon={Layers}
        />
        <StatsCard
          title="Active Campaigns"
          value={campaigns.filter(c => c.isActive).length}
          icon={CheckCircle2}
        />
        <StatsCard
          title="Delivered by this Number"
          value={totalSent}
          icon={Send}
        />
      </div>

      {/* Campaigns Section for this Number */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-700" />
              Campaigns Running on this Number ({campaigns.length})
            </h2>
            <p className="text-xs text-gray-500">
              এই নম্বরে যে বিজ্ঞাপন ক্যাম্পেইনগুলো চালানো হচ্ছে এবং কাস্টমার কীওয়ার্ড লিখলে অটো ফাইল যাবে।
            </p>
          </div>

          <Link href={`/whatsapp/campaigns/new?accountId=${accountId}&returnTo=/whatsapp/numbers/${accountId}`}>
            <Button className="bg-green-700 hover:bg-green-600 text-white font-semibold text-xs h-9 px-4 rounded-xl shadow-sm">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Campaign for this Number
            </Button>
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="text-center py-14 px-4 rounded-2xl bg-gray-50 border border-dashed border-gray-200 space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No campaigns assigned to this number yet</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Create a campaign for this number with Facebook Ad quick-reply keywords, audio voice notes, and video/images.
            </p>
            <div className="pt-2">
              <Link href={`/whatsapp/campaigns/new?accountId=${accountId}&returnTo=/whatsapp/numbers/${accountId}`}>
                <Button className="bg-green-700 hover:bg-green-600 text-white font-semibold text-xs px-5 rounded-xl shadow-sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create Campaign for this Number
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((camp) => (
              <CampaignCard
                key={camp.id}
                campaign={camp}
                account={account || undefined}
                accounts={account ? [account] : []}
                onToggleActive={fetchNumberData}
                onDelete={handleDeleteCampaign}
              />
            ))}
          </div>
        )}
      </div>

      {/* Message Delivery Logs for this Number */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-700" />
              Recent Delivery Logs for this Number
            </h3>
            <p className="text-xs text-gray-500">
              Recent messages and media auto-sent by this WhatsApp number
            </p>
          </div>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-gray-500 italic p-4 rounded-xl bg-gray-50 border border-gray-200">
            No message logs yet for this number. Messages will appear here as soon as leads text your keywords.
          </p>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-200 text-xs shadow-sm">
            {logs.map((log) => (
              <div key={log.id} className="p-3 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="font-medium text-gray-900">{log.phoneNumber} ({log.contactName || 'Lead'})</p>
                  <p className="text-[11px] text-gray-500">
                    Sent {log.messageType.toUpperCase()} • {new Date(log.sentAt).toLocaleTimeString()}
                  </p>
                </div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                  Delivered
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Edit Name and Phone */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-in fade-in">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Edit Number Details</h3>
                  <p className="text-xs text-gray-500">নাম বা নাম্বার পরিবর্তন করুন</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEdit(false)}
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-900">
                  SIM / Account Nickname *
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="bg-white border-gray-200 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-900">
                  WhatsApp Phone Number
                </label>
                <Input
                  placeholder="e.g. 8801712345678"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="bg-white border-gray-200 text-sm font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-200">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowEdit(false)}
                  className="text-xs text-gray-500 hover:text-gray-900 rounded-xl font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading || !editName.trim()}
                  className="bg-green-700 hover:bg-green-600 text-white font-semibold text-xs px-4 rounded-xl shadow-sm"
                >
                  {actionLoading ? 'Saving...' : 'Update Details'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

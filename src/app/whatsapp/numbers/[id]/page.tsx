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
    const newName = editName.trim();
    const newPhone = editPhone.trim();
    setAccount((prev) => (prev ? { ...prev, name: newName, phoneNumber: newPhone || prev.phoneNumber } : prev));
    setShowEdit(false);
    setActionLoading(true);
    try {
      await fetch(`/api/whatsapp/accounts/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, phoneNumber: newPhone }),
      });
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
    <div className="space-y-6 pb-16">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link 
          href="/whatsapp" 
          className="inline-flex items-center text-xs sm:text-sm font-semibold text-[#164E43] dark:text-[#34D399] hover:underline transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to WhatsApp Dashboard
        </Link>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditName(account?.name || '');
              setEditPhone(account?.phoneNumber || '');
              setShowEdit(true);
            }}
            className="text-xs border-[#E4DFD2] dark:border-[#262930] hover:bg-[#EDE8DE] dark:hover:bg-[#1F2228] text-gray-700 dark:text-gray-200 rounded-xl font-bold shadow-xs h-8 px-3"
          >
            <Edit3 className="w-3.5 h-3.5 mr-1 text-[#164E43] dark:text-[#34D399]" />
            Edit Name & Phone
          </Button>
        </div>
      </div>

      {/* Number Profile & Live Connection Banner */}
      <div className="rounded-[20px] bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E4DFD2] dark:border-[#262930] shadow-xs p-5 sm:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 ${
              isConnected 
                ? 'bg-[#164E43] text-white shadow-xs' 
                : 'bg-amber-100 text-amber-700'
            }`}>
              <Smartphone className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-['Sora',sans-serif]">
                  {account?.name || (accountId === 'main' ? 'Primary WhatsApp' : `SIM ${accountId.slice(-4)}`)}
                </h1>
                <Badge 
                  variant="outline" 
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isConnected 
                      ? 'bg-[#E3F1EA] dark:bg-[#1E2D27] text-[#164F43] dark:text-[#5FD1A5] border-[#B7DFCD] dark:border-[#264E3D]' 
                      : isPending 
                      ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                      : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}
                >
                  {isConnected ? '🟢 Connected' : isPending ? '🟡 Scan QR Code' : '⚪ Disconnected'}
                </Badge>
              </div>

              <div className="text-xs sm:text-sm font-mono font-bold text-gray-700 dark:text-gray-300">
                {account?.phoneNumber ? (
                  <span>+{account.phoneNumber.replace(/^\+/, '')}</span>
                ) : (
                  <span className="text-gray-400 italic font-sans text-xs">
                    {isConnected ? 'Device linked' : 'No phone linked yet - scan QR below'}
                  </span>
                )}
              </div>
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
                className="border-red-200 text-red-600 hover:bg-red-50 text-xs rounded-xl font-bold shadow-xs h-9"
              >
                <Power className="w-3.5 h-3.5 mr-1.5" />
                Disconnect Number
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={actionLoading}
                className="bg-[#164E43] hover:bg-[#124238] text-white text-xs rounded-xl font-bold shadow-xs h-9 active:scale-95 transition-transform"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Refresh Connection
              </Button>
            )}
          </div>
        </div>

        {/* QR Code Scanner (If not connected) */}
        {!isConnected && (
          <div className="mt-5 pt-5 border-t border-[#E4DFD2] dark:border-[#262930]">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#121418] border border-[#E4DFD2] dark:border-[#262930] flex flex-col sm:flex-row items-center gap-6">
              <div className="p-3 bg-white rounded-xl shadow-xs border border-gray-200 shrink-0 flex items-center justify-center">
                {account?.qrCode ? (
                  <img
                    src={account.qrCode}
                    alt="WhatsApp QR Code"
                    className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 sm:w-52 sm:h-52 flex flex-col items-center justify-center text-gray-600 text-xs gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#164E43]" />
                    <span>Generating QR code...</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 text-xs">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  এই নম্বরে WhatsApp কানেক্ট করতে QR কোড স্ক্যান করুন:
                </h4>
                <ol className="space-y-2 text-gray-500 list-decimal pl-4">
                  <li>আপনার ফোনের <strong className="text-gray-900 dark:text-white">WhatsApp</strong> খুলুন</li>
                  <li><strong className="text-gray-900 dark:text-white">Settings</strong> বা ৩-ডট মেনুতে যান</li>
                  <li><strong className="text-gray-900 dark:text-white">Linked Devices</strong> সিলেক্ট করুন</li>
                  <li><strong className="text-gray-900 dark:text-white">Link a Device</strong> এ চাপ দিয়ে ক্যামেরার সামনে এই QR কোডটি ধরুন</li>
                </ol>
                <div className="pt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleConnect}
                    disabled={actionLoading}
                    className="text-xs border-[#E4DFD2] dark:border-[#262930] hover:bg-[#EDE8DE] dark:hover:bg-[#1F2228] rounded-xl font-bold shadow-xs"
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
      </div>

      {/* Stats for this Number (Compact 2 cols on mobile, 3 cols on desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
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
          title="Delivered by Number"
          value={totalSent}
          icon={Send}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* Campaigns Section for this Number */}
      <div className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white font-['Sora',sans-serif] flex items-center gap-2">
            <span>Campaigns on this Number</span>
            <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-[#E3F1EA] dark:bg-[#1E2D27] text-[#164F43] dark:text-[#5FD1A5]">
              {campaigns.length}
            </span>
          </h2>

          <Link href={`/whatsapp/campaigns/new?accountId=${accountId}&returnTo=/whatsapp/numbers/${accountId}`}>
            <Button className="bg-[#164E43] hover:bg-[#124238] text-white font-bold text-xs h-9 px-3.5 rounded-xl shadow-xs flex items-center gap-1.5 active:scale-95 transition-transform">
              <Plus className="w-4 h-4 mr-1" />
              Add Campaign
            </Button>
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="text-center py-14 px-4 rounded-[20px] bg-[#FBF9F4] dark:bg-[#181A1F] border border-dashed border-[#E4DFD2] dark:border-[#262930] space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">No campaigns assigned to this number yet</h3>
            <div className="pt-2">
              <Link href={`/whatsapp/campaigns/new?accountId=${accountId}&returnTo=/whatsapp/numbers/${accountId}`}>
                <Button className="bg-[#164E43] hover:bg-[#124238] text-white font-semibold text-xs px-5 rounded-xl shadow-sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create Campaign for this Number
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-start">
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
      <div className="space-y-3 pt-4 border-t border-[#E4DFD2] dark:border-[#262930]">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 dark:text-white font-['Sora',sans-serif] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#164E43] dark:text-[#34D399]" />
            <span>Recent Delivery Logs</span>
          </h3>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-gray-500 italic p-4 rounded-[16px] bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E4DFD2] dark:border-[#262930]">
            No message logs yet for this number.
          </p>
        ) : (
          <div className="rounded-[18px] border border-[#E4DFD2] dark:border-[#262930] bg-[#FBF9F4] dark:bg-[#181A1F] overflow-hidden divide-y divide-[#E4DFD2] dark:divide-[#262930] text-xs shadow-xs">
            {logs.map((log) => (
              <div key={log.id} className="p-3 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="font-medium text-gray-900 dark:text-white">{log.phoneNumber} ({log.contactName || 'Lead'})</p>
                  <p className="text-[11px] text-gray-500">
                    Sent {log.messageType.toUpperCase()} • {new Date(log.sentAt).toLocaleTimeString()}
                  </p>
                </div>
                <Badge variant="outline" className="bg-[#E3F1EA] dark:bg-[#1E2D27] text-[#164F43] dark:text-[#5FD1A5] border-[#B7DFCD] dark:border-[#264E3D] text-[10px]">
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
          <div className="bg-white dark:bg-[#181A1F] border border-[#E4DFD2] dark:border-[#262930] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4DFD2] dark:border-[#262930]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#E3F1EA] dark:bg-[#1E2D27] text-[#164F43] dark:text-[#5FD1A5] flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Edit Number Details</h3>
                  <p className="text-xs text-gray-500">Update SIM nickname or phone number</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEdit(false)}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-900 dark:text-gray-200">
                  SIM / Account Nickname *
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="bg-white dark:bg-[#121418] border-[#E4DFD2] dark:border-[#262930] text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-900 dark:text-gray-200">
                  WhatsApp Phone Number
                </label>
                <Input
                  placeholder="e.g. 8801712345678"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="bg-white dark:bg-[#121418] border-[#E4DFD2] dark:border-[#262930] text-sm font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#E4DFD2] dark:border-[#262930]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowEdit(false)}
                  className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-xl font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading || !editName.trim()}
                  className="bg-[#164E43] hover:bg-[#124238] text-white font-semibold text-xs px-4 rounded-xl shadow-xs"
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

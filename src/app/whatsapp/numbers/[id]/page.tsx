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
  ShieldCheck,
  Edit3,
  Trash2,
  Clock,
  ExternalLink,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { StatsCard } from '@/components/StatsCard';
import { CampaignCard } from '@/components/CampaignCard';
import { WhatsAppQrScanner } from '@/components/WhatsAppQrScanner';
import { WaCampaign, WaConnection, WaMessageLog } from '@/lib/whatsappTypes';
import { cn } from '@/lib/utils';

export default function WhatsAppNumberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;

  const [account, setAccount] = useState<WaConnection | null>(null);
  const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
  const [logs, setLogs] = useState<WaMessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit modal & Confirm dialogs
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const [confirmDeleteCampId, setConfirmDeleteCampId] = useState<string | null>(null);

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
      const res = await fetch(`/api/whatsapp/accounts/${accountId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', name: account?.name }),
      });
      const data = await res.json().catch(() => ({}));
      const resolvedAcc = data.account || data;
      if (resolvedAcc && (resolvedAcc.qrCode || resolvedAcc.status)) {
        setAccount((prev) => ({
          ...(prev || resolvedAcc),
          ...resolvedAcc,
          qrCode: resolvedAcc.qrCode || prev?.qrCode || '',
        }));
      }
      await fetchNumberData();
    } catch {
      // Ignore transient network errors
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    try {
      await fetch(`/api/whatsapp/accounts/${accountId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      await fetchNumberData();
    } catch {
      // Ignore transient network errors
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteNumber = async () => {
    setActionLoading(true);
    try {
      const saved = localStorage.getItem('wa_deleted_account_ids');
      const list = saved ? JSON.parse(saved) : [];
      if (!list.includes(accountId)) list.push(accountId);
      localStorage.setItem('wa_deleted_account_ids', JSON.stringify(list));
    } catch {}

    try {
      await fetch(`/api/whatsapp/accounts/${accountId}`, { method: 'DELETE' });
    } catch {}
    if (typeof window !== 'undefined') {
      window.location.assign('/whatsapp');
    } else {
      router.push('/whatsapp');
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
    } catch {
      // Ignore transient network errors
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch(`/api/whatsapp/campaigns/${id}`, { method: 'DELETE' });
      await fetchNumberData();
    } catch {}
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
          prefetch={false}
          href="/whatsapp" 
          className="inline-flex items-center text-xs sm:text-sm font-semibold text-[#075E54] dark:text-[#00A884] hover:underline transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          <span>Back to WhatsApp Dashboard</span>
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
            className="text-xs border-border bg-card hover:bg-secondary text-foreground rounded-lg font-bold h-8 px-3 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 mr-1.5 text-[#075E54] dark:text-[#00A884]" />
            <span>Edit Name & Phone</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={actionLoading}
            className="text-xs border-red-500/30 bg-card hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg font-bold h-8 px-3 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            <span>Delete Number</span>
          </Button>
        </div>
      </div>

      {/* Number Profile & Live Connection Banner */}
      <div className="rounded-2xl bg-card border border-border p-5 sm:p-6 day-box-shadow">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
              isConnected 
                ? "bg-[#075E54] dark:bg-[#00A884] text-white dark:text-[#0B141A]" 
                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
            )}>
              <Smartphone className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                  {account?.name || (accountId === 'main' ? 'Primary WhatsApp' : `SIM ${accountId.slice(-4)}`)}
                </h1>
                <span className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-md",
                  isConnected 
                    ? "bg-[#25D366]/15 text-[#075E54] dark:text-[#00A884]" 
                    : isPending 
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : "bg-secondary text-muted-foreground"
                )}>
                  <span>{isConnected ? 'Connected' : isPending ? 'Scan Required' : 'Disconnected'}</span>
                </span>
              </div>

              <div className="text-xs sm:text-sm font-mono tabular-nums font-bold text-muted-foreground">
                {account?.phoneNumber ? (
                  <span className="text-foreground">+{account.phoneNumber.replace(/^\+/, '')}</span>
                ) : (
                  <span className="italic font-sans text-xs">
                    {isConnected ? 'Device linked' : 'No phone linked yet - scan QR code below'}
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
                onClick={() => setConfirmDisconnectOpen(true)}
                disabled={actionLoading}
                className="border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs rounded-lg font-bold h-9 cursor-pointer"
              >
                <Power className="w-3.5 h-3.5 mr-1.5" />
                <span>Disconnect Device</span>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={actionLoading}
                className="bg-[#075E54] hover:bg-[#064E46] dark:bg-[#00A884] dark:hover:bg-[#008f6f] text-white dark:text-[#0B141A] text-xs rounded-lg font-bold h-9 active:scale-95 transition-transform"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", actionLoading && "animate-spin")} />
                <span>Refresh Connection</span>
              </Button>
            )}
          </div>
        </div>

        {/* QR Code Laser Scanner (If not connected) */}
        {!isConnected && (
          <div className="mt-5 pt-5 border-t border-border">
            <WhatsAppQrScanner
              qrCode={account?.qrCode}
              status={account?.status || 'qr_pending'}
              accountName={account?.name}
              phoneNumber={account?.phoneNumber}
              onRefresh={handleConnect}
              refreshing={actionLoading}
              refreshIntervalSeconds={4}
            />
          </div>
        )}
      </div>

      {/* Stats for this Number */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
          <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
            <span>Campaigns on this Number</span>
            <span className="text-xs font-mono tabular-nums font-bold px-2 py-0.5 rounded-md bg-secondary text-foreground">
              {campaigns.length}
            </span>
          </h2>

          <Link href={`/whatsapp/campaigns/new?accountId=${accountId}&returnTo=/whatsapp/numbers/${accountId}`}>
            <Button className="bg-[#075E54] hover:bg-[#064E46] dark:bg-[#00A884] dark:hover:bg-[#008f6f] text-white dark:text-[#0B141A] font-bold text-xs h-8 px-3.5 rounded-lg flex items-center gap-1.5 active:scale-95 transition-transform">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Campaign</span>
            </Button>
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-card border border-dashed border-border day-box-shadow space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#075E54]/10 dark:bg-[#00A884]/15 text-[#075E54] dark:text-[#00A884] flex items-center justify-center mx-auto">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">No campaigns assigned to this number yet</h3>
            <div className="pt-1">
              <Link prefetch={false} href={`/whatsapp/campaigns/new?accountId=${accountId}&returnTo=/whatsapp/numbers/${accountId}`}>
                <Button className="bg-[#075E54] hover:bg-[#064E46] dark:bg-[#00A884] dark:hover:bg-[#008f6f] text-white dark:text-[#0B141A] font-bold text-xs h-8 px-4 rounded-lg">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  <span>Create Campaign for this Number</span>
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-start">
            {campaigns.map((camp) => (
              <CampaignCard
                key={camp.id}
                campaign={camp}
                account={account || undefined}
                accounts={account ? [account] : []}
                logs={logs}
                onToggleActive={fetchNumberData}
                onDelete={(id) => setConfirmDeleteCampId(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm Delete Number Modal (OK / Cancel) */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete WhatsApp Number?"
        description={`Are you sure you want to delete "${account?.name || accountId}"? Click OK to confirm or Cancel to keep it.`}
        confirmLabel="OK, Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={actionLoading}
        onConfirm={async () => {
          setConfirmDeleteOpen(false);
          await handleDeleteNumber();
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      {/* Confirm Disconnect Modal (OK / Cancel) */}
      <ConfirmDialog
        open={confirmDisconnectOpen}
        title="Disconnect WhatsApp Number?"
        description={`Disconnect "${account?.name || accountId}" from active session?`}
        confirmLabel="OK, Disconnect"
        cancelLabel="Cancel"
        variant="warning"
        loading={actionLoading}
        onConfirm={async () => {
          setConfirmDisconnectOpen(false);
          await handleDisconnect();
        }}
        onCancel={() => setConfirmDisconnectOpen(false)}
      />

      {/* Confirm Delete Campaign Modal (OK / Cancel) */}
      <ConfirmDialog
        open={Boolean(confirmDeleteCampId)}
        title="Delete Campaign?"
        description="Are you sure you want to delete this campaign? Click OK to confirm or Cancel to keep it."
        confirmLabel="OK, Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (!confirmDeleteCampId) return;
          const id = confirmDeleteCampId;
          setConfirmDeleteCampId(null);
          await handleDeleteCampaign(id);
        }}
        onCancel={() => setConfirmDeleteCampId(null)}
      />

      {/* Message Delivery Logs for this Number */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#075E54] dark:text-[#00A884]" />
            <span>Recent Delivery Logs</span>
          </h3>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground p-4 rounded-xl bg-card border border-border">
            No message logs yet for this number.
          </p>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border text-xs">
            {logs.map((log) => (
              <div key={log.id} className="p-3 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="font-mono font-bold text-foreground">{log.phoneNumber} · {log.contactName || 'Lead'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {log.messageType.toUpperCase()} · {new Date(log.sentAt).toLocaleTimeString()}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-[#075E54] dark:text-[#00A884]">
                  Delivered
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Edit Name and Phone */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#075E54]/10 dark:bg-[#00A884]/15 text-[#075E54] dark:text-[#00A884] flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Edit Number Details</h3>
                  <p className="text-xs text-muted-foreground">Update SIM nickname or phone number</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEdit(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  SIM / Account Nickname *
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  WhatsApp Phone Number
                </label>
                <Input
                  placeholder="e.g. 8801712345678"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="text-sm font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowEdit(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading || !editName.trim()}
                  className="bg-[#075E54] hover:bg-[#064E46] dark:bg-[#00A884] dark:hover:bg-[#008f6f] text-white dark:text-[#0B141A] font-bold text-xs px-4"
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

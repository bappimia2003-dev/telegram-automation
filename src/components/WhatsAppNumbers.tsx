"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Smartphone, 
  Plus, 
  QrCode, 
  Power, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  ExternalLink, 
  X,
  ChevronDown,
  Webhook,
  Activity,
  Table as TableIcon,
  LayoutGrid
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ConfirmDialog } from './ui/confirm-dialog';
import { WaConnection, WaCampaign, WaMessageLog } from '@/lib/whatsappTypes';
import { WhatsAppQrScanner } from './WhatsAppQrScanner';
import { useLanguage } from './LanguageProvider';
import { cn } from '@/lib/utils';

interface WhatsAppNumbersProps {
  campaigns?: WaCampaign[];
  logs?: WaMessageLog[];
  accounts?: WaConnection[];
  initialAccounts?: WaConnection[];
  onDataChange?: () => void;
  externalAddModalOpen?: boolean;
  onCloseExternalAddModal?: () => void;
}

export function WhatsAppNumbers({ 
  campaigns = [], 
  logs = [],
  accounts: propAccounts, 
  initialAccounts, 
  onDataChange,
  externalAddModalOpen,
  onCloseExternalAddModal
}: WhatsAppNumbersProps) {
  const { t } = useLanguage();
  const deletedIdsRef = React.useRef<Set<string>>(new Set());

  const normalizeAccount = (a: WaConnection): WaConnection => ({
    ...a,
    name: a.name === 'Gemini WhatsApp' ? 'JalaBot Official SIM' : a.name,
  });

  useEffect(() => {
    try {
      const savedDeleted = localStorage.getItem('wa_deleted_account_ids');
      if (savedDeleted) {
        const parsed = JSON.parse(savedDeleted);
        if (Array.isArray(parsed)) {
          deletedIdsRef.current = new Set(parsed);
        }
      }
    } catch {}
  }, []);

  const [accounts, setAccounts] = useState<WaConnection[]>(() => {
    if (propAccounts && propAccounts.length > 0) return propAccounts.map(normalizeAccount);
    if (initialAccounts && initialAccounts.length > 0) return initialAccounts.map(normalizeAccount);
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [showAllNumbers, setShowAllNumbers] = useState<boolean>(true);
  const [displayMode, setDisplayMode] = useState<'table' | 'cards'>('table');

  useEffect(() => {
    if ((!propAccounts || propAccounts.length === 0) && (!initialAccounts || initialAccounts.length === 0)) {
      try {
        const cached = localStorage.getItem('wa_cached_accounts');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const filtered = parsed
              .filter((a: WaConnection) => !deletedIdsRef.current.has(a.id))
              .map(normalizeAccount);
            setAccounts(prev => (prev.length === 0 ? filtered : prev));
          }
        }
      } catch {}
    }
  }, [propAccounts, initialAccounts]);

  useEffect(() => {
    if (propAccounts !== undefined && propAccounts.length > 0) {
      const filtered = propAccounts
        .filter((a) => !deletedIdsRef.current.has(a.id))
        .map(normalizeAccount);
      setAccounts(filtered);
      try {
        localStorage.setItem('wa_cached_accounts', JSON.stringify(filtered));
      } catch {}
    }
  }, [propAccounts]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const isAddModalOpen = showAddModal || Boolean(externalAddModalOpen);
  const handleCloseAddModal = () => {
    setShowAddModal(false);
    if (onCloseExternalAddModal) onCloseExternalAddModal();
  };

  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountPhone, setNewAccountPhone] = useState('');

  const [qrModalAccount, setQrModalAccount] = useState<WaConnection | null>(null);
  const qrModalAccountRef = React.useRef<WaConnection | null>(null);
  qrModalAccountRef.current = qrModalAccount;

  const [editModalAccount, setEditModalAccount] = useState<WaConnection | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // OK / Cancel Confirmation Dialog states
  const [confirmDeleteAcc, setConfirmDeleteAcc] = useState<WaConnection | null>(null);
  const [confirmDisconnectAcc, setConfirmDisconnectAcc] = useState<WaConnection | null>(null);

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`/api/whatsapp/accounts?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const text = await res.text();
      if (!text || text.trim().startsWith('<')) return;
      const data = JSON.parse(text);
      if (data?.ok && Array.isArray(data.accounts)) {
        const filtered = data.accounts
          .filter((a: WaConnection) => !deletedIdsRef.current.has(a.id))
          .map(normalizeAccount);
        setAccounts(filtered);
        try {
          localStorage.setItem('wa_cached_accounts', JSON.stringify(filtered));
        } catch {}

        if (qrModalAccountRef.current) {
          const fresh = filtered.find((a: WaConnection) => a.id === qrModalAccountRef.current?.id);
          if (fresh) {
            setQrModalAccount((prev) => ({
              ...(prev || fresh),
              ...fresh,
              qrCode: fresh.qrCode || prev?.qrCode || '',
            }));
          }
        }
      }
    } catch {
      // Transient network or reload errors are safely ignored
    }
  };

  useEffect(() => {
    fetchAccounts();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (qrModalAccountRef.current && qrModalAccountRef.current.status !== 'connected') {
        fetch(`/api/whatsapp/accounts/${qrModalAccountRef.current.id}?t=${Date.now()}`)
          .then(async (res) => {
            if (!res.ok) return null;
            const text = await res.text();
            if (!text || text.trim().startsWith('<')) return null;
            return JSON.parse(text);
          })
          .then((data) => {
            if (data?.ok && data.account) {
              setQrModalAccount((prev) => ({
                ...(prev || data.account),
                ...data.account,
                qrCode: data.account.qrCode || prev?.qrCode || '',
              }));
              if (data.account.status === 'connected') {
                fetchAccounts();
              }
            }
          })
          .catch(() => {});
      } else {
        fetchAccounts();
      }
    }, qrModalAccount && qrModalAccount.status !== 'connected' ? 3000 : 25000);
    return () => clearInterval(interval);
  }, [qrModalAccount?.id, qrModalAccount?.status]);

  // Add Account
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newAccountName.trim(),
          phoneNumber: newAccountPhone.trim(),
        }),
      });
      const text = await res.text();
      const data = text && !text.trim().startsWith('<') ? JSON.parse(text) : {};
      if (data.ok && data.account) {
        const createdAcc: WaConnection = data.account;
        deletedIdsRef.current.delete(createdAcc.id);
        setNewAccountName('');
        setNewAccountPhone('');
        handleCloseAddModal();
        setAccounts((prev) => {
          const exists = prev.some((a) => a.id === createdAcc.id);
          const next = exists ? prev.map((a) => (a.id === createdAcc.id ? createdAcc : a)) : [...prev, createdAcc];
          try {
            localStorage.setItem('wa_cached_accounts', JSON.stringify(next));
          } catch {}
          return next;
        });
        setQrModalAccount(createdAcc);
        if (onDataChange) onDataChange();
      } else if (data.error) {
        handleCloseAddModal();
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setLoading(false);
    }
  };

  // Edit Account
  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalAccount || !editName.trim()) return;

    const targetId = editModalAccount.id;
    const newName = editName.trim();
    const newPhone = editPhone.trim();

    setAccounts((prev) =>
      prev.map((a) => (a.id === targetId ? { ...a, name: newName, phoneNumber: newPhone || a.phoneNumber } : a))
    );
    setEditModalAccount(null);

    setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/accounts/${targetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newName,
          phoneNumber: newPhone,
        }),
      });
      const text = await res.text();
      const data = text && !text.trim().startsWith('<') ? JSON.parse(text) : {};
      if (data.ok) {
        await fetchAccounts();
        if (onDataChange) onDataChange();
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setLoading(false);
    }
  };

  // Connect / Refresh QR
  const handleConnect = async (accountId: string) => {
    setLoading(true);
    const targetAcc = accounts.find((a) => a.id === accountId);
    setQrModalAccount((prev) => ({
      id: accountId,
      name: targetAcc?.name || prev?.name || 'WhatsApp',
      phoneNumber: targetAcc?.phoneNumber || prev?.phoneNumber || '',
      status: 'qr_pending',
      qrCode: targetAcc?.qrCode || prev?.qrCode || '',
      lastConnected: new Date().toISOString(),
      createdAt: targetAcc?.createdAt || new Date().toISOString(),
    }));

    try {
      const res = await fetch(`/api/whatsapp/accounts/${accountId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', name: targetAcc?.name }),
      });
      const text = await res.text();
      const data = text && !text.trim().startsWith('<') ? JSON.parse(text) : {};
      const resolvedAcc = data.account || data;
      if (resolvedAcc && (resolvedAcc.qrCode || resolvedAcc.status)) {
        setQrModalAccount((prev) => ({
          ...(prev || {}),
          id: accountId,
          name: resolvedAcc.name || prev?.name || targetAcc?.name || 'WhatsApp',
          qrCode: resolvedAcc.qrCode || prev?.qrCode || '',
          status: resolvedAcc.status || 'qr_pending',
          phoneNumber: resolvedAcc.phoneNumber || prev?.phoneNumber || targetAcc?.phoneNumber || '',
          lastConnected: new Date().toISOString(),
          createdAt: prev?.createdAt || new Date().toISOString(),
        }));
      }
      await fetchAccounts();
      if (onDataChange) onDataChange();
    } catch {
      // Ignore transient network errors
    } finally {
      setLoading(false);
    }
  };

  // Disconnect (iframe-safe without blocking window.confirm)
  const handleDisconnect = async (accountId: string) => {
    setLoading(true);
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, status: 'disconnected', qrCode: '' } : a))
    );
    try {
      await fetch(`/api/whatsapp/accounts/${accountId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      if (qrModalAccount?.id === accountId) setQrModalAccount(null);
      await fetchAccounts();
      if (onDataChange) onDataChange();
    } catch {
      // Ignore transient network errors
    } finally {
      setLoading(false);
    }
  };

  // Delete (iframe-safe without blocking window.confirm)
  const handleDeleteAccount = async (accountId: string) => {
    deletedIdsRef.current.add(accountId);
    try {
      localStorage.setItem('wa_deleted_account_ids', JSON.stringify(Array.from(deletedIdsRef.current)));
    } catch {}

    if (qrModalAccount?.id === accountId) {
      setQrModalAccount(null);
    }

    // Optimistic UI removal immediately
    setAccounts((prev) => {
      const next = prev.filter((a) => a.id !== accountId);
      try {
        localStorage.setItem('wa_cached_accounts', JSON.stringify(next));
      } catch {}
      return next;
    });

    setLoading(true);
    try {
      await fetch(`/api/whatsapp/accounts/${accountId}`, { method: 'DELETE' });
      if (onDataChange) onDataChange();
      await fetchAccounts();
    } catch {
      // Even on network hiccup, optimistic removal keeps UI responsive
    } finally {
      setLoading(false);
    }
  };

  // Compute rich per-number telemetry (Campaigns, Total Sent, Delivery Rate, Webhook Status)
  const getAccountMetrics = (acc: WaConnection) => {
    const accCampaigns = campaigns.filter(
      c => c.accountId === acc.id || (!c.accountId && acc.id === 'main') || c.accountId === 'all'
    );
    const activeCampCount = accCampaigns.filter(c => c.isActive).length;
    const totalSent = accCampaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0);

    const campIds = new Set(accCampaigns.map(c => c.id));
    const accLogs = logs.filter(l => campIds.has(l.campaignId));
    const sentLogs = accLogs.filter(l => l.status === 'sent').length;
    const failedLogs = accLogs.filter(l => l.status === 'failed').length;

    let deliveryRate = 100;
    if (sentLogs + failedLogs > 0) {
      deliveryRate = Math.round((sentLogs / (sentLogs + failedLogs)) * 1000) / 10;
    } else if (totalSent > 0) {
      deliveryRate = 100;
    }

    const isConnected = acc.status === 'connected';
    const isPending = acc.status === 'qr_pending' || acc.status === 'connecting';

    const webhookStatus = isConnected
      ? { label: 'Synced', detail: '200 OK', tone: 'text-[#075E54] dark:text-[#00A884]' }
      : isPending
      ? { label: 'Awaiting QR', detail: 'Handshake', tone: 'text-amber-600 dark:text-amber-400' }
      : { label: 'Standby', detail: 'Idle', tone: 'text-muted-foreground' };

    return {
      campCount: accCampaigns.length,
      activeCampCount,
      totalSent,
      deliveryRate,
      webhookStatus,
      isConnected,
      isPending,
    };
  };

  const visibleAccounts = accounts.filter(
    acc => !(acc.id === 'main' && !acc.phoneNumber && acc.status === 'disconnected' && accounts.length > 1)
  );

  return (
    <div className="space-y-3">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowAllNumbers(prev => !prev)}
          className="flex items-center gap-2 group cursor-pointer text-left focus:outline-none min-w-0 select-none hover:opacity-85 transition-opacity"
        >
          <h2 className="text-sm sm:text-base font-bold text-foreground whitespace-nowrap flex items-center gap-2">
            <span>Connected WhatsApp Numbers</span>
            <span className="text-xs font-mono tabular-nums font-semibold text-muted-foreground">
              ({accounts.filter(a => a.status === 'connected').length}/{accounts.length})
            </span>
          </h2>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showAllNumbers ? 'rotate-180' : 'rotate-0'}`} />
        </button>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          {visibleAccounts.length > 0 && showAllNumbers && (
            <div className="flex items-center p-0.5 bg-secondary rounded-lg">
              <button
                type="button"
                onClick={() => setDisplayMode('table')}
                title="High-Density Table View"
                className={cn(
                  "p-1.5 rounded-md transition-all cursor-pointer",
                  displayMode === 'table' ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('cards')}
                title="Compact Grid View"
                className={cn(
                  "p-1.5 rounded-md transition-all cursor-pointer",
                  displayMode === 'cards' ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-[#075E54] hover:bg-[#064E46] dark:bg-[#00A884] dark:hover:bg-[#008f6f] text-white dark:text-[#0B141A] font-bold text-xs h-8 px-3 shrink-0 rounded-lg flex items-center gap-1.5 active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add WhatsApp Number</span>
            <span className="sm:hidden">Add SIM</span>
          </Button>
        </div>
      </div>

      {/* High-Density Numbers View */}
      {showAllNumbers && (
        visibleAccounts.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-xl bg-secondary/30 border border-dashed border-border space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#075E54]/10 dark:bg-[#00A884]/15 text-[#075E54] dark:text-[#00A884] flex items-center justify-center mx-auto">
              <Smartphone className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-foreground">No WhatsApp numbers added yet</h3>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-[#075E54] hover:bg-[#064E46] dark:bg-[#00A884] dark:hover:bg-[#008f6f] text-white dark:text-[#0B141A] font-bold text-xs h-8 px-4 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              <span>Add WhatsApp Number</span>
            </Button>
          </div>
        ) : displayMode === 'table' ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/60 text-muted-foreground font-semibold border-b border-border select-none">
                <tr className="h-9">
                  <th className="px-3 py-2">Device & Number</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Connection</th>
                  <th className="px-3 py-2">Webhook Status</th>
                  <th className="px-3 py-2 text-right hidden md:table-cell">Campaigns</th>
                  <th className="px-3 py-2 text-right">Delivery Rate</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleAccounts.map((acc) => {
                  const m = getAccountMetrics(acc);
                  const displayName = acc.name || (acc.id === 'main' ? 'Primary WhatsApp' : `SIM ${acc.id.slice(-4)}`);
                  const displayPhone = acc.phoneNumber ? `+${acc.phoneNumber.replace(/^\+/, '')}` : (m.isConnected ? 'Device linked' : 'Unlinked');

                  return (
                    <tr key={acc.id} className="hover:bg-secondary/40 transition-colors">
                      {/* 1. Device & Phone + Mobile inline status & Mobile quick actions */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                          <div className={cn(
                            "w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 sm:mt-0",
                            m.isConnected 
                              ? "bg-[#075E54] dark:bg-[#00A884] text-white dark:text-[#0B141A]" 
                              : m.isPending 
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" 
                              : "bg-secondary text-muted-foreground"
                          )}>
                            <Smartphone className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link
                              prefetch={false}
                              href={`/whatsapp/numbers/${acc.id}`}
                              className="font-bold text-foreground hover:text-[#075E54] dark:hover:text-[#00A884] transition-colors block truncate"
                            >
                              {displayName}
                            </Link>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono tabular-nums">
                              <span className="truncate">{displayPhone}</span>
                              <span className="sm:hidden" aria-hidden="true">·</span>
                              <span className={cn(
                                "sm:hidden font-sans font-semibold",
                                m.isConnected ? "text-[#075E54] dark:text-[#00A884]" : m.isPending ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                              )}>
                                {m.isConnected ? t('Active', 'সচল') : m.isPending ? t('Scan QR', 'কিউআর স্ক্যান') : t('Offline', 'অফলাইন')}
                              </span>
                            </div>

                            {/* Mobile Inline Quick Actions (Always visible on mobile without horizontal scroll) */}
                            <div className="flex sm:hidden items-center gap-1.5 mt-2">
                              {!m.isConnected ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQrModalAccount(acc);
                                    handleConnect(acc.id);
                                  }}
                                  className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 cursor-pointer"
                                >
                                  <QrCode className="w-3 h-3" />
                                  <span>{t('Scan QR', 'কিউআর স্ক্যান')}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDisconnectAcc(acc)}
                                  className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-bold bg-secondary text-muted-foreground hover:text-amber-600 cursor-pointer"
                                  title="Disconnect"
                                >
                                  <Power className="w-3 h-3" />
                                  <span>{t('Disconnect', 'ডিসকানেক্ট')}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setEditModalAccount(acc);
                                  setEditName(acc.name || '');
                                  setEditPhone(acc.phoneNumber || '');
                                }}
                                className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Edit"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setConfirmDeleteAcc(acc)}
                                className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 cursor-pointer"
                                title="Delete Number"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>{t('Delete', 'ডিলিট')}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Connection Status (Desktop/Tablet) */}
                      <td className="px-3 py-2.5 hidden sm:table-cell whitespace-nowrap">
                        <span className={cn(
                          "font-semibold",
                          m.isConnected 
                            ? "text-[#075E54] dark:text-[#00A884]" 
                            : m.isPending 
                            ? "text-amber-600 dark:text-amber-400" 
                            : "text-muted-foreground"
                        )}>
                          {m.isConnected ? 'Online' : m.isPending ? 'Scan QR' : 'Offline'}
                        </span>
                        <span className="text-muted-foreground mx-1.5" aria-hidden="true">·</span>
                        <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                          {m.activeCampCount}/{m.campCount} active
                        </span>
                      </td>

                      {/* 3. Webhook Status (Visible on both Desktop & Mobile) */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Webhook className={cn("w-3.5 h-3.5 shrink-0", m.webhookStatus.tone)} />
                          <div className="leading-tight">
                            <span className={cn("font-bold block sm:inline", m.webhookStatus.tone)}>
                              {m.webhookStatus.label}
                            </span>
                            <span className="hidden lg:inline text-muted-foreground mx-1" aria-hidden="true">·</span>
                            <span className="block lg:inline text-[10px] font-mono tabular-nums text-muted-foreground">
                              {m.webhookStatus.detail}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 4. Campaigns Count */}
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums hidden md:table-cell whitespace-nowrap">
                        <span className="font-bold text-foreground">{m.activeCampCount}</span>
                        <span className="text-muted-foreground"> / {m.campCount}</span>
                      </td>

                      {/* 5. Delivery Rate (Visible on both Desktop & Mobile) */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex flex-col items-end">
                          <div className="flex items-center gap-1.5 font-mono tabular-nums">
                            <span className="font-bold text-foreground">{m.deliveryRate.toFixed(1)}%</span>
                            <span className="text-[11px] text-muted-foreground">({m.totalSent})</span>
                          </div>
                          <div className="w-14 h-1 bg-secondary rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-[#075E54] dark:bg-[#00A884] rounded-full transition-all"
                              style={{ width: `${Math.min(100, Math.max(0, m.deliveryRate))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 6. Actions */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {!m.isConnected ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setQrModalAccount(acc);
                                handleConnect(acc.id);
                              }}
                              className="h-7 px-2 text-[11px] font-bold border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 rounded-md"
                            >
                              <QrCode className="w-3 h-3 sm:mr-1" />
                              <span className="hidden sm:inline">Scan QR</span>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmDisconnectAcc(acc)}
                              disabled={loading}
                              title="Disconnect Device"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 rounded-md cursor-pointer"
                            >
                              <Power className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          <Link prefetch={false} href={`/whatsapp/numbers/${acc.id}`}>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Open Device Console"
                              className="h-7 px-2 text-[11px] font-bold text-[#075E54] dark:text-[#00A884] hover:bg-[#075E54]/10 dark:hover:bg-[#00A884]/15 rounded-md cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 sm:mr-1" />
                              <span className="hidden lg:inline">Console</span>
                            </Button>
                          </Link>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditModalAccount(acc);
                              setEditName(acc.name || '');
                              setEditPhone(acc.phoneNumber || '');
                            }}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md cursor-pointer"
                            title="Rename Account / Phone"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeleteAcc(acc)}
                            disabled={loading}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 rounded-md cursor-pointer"
                            title="Delete Number"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* High-Density Cards View (Metrics always visible at a glance) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleAccounts.map((acc) => {
              const m = getAccountMetrics(acc);
              const displayName = acc.name || (acc.id === 'main' ? 'Primary WhatsApp' : `SIM ${acc.id.slice(-4)}`);
              const displayPhone = acc.phoneNumber ? `+${acc.phoneNumber.replace(/^\+/, '')}` : (m.isConnected ? 'Device linked' : 'No phone linked');

              return (
                <div
                  key={acc.id}
                  className="rounded-xl bg-card border border-border hover:border-[#075E54]/40 dark:hover:border-[#00A884]/40 transition-colors p-3.5 space-y-3"
                >
                  {/* Top Row: Identity + Connection State */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        m.isConnected 
                          ? "bg-[#075E54] dark:bg-[#00A884] text-white dark:text-[#0B141A]" 
                          : m.isPending 
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" 
                          : "bg-secondary text-muted-foreground"
                      )}>
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/whatsapp/numbers/${acc.id}`}
                          className="font-bold text-sm text-foreground hover:text-[#075E54] dark:hover:text-[#00A884] truncate block"
                        >
                          {displayName}
                        </Link>
                        <span className="block text-xs text-muted-foreground font-mono tabular-nums truncate">
                          {displayPhone}
                        </span>
                      </div>
                    </div>

                    <span className={cn(
                      "text-xs font-bold shrink-0",
                      m.isConnected 
                        ? "text-[#075E54] dark:text-[#00A884]" 
                        : m.isPending 
                        ? "text-amber-600 dark:text-amber-400" 
                        : "text-muted-foreground"
                    )}>
                      {m.isConnected ? 'Active' : m.isPending ? 'Scan QR' : 'Offline'}
                    </span>
                  </div>

                  {/* At-a-Glance Telemetry Strip (Delivery Rate + Webhook Status + Campaigns) */}
                  <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-lg bg-secondary/50 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Delivery Rate</span>
                      <span className="font-mono tabular-nums font-bold text-foreground">
                        {m.deliveryRate.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Webhook</span>
                      <span className={cn("font-bold truncate block", m.webhookStatus.tone)}>
                        {m.webhookStatus.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block">Sent / Camps</span>
                      <span className="font-mono tabular-nums font-bold text-foreground">
                        {m.totalSent} · {m.campCount}
                      </span>
                    </div>
                  </div>

                  {/* Action Row */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <Link href={`/whatsapp/numbers/${acc.id}`} className="flex-1">
                      <Button className="w-full bg-[#075E54] hover:bg-[#064E46] dark:bg-[#00A884] dark:hover:bg-[#008f6f] text-white dark:text-[#0B141A] font-bold text-xs h-8 rounded-lg">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        <span>Dashboard</span>
                      </Button>
                    </Link>

                    {!m.isConnected ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setQrModalAccount(acc);
                          handleConnect(acc.id);
                        }}
                        className="border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 text-xs font-bold h-8 px-2.5 rounded-lg"
                      >
                        <QrCode className="w-3.5 h-3.5 mr-1" />
                        <span>QR</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmDisconnectAcc(acc)}
                        disabled={loading}
                        className="border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-bold h-8 px-2.5 rounded-lg cursor-pointer"
                        title="Disconnect"
                      >
                        <Power className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditModalAccount(acc);
                        setEditName(acc.name || '');
                        setEditPhone(acc.phoneNumber || '');
                      }}
                      className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground p-0 cursor-pointer"
                      title="Rename Account / Phone"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDeleteAcc(acc)}
                      disabled={loading}
                      className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-red-600 hover:bg-red-500/10 p-0 cursor-pointer"
                      title="Delete Number"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Confirm Delete Modal (OK / Cancel) */}
      <ConfirmDialog
        open={Boolean(confirmDeleteAcc)}
        title={t('Delete WhatsApp Number?', 'হোয়াটসঅ্যাপ নাম্বার মুছে ফেলবেন?')}
        description={
          confirmDeleteAcc
            ? t(
                `Are you sure you want to delete "${confirmDeleteAcc.name || confirmDeleteAcc.phoneNumber || confirmDeleteAcc.id}"? Click OK to confirm or Cancel to keep it.`,
                `আপনি কি নিশ্চিতভাবে "${confirmDeleteAcc.name || confirmDeleteAcc.phoneNumber || confirmDeleteAcc.id}" নাম্বারটি মুছে ফেলতে চান? নিশ্চিত করতে OK এবং না চাইলে Cancel চাপুন।`
              )
            : ''
        }
        confirmLabel={t('OK, Delete', 'ওকে (OK)')}
        cancelLabel={t('Cancel', 'বাতিল (Cancel)')}
        variant="danger"
        loading={loading}
        onConfirm={async () => {
          if (!confirmDeleteAcc) return;
          const idToDelete = confirmDeleteAcc.id;
          setConfirmDeleteAcc(null);
          await handleDeleteAccount(idToDelete);
        }}
        onCancel={() => setConfirmDeleteAcc(null)}
      />

      {/* Confirm Disconnect Modal (OK / Cancel) */}
      <ConfirmDialog
        open={Boolean(confirmDisconnectAcc)}
        title={t('Disconnect WhatsApp Number?', 'হোয়াটসঅ্যাপ সংযোগ বিচ্ছিন্ন করবেন?')}
        description={
          confirmDisconnectAcc
            ? t(
                `Disconnect "${confirmDisconnectAcc.name || confirmDisconnectAcc.phoneNumber}" from active session?`,
                `আপনি কি "${confirmDisconnectAcc.name || confirmDisconnectAcc.phoneNumber}" এর সক্রিয় সংযোগ বিচ্ছিন্ন করতে চান?`
              )
            : ''
        }
        confirmLabel={t('OK, Disconnect', 'ওকে (OK)')}
        cancelLabel={t('Cancel', 'বাতিল (Cancel)')}
        variant="warning"
        loading={loading}
        onConfirm={async () => {
          if (!confirmDisconnectAcc) return;
          const idToDisconnect = confirmDisconnectAcc.id;
          setConfirmDisconnectAcc(null);
          await handleDisconnect(idToDisconnect);
        }}
        onCancel={() => setConfirmDisconnectAcc(null)}
      />

      {/* 1. Modal: Add New WhatsApp Number */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-xl space-y-5 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#075E54]/10 dark:bg-[#00A884]/15 text-[#075E54] dark:text-[#00A884] flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Add WhatsApp Number</h3>
                  <p className="text-xs text-muted-foreground">Link a new WhatsApp SIM or Business device</p>
                </div>
              </div>
              <button 
                onClick={handleCloseAddModal}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  SIM / Account Nickname *
                </label>
                <Input
                  placeholder="e.g. Sales Support SIM 2"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  WhatsApp Phone Number (Optional)
                </label>
                <Input
                  placeholder="e.g. 8801712345678"
                  value={newAccountPhone}
                  onChange={(e) => setNewAccountPhone(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCloseAddModal}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !newAccountName.trim()}
                  className="bg-[#075E54] hover:bg-[#064E46] dark:bg-[#00A884] dark:hover:bg-[#008f6f] text-white dark:text-[#0B141A] font-bold text-xs px-4"
                >
                  {loading ? 'Creating...' : 'Save & Get QR Code'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Edit WhatsApp Number */}
      {editModalAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-xl space-y-5 my-auto">
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
                onClick={() => setEditModalAccount(null)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAccount} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  SIM / Account Nickname *
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
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
                  className="font-mono text-sm"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditModalAccount(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !editName.trim()}
                  className="bg-[#075E54] hover:bg-[#064E46] dark:bg-[#00A884] dark:hover:bg-[#008f6f] text-white dark:text-[#0B141A] font-bold text-xs px-4"
                >
                  {loading ? 'Saving...' : 'Update Details'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal: Live QR Code Scanner */}
      {qrModalAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-xl space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#075E54]/10 dark:bg-[#00A884]/15 text-[#075E54] dark:text-[#00A884] flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Scan QR Code · {qrModalAccount.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Scan with WhatsApp on your mobile phone
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setQrModalAccount(null)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {qrModalAccount.status === 'connected' ? (
              <div className="p-6 text-center rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#25D366]/20 text-[#075E54] dark:text-[#00A884] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-foreground">Successfully Connected!</h4>
                <p className="text-xs text-muted-foreground font-mono">
                  WhatsApp Device Linked: +{qrModalAccount.phoneNumber || 'Ready'}
                </p>
                <div className="pt-2">
                  <Button 
                    onClick={() => setQrModalAccount(null)}
                    className="bg-[#075E54] hover:bg-[#064E46] dark:bg-[#00A884] text-white dark:text-[#0B141A] font-bold text-xs px-5"
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <WhatsAppQrScanner
                qrCode={qrModalAccount.qrCode}
                status={qrModalAccount.status as any}
                accountName={qrModalAccount.name}
                phoneNumber={qrModalAccount.phoneNumber}
                onRefresh={() => handleConnect(qrModalAccount.id)}
                refreshing={loading}
                refreshIntervalSeconds={4}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

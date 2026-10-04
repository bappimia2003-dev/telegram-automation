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
  RefreshCw, 
  ExternalLink, 
  Layers, 
  Send, 
  AlertCircle,
  ShieldCheck,
  X
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { WaConnection, WaCampaign } from '@/lib/whatsappTypes';

interface WhatsAppNumbersProps {
  campaigns?: WaCampaign[];
  accounts?: WaConnection[];
  initialAccounts?: WaConnection[];
  onDataChange?: () => void;
}

export function WhatsAppNumbers({ campaigns = [], accounts: propAccounts, initialAccounts, onDataChange }: WhatsAppNumbersProps) {
  const [accounts, setAccounts] = useState<WaConnection[]>(() => {
    if (propAccounts && propAccounts.length > 0) return propAccounts;
    if (initialAccounts && initialAccounts.length > 0) return initialAccounts;
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (propAccounts && propAccounts.length > 0) {
      setAccounts(propAccounts);
      try {
        localStorage.setItem('wa_cached_accounts', JSON.stringify(propAccounts));
      } catch {}
    }
  }, [propAccounts]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountPhone, setNewAccountPhone] = useState('');

  const [qrModalAccount, setQrModalAccount] = useState<WaConnection | null>(null);
  const qrModalAccountRef = React.useRef<WaConnection | null>(null);
  qrModalAccountRef.current = qrModalAccount;

  const [editModalAccount, setEditModalAccount] = useState<WaConnection | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`/api/whatsapp/accounts?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.ok && Array.isArray(data.accounts)) {
        setAccounts(data.accounts);
        try {
          localStorage.setItem('wa_cached_accounts', JSON.stringify(data.accounts));
        } catch {}

        // If QR modal is open, keep its QR data in sync
        if (qrModalAccountRef.current) {
          const fresh = data.accounts.find((a: WaConnection) => a.id === qrModalAccountRef.current?.id);
          if (fresh) {
            setQrModalAccount(fresh);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  };

  useEffect(() => {
    fetchAccounts();
    // Only poll aggressively (3s) when QR code modal is open and awaiting scanning.
    // Otherwise poll gently (25s) to keep UI fresh without lag or high network traffic.
    const pollInterval = qrModalAccount && qrModalAccount.status !== 'connected' ? 3000 : 25000;
    const interval = setInterval(fetchAccounts, pollInterval);
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
      const data = await res.json();
      if (data.ok && data.account) {
        setNewAccountName('');
        setNewAccountPhone('');
        setShowAddModal(false);
        await fetchAccounts();
        if (onDataChange) onDataChange();
        // Automatically open QR modal for newly added account to scan
        setQrModalAccount(data.account);
      }
    } catch (err) {
      console.error('Failed to create account:', err);
    } finally {
      setLoading(false);
    }
  };

  // Edit Account
  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalAccount || !editName.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/accounts/${editModalAccount.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: editName.trim(),
          phoneNumber: editPhone.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setEditModalAccount(null);
        await fetchAccounts();
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      console.error('Failed to update account:', err);
    } finally {
      setLoading(false);
    }
  };

  // Connect / Refresh QR
  const handleConnect = async (accountId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/accounts/${accountId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' }),
      });
      const data = await res.json();
      if (data && data.qrCode) {
        setQrModalAccount((prev) => ({
          ...(prev || {}),
          id: accountId,
          name: data.name || prev?.name || 'WhatsApp',
          qrCode: data.qrCode,
          status: data.status || 'qr_pending',
          phoneNumber: data.phoneNumber || prev?.phoneNumber || '',
          lastConnected: new Date().toISOString(),
          createdAt: prev?.createdAt || new Date().toISOString(),
        }));
      }
      await fetchAccounts();
      const acc = accounts.find(a => a.id === accountId);
      if (acc && !data?.qrCode) {
        setQrModalAccount({ ...acc, qrCode: acc.qrCode, status: 'qr_pending' });
      }
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Failed to trigger connect:', err);
    } finally {
      setLoading(false);
    }
  };

  // Disconnect
  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Are you sure you want to disconnect this WhatsApp number?')) return;
    setLoading(true);
    try {
      await fetch(`/api/whatsapp/accounts/${accountId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      if (qrModalAccount?.id === accountId) setQrModalAccount(null);
      await fetchAccounts();
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Failed disconnecting:', err);
    } finally {
      setLoading(false);
    }
  };

  // Delete
  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Delete this WhatsApp number account? All associated campaigns will default to "All Numbers".')) return;
    setLoading(true);
    try {
      await fetch(`/api/whatsapp/accounts/${accountId}`, { method: 'DELETE' });
      if (qrModalAccount?.id === accountId) setQrModalAccount(null);
      await fetchAccounts();
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Failed deleting account:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get campaign count for an account
  const getAccountCampaignCount = (accId: string) => {
    return campaigns.filter(c => c.accountId === accId || (!c.accountId && accId === 'main') || c.accountId === 'all').length;
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            Connected WhatsApp Numbers
          </h2>
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-[#164E43] hover:bg-[#124238] text-white font-semibold text-xs h-9 px-4 shrink-0 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add WhatsApp Number
        </Button>
      </div>

      {/* Numbers Grid or Empty State */}
      {accounts.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-[#FBF9F4] dark:bg-[#181A1F] border border-dashed border-[#E6E2D8] dark:border-[#262930] space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Smartphone className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">No WhatsApp numbers added yet</h3>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-[#164E43] hover:bg-[#124238] text-white font-semibold text-xs px-5 shadow-sm mt-2"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add WhatsApp Number
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {accounts.map((acc) => {
          const campCount = getAccountCampaignCount(acc.id);
          const isConnected = acc.status === 'connected';
          const isPending = acc.status === 'qr_pending' || acc.status === 'connecting';

          return (
            <Card 
              key={acc.id} 
              className="border-[#E6E2D8] dark:border-[#262930] bg-[#FBF9F4] dark:bg-[#181A1F] transition-all hover:border-gray-300 dark:hover:border-gray-700 shadow-sm flex flex-col justify-between rounded-xl"
            >
              <CardHeader className="p-3.5 pb-2 border-b border-[#E6E2D8] dark:border-[#262930]">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        isConnected ? 'bg-emerald-500' : isPending ? 'bg-amber-400 animate-pulse' : 'bg-gray-400'
                      }`} />
                      <CardTitle className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                        {acc.name || (acc.id === 'main' ? 'Primary WhatsApp' : `SIM ${acc.id.slice(-4)}`)}
                      </CardTitle>
                    </div>

                    <div className="text-xs sm:text-sm font-bold font-mono text-emerald-800 dark:text-emerald-300 pl-3.5">
                      {acc.phoneNumber ? (
                        <span>+{acc.phoneNumber}</span>
                      ) : (
                        <span className="text-gray-500 italic font-sans text-xs">
                          {isConnected ? 'Device linked' : 'No phone linked'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${
                      isConnected 
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' 
                        : isPending 
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 animate-pulse'
                        : 'bg-[#EDE8DE] dark:bg-[#20242C] text-gray-800 dark:text-gray-200 border-[#E6E2D8] dark:border-[#262930]'
                    }`}
                  >
                    {isConnected ? 'Connected' : isPending ? 'Scan QR' : 'Disconnected'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-3.5 pt-2 pb-3 space-y-2.5">
                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-[#FAF8F5] dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#262930]">
                    <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                      Campaigns
                    </p>
                    <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white mt-0.5">{campCount}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#FAF8F5] dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#262930]">
                    <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <Send className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      Status
                    </p>
                    <p className={`text-xs font-bold mt-0.5 ${isConnected ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {isConnected ? 'Online & Active' : 'Offline'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-1.5">
                  {/* Primary: Open Dashboard */}
                  <Link href={`/whatsapp/numbers/${acc.id}`} className="block w-full">
                    <Button 
                      className="w-full bg-[#164E43] hover:bg-[#124238] text-white font-semibold text-xs h-8 shadow-xs flex items-center justify-center gap-1.5 rounded-lg"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Dashboard (ম্যানেজ করুন)
                    </Button>
                  </Link>

                  <div className="flex items-center gap-1.5">
                    {/* Scan QR Button */}
                    {!isConnected && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setQrModalAccount(acc);
                          handleConnect(acc.id);
                        }}
                        className="flex-1 border-amber-300 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs font-semibold h-8 bg-[#FAF8F5] dark:bg-[#181A1F] rounded-lg"
                      >
                        <QrCode className="w-3.5 h-3.5 mr-1 text-amber-600" />
                        Scan QR Code
                      </Button>
                    )}

                    {isConnected && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDisconnect(acc.id)}
                        disabled={loading}
                        className="flex-1 border-red-300 dark:border-red-900/50 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-semibold h-8 bg-[#FAF8F5] dark:bg-[#181A1F] rounded-lg"
                      >
                        <Power className="w-3.5 h-3.5 mr-1" />
                        Disconnect
                      </Button>
                    )}

                    {/* Edit Details */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditModalAccount(acc);
                        setEditName(acc.name || '');
                        setEditPhone(acc.phoneNumber || '');
                      }}
                      className="text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 h-8 w-8 p-0 rounded-lg"
                      title="Rename Account / Phone"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>

                    {/* Delete */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteAccount(acc.id)}
                      disabled={loading}
                      className="text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 h-8 w-8 p-0 rounded-lg"
                      title="Delete Number"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}

      {/* 1. Modal: Add New WhatsApp Number */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E2D8] dark:border-[#262930]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Add WhatsApp Number</h3>
                  <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF]">নতুন হোয়াটসঅ্যাপ সিম/নাম্বার যুক্ত করুন</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-[#4B5563] dark:text-[#9CA3AF] hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-900 dark:text-white">
                  SIM / Account Nickname *
                </label>
                <Input
                  placeholder="e.g. SIM 2 - Gemini Ads or Sales Number"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  required
                  autoFocus
                />
                <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF]">
                  চেনার সুবিধার্থে নাম দিন (যেমন: SIM 2 বা সেলস নাম্বার)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-900 dark:text-white">
                  WhatsApp Phone Number (Optional)
                </label>
                <Input
                  placeholder="e.g. 8801712345678"
                  value={newAccountPhone}
                  onChange={(e) => setNewAccountPhone(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF]">
                  নাম্বার জানা থাকলে লিখে দিন, অথবা কিউআর স্ক্যান করলে অটো যুক্ত হবে।
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#E6E2D8] dark:border-[#262930]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAddModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !newAccountName.trim()}
                  className="bg-[#164E43] hover:bg-[#124238] text-white font-semibold text-xs px-4 shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E2D8] dark:border-[#262930]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Edit Number Details</h3>
                  <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF]">নাম বা নাম্বার পরিবর্তন করুন</p>
                </div>
              </div>
              <button 
                onClick={() => setEditModalAccount(null)}
                className="text-[#4B5563] dark:text-[#9CA3AF] hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAccount} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-900 dark:text-white">
                  SIM / Account Nickname *
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-900 dark:text-white">
                  WhatsApp Phone Number
                </label>
                <Input
                  placeholder="e.g. 8801712345678"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#E6E2D8] dark:border-[#262930]">
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
                  className="bg-[#164E43] hover:bg-[#124238] text-white font-semibold text-xs px-4 shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E2D8] dark:border-[#262930]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Scan QR Code for {qrModalAccount.name}
                  </h3>
                  <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF]">
                    আপনার ফোনের WhatsApp অ্যাপ দিয়ে স্ক্যান করুন
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setQrModalAccount(null)}
                className="text-[#4B5563] dark:text-[#9CA3AF] hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {qrModalAccount.status === 'connected' ? (
              <div className="p-6 text-center rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-emerald-800 dark:text-emerald-300">Successfully Connected!</h4>
                <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF]">
                  WhatsApp Device Linked: +{qrModalAccount.phoneNumber || 'Ready'}
                </p>
                <div className="pt-2">
                  <Button 
                    onClick={() => setQrModalAccount(null)}
                    className="bg-[#164E43] hover:bg-[#124238] text-white font-semibold text-xs px-5 shadow-sm"
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* QR Display */}
                <div className="p-3 bg-white rounded-xl shadow-lg shrink-0 flex items-center justify-center">
                  {qrModalAccount.qrCode ? (
                    <img
                      src={qrModalAccount.qrCode}
                      alt="WhatsApp QR Code"
                      className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 sm:w-52 sm:h-52 flex flex-col items-center justify-center text-gray-600 dark:text-gray-400 text-xs gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-700 dark:text-emerald-400" />
                      <span>Generating QR code...</span>
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div className="space-y-3 text-xs">
                  <p className="font-bold text-gray-900 dark:text-white">স্ক্যান করার নিয়ম:</p>
                  <ol className="space-y-2 text-[#4B5563] dark:text-[#9CA3AF] list-decimal pl-4">
                    <li>আপনার ফোনের <strong className="text-gray-900 dark:text-white">WhatsApp</strong> খুলুন</li>
                    <li><strong className="text-gray-900 dark:text-white">Settings</strong> বা ৩-ডট মেনুতে যান</li>
                    <li><strong className="text-gray-900 dark:text-white">Linked Devices</strong> সিলেক্ট করুন</li>
                    <li><strong className="text-gray-900 dark:text-white">Link a Device</strong> এ চাপ দিয়ে এই QR স্ক্যান করুন</li>
                  </ol>

                  <div className="pt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConnect(qrModalAccount.id)}
                      disabled={loading}
                      className="text-xs border-[#E6E2D8] dark:border-[#262930] hover:border-green-300"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />
                      Refresh QR
                    </Button>
                    <span className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF]">Auto-updates</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

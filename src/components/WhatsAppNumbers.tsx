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
import { ChevronDown } from 'lucide-react';
import { WaConnection, WaCampaign } from '@/lib/whatsappTypes';

interface WhatsAppNumbersProps {
  campaigns?: WaCampaign[];
  accounts?: WaConnection[];
  initialAccounts?: WaConnection[];
  onDataChange?: () => void;
  externalAddModalOpen?: boolean;
  onCloseExternalAddModal?: () => void;
}

export function WhatsAppNumbers({ 
  campaigns = [], 
  accounts: propAccounts, 
  initialAccounts, 
  onDataChange,
  externalAddModalOpen,
  onCloseExternalAddModal
}: WhatsAppNumbersProps) {
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
  // Accordion state: closed by default, toggleable on click
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
  const [showAllNumbers, setShowAllNumbers] = useState<boolean>(false);

  const toggleCard = (id: string) => {
    setOpenCards(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

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
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (qrModalAccountRef.current && qrModalAccountRef.current.status !== 'connected') {
        fetch(`/api/whatsapp/accounts/${qrModalAccountRef.current.id}?t=${Date.now()}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.ok && data.account) {
              setQrModalAccount((prev) => ({ ...(prev || {}), ...data.account }));
              if (data.account.status === 'connected') {
                fetchAccounts();
              }
            }
          })
          .catch(() => {});
      } else {
        fetchAccounts();
      }
    }, qrModalAccount && qrModalAccount.status !== 'connected' ? 2000 : 25000);
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

    const targetId = editModalAccount.id;
    const newName = editName.trim();
    const newPhone = editPhone.trim();

    // Optimistically update local state immediately so user sees the change right away
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
      const data = await res.json();
      if (data.ok) {
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
    const targetAcc = accounts.find((a) => a.id === accountId);
    setQrModalAccount({
      id: accountId,
      name: targetAcc?.name || 'WhatsApp',
      phoneNumber: targetAcc?.phoneNumber || '',
      status: 'qr_pending',
      qrCode: targetAcc?.qrCode || '',
      lastConnected: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    try {
      const res = await fetch(`/api/whatsapp/accounts/${accountId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' }),
      });
      const data = await res.json();
      if (data && (data.qrCode || data.status)) {
        setQrModalAccount((prev) => ({
          ...(prev || {}),
          id: accountId,
          name: data.name || prev?.name || targetAcc?.name || 'WhatsApp',
          qrCode: data.qrCode || prev?.qrCode || '',
          status: data.status || 'qr_pending',
          phoneNumber: data.phoneNumber || prev?.phoneNumber || targetAcc?.phoneNumber || '',
          lastConnected: new Date().toISOString(),
          createdAt: prev?.createdAt || new Date().toISOString(),
        }));
      }
      await fetchAccounts();
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
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
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
      {/* Header Bar (Accordion Trigger: All numbers show ONLY on click) */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowAllNumbers(prev => !prev)}
          className="flex items-center gap-2 group cursor-pointer text-left focus:outline-none min-w-0"
        >
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white font-['Sora',sans-serif] whitespace-nowrap flex items-center gap-2">
            <span>Connected WhatsApp Numbers</span>
            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#E3F1EA] dark:bg-[#1E2D27] text-[#164F43] dark:text-[#5FD1A5]">
              {accounts.filter(a => a.status === 'connected').length}
            </span>
          </h2>
          <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 shrink-0 ${
            showAllNumbers ? 'rotate-180' : 'rotate-0'
          }`} />
        </button>

        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-[#164E43] hover:bg-[#124238] text-white font-bold text-xs h-9 px-4 shrink-0 shadow-sm rounded-xl hidden sm:flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add WhatsApp Number
        </Button>
      </div>

      {/* Numbers Grid or Empty State (Shown ONLY when clicked) */}
      {showAllNumbers && (
        accounts.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-[20px] bg-[#FBF9F4] dark:bg-[#181A1F] border border-dashed border-[#E4DFD2] dark:border-[#262930] space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">No WhatsApp numbers added yet</h3>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-[#164E43] hover:bg-[#124238] text-white font-semibold text-xs px-5 shadow-sm mt-2 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add WhatsApp Number
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 pt-1">
          {accounts.filter(acc => !(acc.id === 'main' && !acc.phoneNumber && acc.status === 'disconnected' && accounts.length > 1)).map((acc) => {
            const campCount = getAccountCampaignCount(acc.id);
            const isConnected = acc.status === 'connected';
            const isPending = acc.status === 'qr_pending' || acc.status === 'connecting';
            const isOpen = Boolean(openCards[acc.id]); // Closed by default! Opens only when clicked

            return (
              <div 
                key={acc.id} 
                className="rounded-[20px] overflow-hidden bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E4DFD2] dark:border-[#262930] shadow-xs hover:border-[#164E43]/40 transition-all duration-200 flex flex-col justify-between"
              >
                {/* Accordion / Header Banner in Artboard Emerald Style */}
                <button
                  type="button"
                  onClick={() => toggleCard(acc.id)}
                  className="w-full border-0 p-0 text-left bg-[#164E43] dark:bg-[#13443A] text-white px-4 py-3 min-h-[62px] flex items-center gap-3 active:brightness-95 transition-all select-none cursor-pointer"
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    isConnected ? 'bg-[#4ADE9E] shadow-[0_0_8px_#4ADE9E]' : isPending ? 'bg-amber-300 animate-pulse' : 'bg-gray-400'
                  }`} />

                  <div className="flex-1 min-w-0 pr-2">
                    <span className="block font-bold text-[15px] font-['Sora',sans-serif] text-white truncate">
                      {acc.name || (acc.id === 'main' ? 'Primary WhatsApp' : `SIM ${acc.id.slice(-4)}`)}
                    </span>
                    <span className="block text-[12.5px] font-medium text-white/90 mt-0.5 font-mono truncate">
                      {acc.phoneNumber ? `+${acc.phoneNumber}` : (isConnected ? 'Device linked' : 'No phone linked')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge 
                      variant="outline" 
                      className={`text-[9.5px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border-0 ${
                        isConnected 
                          ? 'bg-white/15 text-white' 
                          : isPending 
                          ? 'bg-amber-400/20 text-amber-200 animate-pulse' 
                          : 'bg-white/10 text-gray-300'
                      }`}
                    >
                      {isConnected ? 'Active' : isPending ? 'Scan QR' : 'Offline'}
                    </Badge>

                    <ChevronDown className={`w-5 h-5 text-white/90 transition-transform duration-300 ${
                      isOpen ? 'rotate-180' : 'rotate-0'
                    }`} />
                  </div>
                </button>

                {/* Card Body - Expandable Accordion with smooth transition */}
                <div className={`transition-all duration-300 overflow-hidden ${
                  isOpen ? 'max-h-[350px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
                }`}>
                  <div className="p-3.5 sm:p-4 space-y-3">
                    {/* Stats Row */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-[14px] bg-[#FAF8F5] dark:bg-[#121418] border border-[#E4DFD2] dark:border-[#262930]">
                        <p className="text-[11px] font-bold text-[#6B706A] dark:text-[#8A9B94] flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                          Campaigns
                        </p>
                        <p className="text-base font-bold font-['Sora',sans-serif] text-gray-900 dark:text-white mt-1">
                          {campCount}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-[14px] bg-[#FAF8F5] dark:bg-[#121418] border border-[#E4DFD2] dark:border-[#262930]">
                        <p className="text-[11px] font-bold text-[#6B706A] dark:text-[#8A9B94] flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          Status
                        </p>
                        <p className={`text-xs font-bold mt-1.5 ${isConnected ? 'text-[#164E43] dark:text-[#5FD1A5]' : 'text-amber-600'}`}>
                          {isConnected ? 'Online & Active' : 'Offline'}
                        </p>
                      </div>
                    </div>

                    {/* Primary: Open Dashboard */}
                    <Link href={`/whatsapp/numbers/${acc.id}`} className="block w-full">
                      <Button 
                        className="w-full bg-[#164E43] hover:bg-[#124238] text-white font-bold text-[13.5px] h-11 shadow-xs flex items-center justify-center gap-2 rounded-[14px] active:scale-[0.98] transition-transform"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open Dashboard (ম্যানেজ করুন)
                      </Button>
                    </Link>

                    {/* Actions Row */}
                    <div className="flex items-center gap-2 pt-0.5">
                      {/* Disconnect / Scan QR */}
                      {!isConnected ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setQrModalAccount(acc);
                            handleConnect(acc.id);
                          }}
                          className="flex-1 border-[1.5px] border-amber-400/80 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs font-bold h-[42px] rounded-[14px] active:scale-[0.98]"
                        >
                          <QrCode className="w-3.5 h-3.5 mr-1 text-amber-600" />
                          Scan QR Code
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDisconnect(acc.id)}
                          disabled={loading}
                          className="flex-1 border-[1.5px] border-[#E7A3A3] dark:border-red-900/50 text-[#C93B3B] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-bold h-[42px] rounded-[14px] active:scale-[0.98]"
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
                        className="h-[42px] w-[42px] rounded-[14px] border border-[#E4DFD2] dark:border-[#262930] text-[#6B706A] dark:text-[#8A9B94] hover:text-gray-900 dark:hover:text-white p-0 active:scale-95"
                        title="Rename Account / Phone"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>

                      {/* Delete */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteAccount(acc.id)}
                        disabled={loading}
                        className="h-[42px] w-[42px] rounded-[14px] border border-[#E4DFD2] dark:border-[#262930] text-[#6B706A] dark:text-[#8A9B94] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 p-0 active:scale-95"
                        title="Delete Number"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )
      )}

      {/* 1. Modal: Add New WhatsApp Number */}
      {isAddModalOpen && (
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

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
  onDataChange?: () => void;
}

export function WhatsAppNumbers({ campaigns = [], onDataChange }: WhatsAppNumbersProps) {
  const [accounts, setAccounts] = useState<WaConnection[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountPhone, setNewAccountPhone] = useState('');

  const [qrModalAccount, setQrModalAccount] = useState<WaConnection | null>(null);
  const [editModalAccount, setEditModalAccount] = useState<WaConnection | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`/api/whatsapp/accounts?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.ok && Array.isArray(data.accounts)) {
        setAccounts(data.accounts);

        // If QR modal is open, keep its QR data in sync
        if (qrModalAccount) {
          const fresh = data.accounts.find((a: WaConnection) => a.id === qrModalAccount.id);
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
    const interval = setInterval(fetchAccounts, 3500);
    return () => clearInterval(interval);
  }, [qrModalAccount?.id]);

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
      await fetchAccounts();
      const acc = accounts.find(a => a.id === accountId);
      if (acc) {
        setQrModalAccount({ ...acc, qrCode: data.qrCode || acc.qrCode, status: 'qr_pending' });
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
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            Connected WhatsApp Numbers (SIMs)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Link multiple WhatsApp numbers. Click &quot;Open Dashboard&quot; on any number to manage its dedicated campaigns.
          </p>
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs h-9 px-4 shrink-0 shadow-md shadow-emerald-900/30"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add WhatsApp Number
        </Button>
      </div>

      {/* Numbers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {accounts.map((acc) => {
          const campCount = getAccountCampaignCount(acc.id);
          const isConnected = acc.status === 'connected';
          const isPending = acc.status === 'qr_pending' || acc.status === 'connecting';

          return (
            <Card 
              key={acc.id} 
              className={`border-border/60 bg-card/60 backdrop-blur-md transition-all hover:border-emerald-500/50 shadow-md flex flex-col justify-between ${
                isConnected ? 'border-emerald-500/30' : ''
              }`}
            >
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        isConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : isPending ? 'bg-amber-400 animate-ping' : 'bg-zinc-500'
                      }`} />
                      <CardTitle className="text-base font-semibold text-white">
                        {acc.name || (acc.id === 'main' ? 'Primary WhatsApp' : `SIM ${acc.id.slice(-4)}`)}
                      </CardTitle>
                    </div>

                    <div className="text-xs font-mono text-emerald-400 pl-4">
                      {acc.phoneNumber ? (
                        <span>+{acc.phoneNumber}</span>
                      ) : (
                        <span className="text-muted-foreground italic font-sans text-[11px]">
                          {isConnected ? 'Device linked' : 'No phone linked yet'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] uppercase font-semibold tracking-wider ${
                      isConnected 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                        : isPending 
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 animate-pulse'
                        : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
                    }`}
                  >
                    {isConnected ? 'Connected' : isPending ? 'Scan QR' : 'Disconnected'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-3 pb-4 space-y-4">
                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-secondary/30 border border-border/40">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Layers className="w-3 h-3 text-emerald-400" />
                      Campaigns
                    </p>
                    <p className="text-sm font-semibold text-white mt-0.5">{campCount}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/30 border border-border/40">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Send className="w-3 h-3 text-blue-400" />
                      Status
                    </p>
                    <p className={`text-xs font-semibold mt-1 ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isConnected ? 'Online & Active' : 'Offline'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  {/* Primary: Open Dashboard */}
                  <Link href={`/whatsapp/numbers/${acc.id}`} className="block w-full">
                    <Button 
                      className="w-full bg-emerald-600/90 hover:bg-emerald-600 text-white font-medium text-xs h-9 shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Dashboard (ম্যানেজ করুন)
                    </Button>
                  </Link>

                  <div className="flex items-center gap-2">
                    {/* Scan QR Button */}
                    {!isConnected && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setQrModalAccount(acc);
                          handleConnect(acc.id);
                        }}
                        className="flex-1 border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-xs h-8"
                      >
                        <QrCode className="w-3.5 h-3.5 mr-1 text-amber-400" />
                        Scan QR Code
                      </Button>
                    )}

                    {isConnected && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDisconnect(acc.id)}
                        disabled={loading}
                        className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-8"
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
                      className="text-muted-foreground hover:text-white text-xs h-8 px-2.5"
                      title="Edit number details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>

                    {/* Delete */}
                    {acc.id !== 'main' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteAccount(acc.id)}
                        disabled={loading}
                        className="text-muted-foreground hover:text-destructive text-xs h-8 px-2.5"
                        title="Delete number"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 1. Modal: Add New WhatsApp Number */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Add WhatsApp Number</h3>
                  <p className="text-xs text-muted-foreground">নতুন হোয়াটসঅ্যাপ সিম/নাম্বার যুক্ত করুন</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">
                  SIM / Account Nickname *
                </label>
                <Input
                  placeholder="e.g. SIM 2 - Gemini Ads or Sales Number"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  required
                  autoFocus
                  className="bg-background/60 border-border/60 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  চেনার সুবিধার্থে নাম দিন (যেমন: SIM 2 বা সেলস নাম্বার)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">
                  WhatsApp Phone Number (Optional)
                </label>
                <Input
                  placeholder="e.g. 8801712345678"
                  value={newAccountPhone}
                  onChange={(e) => setNewAccountPhone(e.target.value)}
                  className="bg-background/60 border-border/60 text-sm font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  নাম্বার জানা থাকলে লিখে দিন, অথবা কিউআর স্ক্যান করলে অটো যুক্ত হবে।
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-border/40">
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
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Edit Number Details</h3>
                  <p className="text-xs text-muted-foreground">নাম বা নাম্বার পরিবর্তন করুন</p>
                </div>
              </div>
              <button 
                onClick={() => setEditModalAccount(null)}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAccount} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">
                  SIM / Account Nickname *
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="bg-background/60 border-border/60 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">
                  WhatsApp Phone Number
                </label>
                <Input
                  placeholder="e.g. 8801712345678"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="bg-background/60 border-border/60 text-sm font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-border/40">
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
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Scan QR Code for {qrModalAccount.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    আপনার ফোনের WhatsApp অ্যাপ দিয়ে স্ক্যান করুন
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setQrModalAccount(null)}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {qrModalAccount.status === 'connected' ? (
              <div className="p-6 text-center rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-semibold text-emerald-300">Successfully Connected!</h4>
                <p className="text-xs text-muted-foreground">
                  WhatsApp Device Linked: +{qrModalAccount.phoneNumber || 'Ready'}
                </p>
                <div className="pt-2">
                  <Button 
                    onClick={() => setQrModalAccount(null)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-5"
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
                    <div className="w-48 h-48 sm:w-52 sm:h-52 flex flex-col items-center justify-center text-zinc-600 text-xs gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                      <span>Generating QR code...</span>
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div className="space-y-3 text-xs">
                  <p className="font-semibold text-white">স্ক্যান করার নিয়ম:</p>
                  <ol className="space-y-2 text-muted-foreground list-decimal pl-4">
                    <li>আপনার ফোনের <strong className="text-white">WhatsApp</strong> খুলুন</li>
                    <li><strong className="text-white">Settings</strong> বা ৩-ডট মেনুতে যান</li>
                    <li><strong className="text-white">Linked Devices</strong> সিলেক্ট করুন</li>
                    <li><strong className="text-white">Link a Device</strong> এ চাপ দিয়ে এই QR স্ক্যান করুন</li>
                  </ol>

                  <div className="pt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConnect(qrModalAccount.id)}
                      disabled={loading}
                      className="text-xs border-border/60 hover:border-emerald-500/50"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />
                      Refresh QR
                    </Button>
                    <span className="text-[11px] text-muted-foreground">Auto-updates</span>
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

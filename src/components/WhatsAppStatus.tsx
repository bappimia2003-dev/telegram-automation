"use client";

import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Smartphone, 
  RefreshCw, 
  CheckCircle2, 
  Power, 
  Wifi, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Layers
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { WaConnection } from '@/lib/whatsappTypes';

interface WhatsAppStatusProps {
  onStatusChange?: () => void;
}

export function WhatsAppStatus({ onStatusChange }: WhatsAppStatusProps) {
  const [accounts, setAccounts] = useState<WaConnection[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('main');
  const [loading, setLoading] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`/api/whatsapp/accounts?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.ok && Array.isArray(data.accounts)) {
        setAccounts(data.accounts);
        // If selected account doesn't exist, fallback to first
        if (!data.accounts.some((a: WaConnection) => a.id === selectedAccountId)) {
          setSelectedAccountId(data.accounts[0]?.id || 'main');
        }
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  };

  useEffect(() => {
    fetchAccounts();
    const interval = setInterval(fetchAccounts, 4000);
    return () => clearInterval(interval);
  }, [selectedAccountId]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0] || {
    id: 'main',
    name: 'Primary WhatsApp',
    status: 'disconnected',
    phoneNumber: '',
    qrCode: '',
    lastConnected: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAccountName.trim() }),
      });
      const data = await res.json();
      if (data.ok && data.account) {
        setSelectedAccountId(data.account.id);
        setNewAccountName('');
        setAddingNew(false);
        await fetchAccounts();
        if (onStatusChange) onStatusChange();
      }
    } catch (err) {
      console.error('Failed adding account:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (accountId: string) => {
    setLoading(true);
    try {
      await fetch(`/api/whatsapp/accounts/${accountId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' }),
      });
      await fetchAccounts();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      console.error('Failed connecting:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Are you sure you want to disconnect this WhatsApp number?')) return;
    setLoading(true);
    try {
      await fetch(`/api/whatsapp/accounts/${accountId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      await fetchAccounts();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      console.error('Failed disconnecting:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this WhatsApp number? All linked campaigns will default to any number.')) return;
    setLoading(true);
    try {
      await fetch(`/api/whatsapp/accounts/${accountId}`, { method: 'DELETE' });
      setSelectedAccountId('main');
      await fetchAccounts();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      console.error('Failed deleting account:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-md overflow-hidden relative shadow-lg">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-white">
              <Smartphone className="h-5 w-5 text-emerald-400" />
              Connected WhatsApp Numbers
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Link multiple WhatsApp SIM cards and assign specific numbers to different ad campaigns.
            </CardDescription>
          </div>

          <Button
            size="sm"
            onClick={() => setAddingNew(!addingNew)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 shrink-0 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Another Number
          </Button>
        </div>

        {/* Add New Number Form Modal/Bar */}
        {addingNew && (
          <form onSubmit={handleAddAccount} className="pt-3 flex items-center gap-2">
            <Input
              placeholder="e.g. SIM 2 - CapCut Ads or Course Number"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              className="bg-background/80 border-emerald-500/40 text-xs h-8"
              autoFocus
            />
            <Button type="submit" size="sm" disabled={loading || !newAccountName.trim()} className="bg-emerald-600 text-white text-xs h-8 shrink-0">
              Create & Get QR
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAddingNew(false)} className="text-xs h-8 text-muted-foreground">
              Cancel
            </Button>
          </form>
        )}

        {/* Account Selector Tabs */}
        {accounts.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-3">
            {accounts.map((acc) => {
              const isSelected = acc.id === selectedAccount.id;
              return (
                <button
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isSelected
                      ? 'bg-emerald-600/20 border-emerald-500/50 text-white shadow-sm'
                      : 'bg-secondary/40 border-border/40 text-muted-foreground hover:bg-secondary/70'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      acc.status === 'connected'
                        ? 'bg-emerald-400'
                        : acc.status === 'qr_pending'
                        ? 'bg-amber-400 animate-ping'
                        : 'bg-muted-foreground'
                    }`}
                  />
                  <span>{acc.name || (acc.id === 'main' ? 'Primary WhatsApp' : `SIM ${acc.id.slice(-4)}`)}</span>
                  {acc.phoneNumber && (
                    <span className="font-mono text-[10px] text-emerald-300">+{acc.phoneNumber}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-4">
        {selectedAccount.status === 'connected' ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/30">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>{selectedAccount.name || 'WhatsApp Number'}:</span>
                  <span className="font-mono text-emerald-300">+{selectedAccount.phoneNumber || 'Linked Device'}</span>
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Auto-responder active & ready for incoming ad quick replies
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDisconnect(selectedAccount.id)}
                disabled={loading}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-8"
              >
                <Power className="h-3.5 w-3.5 mr-1" />
                Disconnect
              </Button>

              {selectedAccount.id !== 'main' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteAccount(selectedAccount.id)}
                  disabled={loading}
                  className="text-muted-foreground hover:text-destructive text-xs h-8 px-2"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ) : selectedAccount.status === 'qr_pending' && selectedAccount.qrCode ? (
          <div className="flex flex-col md:flex-row items-center gap-6 p-4 rounded-xl bg-secondary/30 border border-border/60">
            <div className="bg-white p-3 rounded-xl shadow-2xl border-4 border-emerald-500/40 shrink-0">
              <img src={selectedAccount.qrCode} alt="WhatsApp QR Code" className="w-48 h-48 sm:w-56 sm:h-56" />
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-emerald-400" />
                  {selectedAccount.name || 'এই নম্বরটির'} WhatsApp দিয়ে স্ক্যান করুন
                </h4>
                <p className="text-xs text-emerald-400/90 mt-0.5">
                  এই নম্বরের সাথে যুক্ত ক্যাম্পেইনগুলোর মেসেজ আসলেই অটো ফাইল সেন্ড হবে।
                </p>
              </div>

              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>আপনার ফোনের WhatsApp খুলুন</li>
                <li><strong className="text-foreground">Settings</strong> বা 3-dots মেনুতে যান</li>
                <li><strong className="text-foreground">Linked Devices</strong> সিলেক্ট করুন</li>
                <li><strong className="text-foreground">Link a Device</strong> এ চাপ দিয়ে এই QR কোডটি স্ক্যান করুন</li>
              </ol>

              <div className="pt-2 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleConnect(selectedAccount.id)} disabled={loading} className="text-xs h-8">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Refresh QR
                </Button>
                {selectedAccount.id !== 'main' && (
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteAccount(selectedAccount.id)} className="text-xs text-destructive h-8">
                    Delete Number Slot
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-secondary/20 border border-border/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                <Wifi className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{selectedAccount.name || 'WhatsApp'} Offline</p>
                <p className="text-xs text-muted-foreground">
                  Click connect to generate a QR code and link this WhatsApp number.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => handleConnect(selectedAccount.id)}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4 h-8"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <QrCode className="h-3.5 w-3.5 mr-1.5" />
                    Connect & Get QR
                  </>
                )}
              </Button>

              {selectedAccount.id !== 'main' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteAccount(selectedAccount.id)}
                  disabled={loading}
                  className="text-muted-foreground hover:text-destructive text-xs h-8 px-2"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

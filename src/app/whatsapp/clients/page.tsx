'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  Plus,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Smartphone,
  Layers,
  Clock,
  Activity,
  Edit3,
  Trash2,
  Power,
  ChevronDown,
  ChevronUp,
  Send,
  ShieldCheck,
  AlertTriangle,
  Eye,
  EyeOff,
  CalendarClock,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function AdminClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newMaxNumbers, setNewMaxNumbers] = useState(1);
  const [newMaxCampaigns, setNewMaxCampaigns] = useState(3);
  const [newDurationDays, setNewDurationDays] = useState(30);
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Per-client UI state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedPwdId, setSavedPwdId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [expandedClient, setExpandedClient] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<Record<string, 'campaigns' | 'numbers' | 'activity'>>({});
  const [customDaysInput, setCustomDaysInput] = useState<Record<string, number>>({});
  const [quotaDrafts, setQuotaDrafts] = useState<Record<string, { maxNumbers: number; maxCampaigns: number }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchClients = async () => {
    try {
      const res = await fetch(`/api/whatsapp/clients?t=${Date.now()}`, { cache: 'no-store' });
      if (res.status === 403) {
        router.replace('/whatsapp');
        return;
      }
      const data = await res.json();
      if (data.ok && Array.isArray(data.clients)) {
        setClients(data.clients);
        const drafts: Record<string, { maxNumbers: number; maxCampaigns: number }> = {};
        const daysMap: Record<string, number> = {};
        const pwdMap: Record<string, string> = {};
        const visMap: Record<string, boolean> = {};
        for (const c of data.clients) {
          drafts[c.id] = {
            maxNumbers: c.maxWhatsappNumbers || 1,
            maxCampaigns: c.maxCampaigns || 3,
          };
          daysMap[c.id] = c.durationDays || 30;
          pwdMap[c.id] = c.password || '';
          visMap[c.id] = true;
        }
        setQuotaDrafts((prev) => ({ ...drafts, ...prev }));
        setCustomDaysInput((prev) => ({ ...daysMap, ...prev }));
        setPasswordDrafts((prev) => ({ ...pwdMap, ...prev }));
        setVisiblePasswords((prev) => ({ ...visMap, ...prev }));
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
    const timer = setInterval(fetchClients, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyPassword = (clientId: string, pwd: string) => {
    navigator.clipboard.writeText(pwd);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/whatsapp/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          password: newPassword.trim() || undefined,
          maxWhatsappNumbers: Number(newMaxNumbers),
          maxCampaigns: Number(newMaxCampaigns),
          durationDays: Number(newDurationDays),
          notes: newNotes.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewName('');
        setNewPassword('');
        setNewMaxNumbers(1);
        setNewMaxCampaigns(3);
        setNewDurationDays(30);
        setNewNotes('');
        setShowCreateModal(false);
        await fetchClients();
      } else {
        alert(data.error || 'Failed to create client');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleSaveCustomPassword = async (clientId: string) => {
    const customPwd = (passwordDrafts[clientId] || '').trim();
    if (!customPwd) {
      alert('অনুগ্রহ করে একটি পাসওয়ার্ড লিখুন (Please enter a password)');
      return;
    }
    setSavingId(clientId);
    try {
      const res = await fetch(`/api/whatsapp/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: customPwd }),
      });
      const data = await res.json();
      if (data.ok && data.client) {
        setClients((prev) =>
          prev.map((c) => (c.id === clientId ? { ...c, password: data.client.password } : c))
        );
        setPasswordDrafts((prev) => ({ ...prev, [clientId]: data.client.password }));
        setVisiblePasswords((prev) => ({ ...prev, [clientId]: true }));
        setSavedPwdId(clientId);
        setTimeout(() => setSavedPwdId(null), 2500);
      } else {
        alert(data.error || 'Failed to update password');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId(null);
    }
  };

  const handleRegeneratePassword = async (clientId: string) => {
    setSavingId(clientId);
    try {
      const res = await fetch(`/api/whatsapp/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regeneratePassword: true }),
      });
      const data = await res.json();
      if (data.ok && data.client) {
        setClients((prev) =>
          prev.map((c) => (c.id === clientId ? { ...c, password: data.client.password } : c))
        );
        setPasswordDrafts((prev) => ({ ...prev, [clientId]: data.client.password }));
        setVisiblePasswords((prev) => ({ ...prev, [clientId]: true }));
        setSavedPwdId(clientId);
        setTimeout(() => setSavedPwdId(null), 2500);
        handleCopyPassword(clientId, data.client.password);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdateQuotas = async (clientId: string) => {
    const draft = quotaDrafts[clientId];
    if (!draft) return;
    setSavingId(clientId);
    try {
      const res = await fetch(`/api/whatsapp/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxWhatsappNumbers: Number(draft.maxNumbers),
          maxCampaigns: Number(draft.maxCampaigns),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchClients();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId(null);
    }
  };

  const handleResetDays = async (clientId: string, days: number) => {
    setSavingId(clientId);
    try {
      const res = await fetch(`/api/whatsapp/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetDays: days }),
      });
      const data = await res.json();
      if (data.ok) {
        setCustomDaysInput((prev) => ({ ...prev, [clientId]: days }));
        await fetchClients();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(`Are you sure you want to delete client "${clientName}"? All their active campaigns will be turned off.`)) {
      return;
    }
    try {
      await fetch(`/api/whatsapp/clients/${clientId}`, { method: 'DELETE' });
      await fetchClients();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleClientCampaign = async (campaignId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/whatsapp/campaigns/${campaignId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      const data = await res.json();
      if (!data.ok && data.error) {
        alert(data.error);
      }
      await fetchClients();
    } catch (err) {
      console.error(err);
    }
  };

  const totalActiveClients = clients.filter((c) => !c.isExpired && c.isActive).length;
  const totalClientCampaigns = clients.reduce((sum, c) => sum + (c.usage?.campaignsCount || 0), 0);
  const totalClientNumbers = clients.reduce((sum, c) => sum + (c.usage?.whatsappNumbersCount || 0), 0);

  return (
    <div className="space-y-7 pb-16">
      {/* Top Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] rounded-2xl p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#164E43]/10 dark:bg-[#34D399]/10 border border-[#164E43]/20 dark:border-[#34D399]/20 flex items-center justify-center text-[#164E43] dark:text-[#34D399]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Client Management & Access Control
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                ক্লায়েন্টদের পাসওয়ার্ড, হোয়াটসঅ্যাপ নাম্বার ও ক্যাম্পেইন লিমিট, ডে-কাউন্টার এবং লাইভ অ্যাক্টিভিটি নিয়ন্ত্রণ করুন
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          className="h-10 px-4 rounded-xl bg-[#164E43] hover:bg-[#124238] text-white font-bold text-xs shadow-sm flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Client</span>
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] p-4">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total Clients</div>
          <div className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{clients.length}</div>
        </div>
        <div className="rounded-2xl bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] p-4">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Active Subscriptions</div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{totalActiveClients}</div>
        </div>
        <div className="rounded-2xl bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] p-4">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Client WhatsApp Numbers</div>
          <div className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{totalClientNumbers}</div>
        </div>
        <div className="rounded-2xl bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] p-4">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Client Campaigns</div>
          <div className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{totalClientCampaigns}</div>
        </div>
      </div>

      {/* Create Client Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-lg bg-[#FBF9F4] dark:bg-[#181A1F] border-[#E6E2D8] dark:border-[#262930] rounded-2xl shadow-2xl">
            <CardHeader className="border-b border-[#E6E2D8] dark:border-[#262930] pb-4">
              <CardTitle className="text-lg font-extrabold text-gray-900 dark:text-white">
                নতুন ক্লায়েন্ট তৈরি করুন (Add Client)
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 dark:text-gray-400">
                ক্লায়েন্টের জন্য ইউনিক পাসওয়ার্ড, নাম্বার ও ক্যাম্পেইন লিমিট এবং কতদিন চলবে তা নির্ধারণ করে দিন
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleCreateClient} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Client Name *</label>
                  <Input
                    placeholder="e.g. Rahim Store / Fashion Bd"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      Max WhatsApp Numbers
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={newMaxNumbers}
                      onChange={(e) => setNewMaxNumbers(Math.max(1, Number(e.target.value)))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      Max Campaigns
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={newMaxCampaigns}
                      onChange={(e) => setNewMaxCampaigns(Math.max(1, Number(e.target.value)))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      Validity Duration (Days)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={3650}
                      value={newDurationDays}
                      onChange={(e) => setNewDurationDays(Math.max(1, Number(e.target.value)))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      Password (ফাঁকা রাখলে অটো তৈরি হবে)
                    </label>
                    <Input
                      placeholder="Auto-generate unique"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E6E2D8] dark:border-[#262930]">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-xl text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={creating}
                    className="rounded-xl bg-[#164E43] hover:bg-[#124238] text-white font-bold text-xs px-5"
                  >
                    {creating ? 'Creating...' : 'Create Client'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Client Cards List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-48 rounded-2xl bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] animate-pulse"
            />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl bg-[#FBF9F4] dark:bg-[#181A1F] border border-dashed border-[#E6E2D8] dark:border-[#262930]">
          <div className="w-12 h-12 rounded-2xl bg-[#164E43]/10 dark:bg-[#34D399]/10 text-[#164E43] dark:text-[#34D399] flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">No Clients Created Yet</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 max-w-md mx-auto">
            নতুন ক্লায়েন্ট তৈরি করে তাদের জন্য ইউনিক পাসওয়ার্ড, হোয়াটসঅ্যাপ নাম্বার লিমিট, ক্যাম্পেইন লিমিট এবং ডে-কাউন্টার সেট করে দিন।
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#164E43] hover:bg-[#124238] text-white font-bold text-xs px-5 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add First Client
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {clients.map((client) => {
            const isExpanded = Boolean(expandedClient[client.id]);
            const currentTab = activeTab[client.id] || 'campaigns';
            const showPwd = Boolean(visiblePasswords[client.id]);
            const draft = quotaDrafts[client.id] || {
              maxNumbers: client.maxWhatsappNumbers,
              maxCampaigns: client.maxCampaigns,
            };
            const daysVal = customDaysInput[client.id] ?? client.durationDays ?? 30;
            const remainingDays = client.remainingDays;
            const isExpired = client.isExpired;

            return (
              <div
                key={client.id}
                className={cn(
                  "rounded-2xl bg-[#FBF9F4] dark:bg-[#181A1F] border shadow-xs overflow-hidden transition-all",
                  isExpanded
                    ? "border-[#164E43]/40 dark:border-[#34D399]/40 ring-1 ring-[#164E43]/15"
                    : "border-[#E6E2D8] dark:border-[#262930] hover:border-[#164E43]/30 dark:hover:border-[#34D399]/30"
                )}
              >
                {/* Clickable Compact Client Header Row (All details hidden until clicked) */}
                <div
                  onClick={() =>
                    setExpandedClient((prev) => ({ ...prev, [client.id]: !prev[client.id] }))
                  }
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer select-none hover:bg-[#F4F1EB]/50 dark:hover:bg-[#1C2026]/50 transition-colors"
                >
                  {/* Profile + Floating Pop-up Day Badge */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="relative pt-1 shrink-0">
                      {/* Floating Day Counter Pop-up Badge on top of Client Profile */}
                      {remainingDays !== null && remainingDays !== undefined && (
                        <div
                          className={cn(
                            "absolute -top-2 -right-2 z-10 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-tight shadow-md border flex items-center gap-1 leading-tight",
                            isExpired || remainingDays <= 0
                              ? "bg-red-600 text-white border-red-400 animate-pulse"
                              : remainingDays <= 5
                              ? "bg-amber-500 text-white border-amber-300"
                              : "bg-[#164E43] text-white border-[#227968]"
                          )}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          <span>{isExpired || remainingDays <= 0 ? '0d (Off)' : `${remainingDays}d`}</span>
                        </div>
                      )}
                      <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-[#164E43]/10 dark:bg-[#34D399]/10 border border-[#164E43]/20 dark:border-[#34D399]/20 flex items-center justify-center text-[#164E43] dark:text-[#34D399] font-extrabold text-xl">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white truncate">
                          {client.name}
                        </h3>
                        <span
                          className={cn(
                            "text-[11px] font-bold px-2.5 py-0.5 rounded-full border",
                            isExpired
                              ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          )}
                        >
                          {isExpired
                            ? '⚠️ Expired — Auto Off'
                            : remainingDays !== null
                            ? `⏳ ${remainingDays} Days Left`
                            : 'Active'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1 font-medium">
                          <Smartphone className="w-3.5 h-3.5 text-[#164E43] dark:text-[#34D399]" />
                          Numbers: <strong className="text-gray-900 dark:text-white">{client.usage?.whatsappNumbersCount || 0} / {client.maxWhatsappNumbers}</strong>
                        </span>
                        <span className="flex items-center gap-1 font-medium">
                          <Layers className="w-3.5 h-3.5 text-[#164E43] dark:text-[#34D399]" />
                          Campaigns: <strong className="text-gray-900 dark:text-white">{client.usage?.campaignsCount || 0} / {client.maxCampaigns}</strong>
                        </span>
                        <span className="flex items-center gap-1 font-medium">
                          <Send className="w-3.5 h-3.5 text-[#164E43] dark:text-[#34D399]" />
                          Sent: <strong className="text-gray-900 dark:text-white">{client.usage?.totalSent || 0}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Expand / Collapse Indicator Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#F4F1EB] dark:bg-[#121418] text-[#164E43] dark:text-[#34D399] border border-[#E6E2D8] dark:border-[#262930]">
                      {isExpanded ? 'Hide Details' : 'View All Details'}
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                    <div className="sm:hidden p-2 rounded-xl bg-[#F4F1EB] dark:bg-[#121418] text-[#164E43] dark:text-[#34D399] border border-[#E6E2D8] dark:border-[#262930]">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded All Details (Password, Quotas, Days Reset, Campaigns, Numbers, Live Activity & Delete) */}
                {isExpanded && (
                  <div className="bg-[#F4F1EB]/70 dark:bg-[#121418] border-t border-[#E6E2D8] dark:border-[#262930] p-5 space-y-5 animate-in fade-in duration-150">
                    {/* Row 1: Editable Custom Password Box + Delete Client Button */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#FBF9F4] dark:bg-[#181A1F] p-3.5 rounded-xl border border-[#E6E2D8] dark:border-[#262930]">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 px-1">
                          <KeyRound className="w-4 h-4 text-[#164E43] dark:text-[#34D399] shrink-0" />
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Password:</span>
                          <div className="relative flex items-center">
                            <Input
                              type={showPwd ? 'text' : 'password'}
                              value={passwordDrafts[client.id] ?? client.password ?? ''}
                              onChange={(e) =>
                                setPasswordDrafts((prev) => ({
                                  ...prev,
                                  [client.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveCustomPassword(client.id);
                                }
                              }}
                              placeholder="নতুন পাসওয়ার্ড লিখুন..."
                              className="h-8 w-40 sm:w-44 pr-7 text-xs font-extrabold font-mono text-gray-900 dark:text-white bg-white dark:bg-[#1C2026] border-[#E6E2D8] dark:border-[#2A2E37] rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setVisiblePasswords((prev) => ({ ...prev, [client.id]: !prev[client.id] }))
                              }
                              className="absolute right-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                              title={showPwd ? 'Hide password' : 'Show password'}
                            >
                              {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSaveCustomPassword(client.id)}
                          disabled={savingId === client.id}
                          className={cn(
                            "h-8 px-3 text-xs font-bold rounded-lg text-white transition-all",
                            savedPwdId === client.id
                              ? "bg-emerald-600 hover:bg-emerald-600"
                              : (passwordDrafts[client.id] ?? client.password) !== client.password
                              ? "bg-emerald-600 hover:bg-emerald-500 shadow-sm ring-2 ring-emerald-500/30"
                              : "bg-[#164E43] hover:bg-[#124238]"
                          )}
                        >
                          {savedPwdId === client.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Saved!
                            </>
                          ) : (
                            <>
                              <Edit3 className="w-3.5 h-3.5 mr-1" />
                              Save Password
                            </>
                          )}
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyPassword(client.id, passwordDrafts[client.id] ?? client.password)}
                          className="h-8 px-2.5 text-xs font-bold rounded-lg border-[#E6E2D8] dark:border-[#2A2E37]"
                        >
                          {copiedId === client.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1" />
                              Copy
                            </>
                          )}
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleRegeneratePassword(client.id)}
                          disabled={savingId === client.id}
                          className="h-8 px-2.5 text-xs font-bold rounded-lg border-[#E6E2D8] dark:border-[#2A2E37]"
                          title="Auto-generate random password"
                        >
                          <RefreshCw className={cn("w-3.5 h-3.5 mr-1", savingId === client.id && "animate-spin")} />
                          Auto Generate
                        </Button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteClient(client.id, client.name)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors self-end lg:self-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Client</span>
                      </button>
                    </div>

                    {/* Row 2: Quotas & Subscription Day Timer Controls Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left: Quota Limits */}
                      <div className="rounded-xl bg-[#FBF9F4] dark:bg-[#181A1F] p-3.5 border border-[#E6E2D8] dark:border-[#262930] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                              Max Numbers
                            </label>
                            <Input
                              type="number"
                              min={1}
                              max={50}
                              value={draft.maxNumbers}
                              onChange={(e) =>
                                setQuotaDrafts((prev) => ({
                                  ...prev,
                                  [client.id]: { ...draft, maxNumbers: Math.max(1, Number(e.target.value)) },
                                }))
                              }
                              className="w-20 h-8 text-xs font-bold bg-white dark:bg-[#121418]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                              Max Campaigns
                            </label>
                            <Input
                              type="number"
                              min={1}
                              max={100}
                              value={draft.maxCampaigns}
                              onChange={(e) =>
                                setQuotaDrafts((prev) => ({
                                  ...prev,
                                  [client.id]: { ...draft, maxCampaigns: Math.max(1, Number(e.target.value)) },
                                }))
                              }
                              className="w-24 h-8 text-xs font-bold bg-white dark:bg-[#121418]"
                            />
                          </div>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleUpdateQuotas(client.id)}
                          disabled={savingId === client.id}
                          className="h-8 px-3.5 rounded-lg bg-[#164E43] hover:bg-[#124238] text-white text-xs font-bold shrink-0"
                        >
                          Save Limits
                        </Button>
                      </div>

                      {/* Right: Day Timer / Validity Control & Reset */}
                      <div className="rounded-xl bg-[#FBF9F4] dark:bg-[#181A1F] p-3.5 border border-[#E6E2D8] dark:border-[#262930] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            <CalendarClock className="w-3.5 h-3.5 text-[#164E43] dark:text-[#34D399]" />
                            <span>Campaign Duration (Days) & Reset</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {[7, 15, 30].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => handleResetDays(client.id, preset)}
                                className="px-2 py-1 rounded-md text-[11px] font-bold bg-white dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#2A2E37] hover:border-[#164E43] text-gray-800 dark:text-gray-200 transition-colors"
                              >
                                {preset}d
                              </button>
                            ))}
                            <Input
                              type="number"
                              min={1}
                              max={3650}
                              value={daysVal}
                              onChange={(e) =>
                                setCustomDaysInput((prev) => ({
                                  ...prev,
                                  [client.id]: Math.max(0, Number(e.target.value)),
                                }))
                              }
                              className="w-16 h-7 text-xs font-bold bg-white dark:bg-[#121418] px-2"
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleResetDays(client.id, Number(daysVal))}
                              disabled={savingId === client.id}
                              className="h-7 px-2.5 rounded-lg bg-[#164E43] hover:bg-[#124238] text-white text-[11px] font-bold"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Set / Reset Days
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleResetDays(client.id, 0)}
                              disabled={savingId === client.id}
                              className="h-7 px-2 rounded-lg border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-[11px] font-bold"
                              title="Expire immediately & turn off all campaigns"
                            >
                              Stop (0d)
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Sub-navigation Tabs */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab((prev) => ({ ...prev, [client.id]: 'campaigns' }))}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            currentTab === 'campaigns'
                              ? "bg-[#164E43] text-white"
                              : "bg-white dark:bg-[#181A1F] text-gray-700 dark:text-gray-300 border border-[#E6E2D8] dark:border-[#262930]"
                          )}
                        >
                          Campaigns ({client.campaigns?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab((prev) => ({ ...prev, [client.id]: 'numbers' }))}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            currentTab === 'numbers'
                              ? "bg-[#164E43] text-white"
                              : "bg-white dark:bg-[#181A1F] text-gray-700 dark:text-gray-300 border border-[#E6E2D8] dark:border-[#262930]"
                          )}
                        >
                          WhatsApp Numbers ({client.accounts?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab((prev) => ({ ...prev, [client.id]: 'activity' }))}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            currentTab === 'activity'
                              ? "bg-[#164E43] text-white"
                              : "bg-white dark:bg-[#181A1F] text-gray-700 dark:text-gray-300 border border-[#E6E2D8] dark:border-[#262930]"
                          )}
                        >
                          Live Activity ({client.recentLogs?.length || 0})
                        </button>
                      </div>

                      <Link href={`/whatsapp/campaigns/new?clientId=${client.id}`}>
                        <Button size="sm" className="h-8 px-3 rounded-lg bg-[#164E43] hover:bg-[#124238] text-white text-xs font-bold">
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Create Campaign for {client.name}
                        </Button>
                      </Link>
                    </div>

                    {/* Tab 1: Client Campaigns */}
                    {currentTab === 'campaigns' && (
                      <div className="space-y-2.5">
                        {(!client.campaigns || client.campaigns.length === 0) ? (
                          <div className="text-xs text-gray-500 dark:text-gray-400 py-6 text-center bg-white dark:bg-[#181A1F] rounded-xl border border-[#E6E2D8] dark:border-[#262930]">
                            এই ক্লায়েন্ট এখনো কোনো ক্যাম্পেইন তৈরি করেনি।
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {client.campaigns.map((camp: any) => (
                              <div
                                key={camp.id}
                                className="p-3.5 rounded-xl bg-white dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "w-2 h-2 rounded-full shrink-0",
                                        camp.isActive ? "bg-emerald-500" : "bg-gray-400"
                                      )}
                                    />
                                    <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                      {camp.name}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                    Keywords: {camp.keywords || 'Default'} • Sent: {camp.totalSent || 0}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleToggleClientCampaign(camp.id, camp.isActive)}
                                    className={cn(
                                      "h-7 px-2.5 text-[11px] font-bold rounded-lg",
                                      camp.isActive
                                        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                                        : "text-gray-500"
                                    )}
                                  >
                                    <Power className="w-3 h-3 mr-1" />
                                    {camp.isActive ? 'ON' : 'OFF'}
                                  </Button>

                                  <Link href={`/whatsapp/campaigns/${camp.id}`}>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-7 px-2.5 text-[11px] font-bold rounded-lg bg-[#164E43] hover:bg-[#124238] text-white"
                                    >
                                      <Edit3 className="w-3 h-3 mr-1" />
                                      Edit
                                    </Button>
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 2: Client WhatsApp Numbers */}
                    {currentTab === 'numbers' && (
                      <div className="space-y-2.5">
                        {(!client.accounts || client.accounts.length === 0) ? (
                          <div className="text-xs text-gray-500 dark:text-gray-400 py-6 text-center bg-white dark:bg-[#181A1F] rounded-xl border border-[#E6E2D8] dark:border-[#262930]">
                            এই ক্লায়েন্ট এখনো কোনো হোয়াটসঅ্যাপ নাম্বার কানেক্ট করেনি।
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {client.accounts.map((acc: any) => (
                              <div
                                key={acc.id}
                                className="p-3.5 rounded-xl bg-white dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] flex items-center justify-between"
                              >
                                <div>
                                  <div className="text-xs font-bold text-gray-900 dark:text-white">{acc.name}</div>
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                    {acc.phoneNumber ? `+${acc.phoneNumber}` : 'No number linked'}
                                  </div>
                                </div>
                                <span
                                  className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                    acc.status === 'connected'
                                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                      : "bg-gray-500/15 text-gray-600 dark:text-gray-400"
                                  )}
                                >
                                  {acc.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 3: Live Activity Logs */}
                    {currentTab === 'activity' && (
                      <div className="space-y-2">
                        {(!client.recentLogs || client.recentLogs.length === 0) ? (
                          <div className="text-xs text-gray-500 dark:text-gray-400 py-6 text-center bg-white dark:bg-[#181A1F] rounded-xl border border-[#E6E2D8] dark:border-[#262930]">
                            এই ক্লায়েন্টের কোনো মেসেজ অ্যাক্টিভিটি লগ এখনো নেই।
                          </div>
                        ) : (
                          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                            {client.recentLogs.map((log: any) => (
                              <div
                                key={log.id}
                                className="px-3.5 py-2 rounded-lg bg-white dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={cn(
                                      "w-2 h-2 rounded-full shrink-0",
                                      log.status === 'sent' ? "bg-emerald-500" : "bg-red-500"
                                    )}
                                  />
                                  <span className="font-bold text-gray-900 dark:text-white truncate">
                                    {log.contactName || log.phoneNumber}
                                  </span>
                                  <span className="text-gray-400">•</span>
                                  <span className="text-gray-500 dark:text-gray-400 uppercase text-[10px] font-semibold">
                                    {log.messageType}
                                  </span>
                                </div>
                                <span className="text-[11px] text-gray-400 shrink-0">
                                  {new Date(log.sentAt).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

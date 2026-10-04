'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Sparkles, 
  ArrowLeft, 
  Send, 
  Users, 
  ShieldCheck, 
  Clock, 
  Trash2, 
  Upload, 
  Key, 
  Radio, 
  Volume2, 
  Image as ImageIcon, 
  Video,
  FileCheck,
  FileText,
  Phone,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Plus,
  Layers,
  Save,
  Calendar,
  Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { WaCampaignVariant } from '@/lib/whatsappTypes';

export default function NewFollowupPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(null);
  const [selectedFilter, setSelectedFilter] = useState('all');

  // Variations State
  const [variants, setVariants] = useState<WaCampaignVariant[]>([]);
  const [openVariantIds, setOpenVariantIds] = useState<Record<string, boolean>>({});
  const [uploadingVariant, setUploadingVariant] = useState<{ variantId: string; type: string } | null>(null);

  const [formSettings, setFormSettings] = useState({
    min_delay_minutes: 45,
    max_delay_minutes: 90,
    min_batch_people: 3,
    max_batch_people: 5,
    duration_hours: 6,
    total_duration_days: 30,
    started_date: '',
    working_hours_start: '09:00',
    working_hours_end: '22:00',
    max_daily_messages: 50,
  });

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/whatsapp/followup?t=${Date.now()}`);
      const json = await res.json();
      if (json.ok) {
        setData(json);
        if (json.settings) {
          setFormSettings({
            min_delay_minutes: json.settings.min_delay_minutes ?? 45,
            max_delay_minutes: json.settings.max_delay_minutes ?? 90,
            min_batch_people: json.settings.min_batch_people ?? 3,
            max_batch_people: json.settings.max_batch_people ?? 5,
            duration_hours: json.settings.duration_hours ?? 6,
            total_duration_days: json.settings.total_duration_days ?? 30,
            started_date: json.settings.started_date || '',
            working_hours_start: json.settings.working_hours_start || '09:00',
            working_hours_end: json.settings.working_hours_end || '22:00',
            max_daily_messages: json.settings.max_daily_messages ?? 50,
          });
        }
        if (Array.isArray(json.variants)) {
          setVariants(json.variants);
          const openState: Record<string, boolean> = {};
          json.variants.forEach((v: WaCampaignVariant, idx: number) => {
            openState[v.id] = idx === 0;
          });
          setOpenVariantIds(openState);
        } else {
          setVariants([]);
          setOpenVariantIds({});
        }
      }
    } catch (err) {
      console.error('Failed to load new followup data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggle = async (key: string, currentValue: boolean) => {
    try {
      const newValue = !currentValue;
      setData((prev: any) => ({
        ...prev,
        settings: { ...prev.settings, [key]: newValue },
      }));

      await fetch('/api/whatsapp/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_setting',
          key,
          value: newValue,
        }),
      });
    } catch (err) {
      console.error('Failed to update toggle:', err);
    }
  };

  const handleAccountChange = async (accountId: string) => {
    const acc = data?.accounts?.find((a: any) => a.id === accountId);
    try {
      await fetch('/api/whatsapp/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_assigned_account',
          accountId,
          accountName: acc?.name || 'All Connected Numbers',
          accountPhone: acc?.phoneNumber || 'Multi-SIM',
        }),
      });
      fetchData();
    } catch (err) {
      alert('নম্বর পরিবর্তন করতে সমস্যা হয়েছে');
    }
  };

  // Variations Helper Handlers
  const toggleVariantOpen = (id: string) => {
    setOpenVariantIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleVariantActive = (id: string, active: boolean) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, isActive: active } : v))
    );
  };

  const updateVariantField = (id: string, field: keyof WaCampaignVariant, value: any) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const handleAddVariant = () => {
    const newId = `var_${Date.now()}`;
    const newIndex = variants.length + 1;
    const newVariant: WaCampaignVariant = {
      id: newId,
      name: `Variation ${newIndex}`,
      isActive: true,
      welcomeMessage: '',
      imageUrl: '',
      audioUrl: '',
      videoUrl: '',
      documentUrl: '',
      documentName: '',
    };
    setVariants((prev) => [...prev, newVariant]);
    setOpenVariantIds((prev) => ({ ...prev, [newId]: true }));
  };

  const handleDeleteVariant = async (id: string) => {
    const updated = variants.filter((v) => v.id !== id);
    setVariants(updated);
    try {
      await fetch('/api/whatsapp/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_variants',
          variants: updated,
        }),
      });
    } catch (err) {
      console.error('Failed to sync after deleting variant:', err);
    }
  };

  // Upload handler for variant media slots
  const handleVariantFileUpload = async (
    variantId: string,
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'image' | 'video' | 'audio' | 'document'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingVariant({ variantId, type });
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const res = await fetch('/api/whatsapp/upload', {
        method: 'POST',
        body: formData,
      });
      const resData = await res.json();
      if (!resData.ok) throw new Error(resData.error || 'Upload failed');

      if (type === 'image') updateVariantField(variantId, 'imageUrl', resData.url);
      if (type === 'audio') updateVariantField(variantId, 'audioUrl', resData.url);
      if (type === 'video') updateVariantField(variantId, 'videoUrl', resData.url);
      if (type === 'document') {
        updateVariantField(variantId, 'documentUrl', resData.url);
        updateVariantField(variantId, 'documentName', resData.filename || file.name);
      }
    } catch (err: any) {
      alert(`আপলোড ব্যর্থ: ${err.message}`);
    } finally {
      setUploadingVariant(null);
    }
  };

  // Save Variations and Timing Settings to Store
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await fetch('/api/whatsapp/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_variants',
          variants,
        }),
      });

      const res = await fetch('/api/whatsapp/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_settings',
          settings: formSettings,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        alert('✅ সকল ভ্যারিয়েশন এবং ফলো-আপ সেটিংস সফলভাবে সেভ হয়েছে!');
        fetchData();
      } else {
        alert('সেভ ব্যর্থ: ' + json.error);
      }
    } catch (err: any) {
      alert('সেভ এরর: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLeadAction = async (phone: string, newStatus: string) => {
    try {
      await fetch('/api/whatsapp/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_lead_status',
          phone,
          status: newStatus,
        }),
      });
      fetchData();
    } catch (err) {
      alert('লিড স্ট্যাটাস পরিবর্তন ব্যর্থ');
    }
  };

  const settings = data?.settings || {};
  const stats = data?.stats || {};
  const leads = data?.leads || [];
  const accounts = data?.accounts || [];
  const activeApiKeys = data?.activeApiKeys || [];

  const filteredLeads = leads.filter((l: any) => {
    if (selectedFilter === 'all') return true;
    return l.status === selectedFilter;
  });

  const totalDays = Number(formSettings.total_duration_days) || 0;
  const startedDateStr = settings.started_date || formSettings.started_date;
  const startedDateObj = startedDateStr ? new Date(startedDateStr) : new Date();
  const elapsedDays = Math.max(0, Math.floor((Date.now() - startedDateObj.getTime()) / (24 * 60 * 60 * 1000)));
  const remainingDays = totalDays > 0 ? Math.max(0, totalDays - elapsedDays) : null;
  const isExpired = totalDays > 0 && elapsedDays >= totalDays;

  let endDateFormatted = 'অনির্দিষ্টকাল (চলতেই থাকবে)';
  if (totalDays > 0) {
    const endDate = new Date(startedDateObj.getTime() + totalDays * 24 * 60 * 60 * 1000);
    endDateFormatted = endDate.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  const startDateFormatted = startedDateObj.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-8 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="w-full sm:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-2 mb-2">
            <Link href="/whatsapp" className="text-muted-foreground hover:text-white transition-colors flex items-center gap-1 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to WhatsApp
            </Link>

            {/* Mobile-only visible quick ON/OFF badge */}
            <div className="sm:hidden flex items-center gap-2 bg-card/90 border border-border/80 px-3 py-1.5 rounded-xl shadow-sm">
              <span className={cn(
                "w-2 h-2 rounded-full",
                settings.auto_followup ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
              )} />
              <span className={cn(
                "text-xs font-bold",
                settings.auto_followup ? "text-emerald-400" : "text-zinc-400"
              )}>
                {settings.auto_followup ? 'ON' : 'OFF'}
              </span>
              <Switch
                checked={Boolean(settings.auto_followup)}
                onCheckedChange={(checked) => handleToggle('auto_followup', Boolean(settings.auto_followup))}
                className="data-[state=checked]:bg-emerald-600 scale-90"
              />
            </div>
          </div>

          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5 sm:gap-3">
            <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            <span>New Follow-up (নতুন কাস্টমার অটো ফলো-আপ)</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            নতুন বা কোল্ড কাস্টমারদের জন্য স্বয়ংক্রিয় ২ মিনিট, ৩ ঘণ্টা, ডে ১ ও ডে ২ এ মাল্টি-ভ্যারিয়েশন ফলো-আপ
          </p>
        </div>

        {/* Desktop/Tablet ON / OFF Switch */}
        <div className="hidden sm:flex items-center gap-3 bg-card/80 border border-border/80 px-4 py-2.5 rounded-2xl shadow-sm shrink-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "w-2.5 h-2.5 rounded-full",
              settings.auto_followup ? "bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" : "bg-zinc-600"
            )} />
            <span className={cn(
              "text-xs font-bold tracking-wider",
              settings.auto_followup ? "text-emerald-400" : "text-zinc-400"
            )}>
              {settings.auto_followup ? 'ON' : 'OFF'}
            </span>
          </div>
          <Switch
            checked={Boolean(settings.auto_followup)}
            onCheckedChange={(checked) => handleToggle('auto_followup', Boolean(settings.auto_followup))}
            className="data-[state=checked]:bg-emerald-600"
          />
        </div>
      </div>

      {/* WhatsApp Number Choice System */}
      <div className="p-4 rounded-2xl bg-card border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Phone className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">
              WhatsApp নম্বর পছন্দ করুন (Choose Number)
            </div>
            <p className="text-xs text-muted-foreground">
              যে নম্বর দিয়ে অটো ফলো-আপ পাঠাতে চান তা সিলেক্ট করুন
            </p>
          </div>
        </div>

        <div className="w-full sm:w-80">
          <select
            value={settings.assigned_account_id || 'all'}
            onChange={(e) => handleAccountChange(e.target.value)}
            className="w-full h-10 px-3.5 rounded-xl bg-secondary/80 border border-border/80 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer transition-all"
          >
            <option value="all">🌐 সকল নম্বর (All Numbers)</option>
            {accounts.map((acc: any) => (
              <option key={acc.id} value={acc.id}>
                📱 {acc.name} {acc.phoneNumber ? `(${acc.phoneNumber})` : ''} - {acc.status === 'connected' ? 'Connected' : 'Disconnected'}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* 2. Message Variations Section (A/B Switching & Rotation) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              Follow-up Message Variations
            </h3>
            <p className="text-xs text-muted-foreground">
              Add multiple variations (text, image, audio, video, document) with auto A/B rotation.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleAddVariant}
            variant="outline"
            size="sm"
            className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-xs flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Variation</span>
          </Button>
        </div>

        {variants.length === 0 ? (
          <Button
            type="button"
            onClick={handleAddVariant}
            variant="outline"
            className="w-full border-dashed border-border/70 hover:border-emerald-500/60 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/5 py-7 flex items-center justify-center gap-2 font-medium rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Variation</span>
          </Button>
        ) : (
          <>
            {/* List of Variations */}
            <div className="space-y-4">
              {variants.map((variant, index) => {
            const isOpen = Boolean(openVariantIds[variant.id]);
            const isUploading = uploadingVariant?.variantId === variant.id;

            return (
              <Card
                key={variant.id}
                className={cn(
                  "border transition-all duration-200 bg-card/70 backdrop-blur-md overflow-hidden",
                  variant.isActive ? "border-border/80" : "border-border/40 opacity-75"
                )}
              >
                {/* Variation Header */}
                <div className="p-4 bg-secondary/40 border-b border-border/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {/* Triangle Arrow Button */}
                    <button
                      type="button"
                      onClick={() => toggleVariantOpen(variant.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-secondary/80 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-all shrink-0"
                      title={isOpen ? "Collapse variation" : "Expand variation"}
                    >
                      <Play
                        className={cn(
                          "w-3.5 h-3.5 fill-current transition-transform duration-200",
                          isOpen ? "rotate-90 text-emerald-400" : "rotate-0 text-muted-foreground"
                        )}
                      />
                    </button>

                    {/* Variation Name Input */}
                    <input
                      type="text"
                      value={variant.name}
                      onChange={(e) => updateVariantField(variant.id, 'name', e.target.value)}
                      className="bg-transparent font-semibold text-sm text-white hover:bg-secondary/40 focus:bg-background/80 px-2 py-1 rounded transition-colors border border-transparent focus:border-border/60 truncate max-w-[200px] sm:max-w-xs"
                      placeholder={`Variation ${index + 1}`}
                    />

                    {/* Active Status Badge */}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] hidden sm:flex items-center gap-1",
                        variant.isActive
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          : "bg-secondary text-muted-foreground border-border/50"
                      )}
                    >
                      {variant.isActive ? 'Active in Rotation' : 'Disabled'}
                    </Badge>
                  </div>

                  {/* Header Actions: ON/OFF Toggle Switch & Delete */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {variant.isActive ? 'ON' : 'OFF'}
                      </span>
                      <Switch
                        checked={variant.isActive}
                        onCheckedChange={(checked) => toggleVariantActive(variant.id, checked)}
                        className="data-[state=checked]:bg-emerald-600"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteVariant(variant.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete variation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Collapsible Content */}
                {isOpen && (
                  <CardContent className="p-5 space-y-5">
                    {/* Text Message Content */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-emerald-400" />
                          <span>Text Message Content</span>
                        </label>
                        <span className="text-[11px] text-muted-foreground">
                          {variant.welcomeMessage.length} characters
                        </span>
                      </div>
                      <Textarea
                        rows={4}
                        placeholder="Write follow-up message to send automatically (e.g. details, price, soft check)..."
                        value={variant.welcomeMessage}
                        onChange={(e) => updateVariantField(variant.id, 'welcomeMessage', e.target.value)}
                        className="bg-background/50 border-border/60 font-mono text-xs leading-relaxed"
                      />
                    </div>

                    {/* Media Files Grid - 4 Grid Slots */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {/* 1. Product Image (Banner) */}
                        <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/60 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                              <ImageIcon className="w-4 h-4 text-emerald-400" />
                              Product Image (Banner)
                            </span>
                            {variant.imageUrl && (
                              <button
                                type="button"
                                onClick={() => updateVariantField(variant.id, 'imageUrl', '')}
                                className="text-muted-foreground hover:text-red-400 text-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {variant.imageUrl ? (
                            <div className="space-y-2">
                              <div className="relative rounded-lg overflow-hidden border border-border max-h-32 bg-black/40">
                                <img
                                  src={variant.imageUrl}
                                  alt="Uploaded preview"
                                  className="w-full object-contain max-h-32"
                                />
                              </div>
                              <p className="text-[10px] text-muted-foreground truncate">{variant.imageUrl}</p>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center p-3 border border-dashed border-border/80 rounded-xl cursor-pointer hover:bg-secondary/40 transition-colors">
                              <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                              <span className="text-xs text-muted-foreground">Upload Image (JPG/PNG)</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleVariantFileUpload(variant.id, e, 'image')}
                                disabled={isUploading && uploadingVariant?.type === 'image'}
                              />
                            </label>
                          )}
                          {isUploading && uploadingVariant?.type === 'image' && (
                            <p className="text-xs text-blue-400 animate-pulse">Uploading image...</p>
                          )}
                        </div>

                        {/* 2. Voice Note / Audio (MP3/OGG) with Audio Player */}
                        <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/60 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                              <Volume2 className="w-4 h-4 text-purple-400" />
                              Voice Note / Audio (MP3/OGG)
                            </span>
                            {variant.audioUrl && (
                              <button
                                type="button"
                                onClick={() => updateVariantField(variant.id, 'audioUrl', '')}
                                className="text-muted-foreground hover:text-red-400 text-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {variant.audioUrl ? (
                            <div className="space-y-2">
                              <audio src={variant.audioUrl} controls className="w-full h-9 rounded" />
                              <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                Audio file attached
                              </p>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center p-3 border border-dashed border-border/80 rounded-xl cursor-pointer hover:bg-secondary/40 transition-colors">
                              <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                              <span className="text-xs text-muted-foreground">Upload Voice Note (MP3/OGG)</span>
                              <input
                                type="file"
                                accept="audio/*"
                                className="hidden"
                                onChange={(e) => handleVariantFileUpload(variant.id, e, 'audio')}
                                disabled={isUploading && uploadingVariant?.type === 'audio'}
                              />
                            </label>
                          )}
                          {isUploading && uploadingVariant?.type === 'audio' && (
                            <p className="text-xs text-blue-400 animate-pulse">Uploading audio...</p>
                          )}
                        </div>

                        {/* 3. Demo Video (MP4) */}
                        <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/60 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                              <Video className="w-4 h-4 text-rose-400" />
                              Demo Video (MP4)
                            </span>
                            {variant.videoUrl && (
                              <button
                                type="button"
                                onClick={() => updateVariantField(variant.id, 'videoUrl', '')}
                                className="text-muted-foreground hover:text-red-400 text-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {variant.videoUrl ? (
                            <div className="space-y-2">
                              <div className="relative rounded-lg overflow-hidden border border-border max-h-32 bg-black/40">
                                <video src={variant.videoUrl} controls className="w-full object-contain max-h-32" />
                              </div>
                              <p className="text-[10px] text-muted-foreground truncate">{variant.videoUrl}</p>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center p-3 border border-dashed border-border/80 rounded-xl cursor-pointer hover:bg-secondary/40 transition-colors">
                              <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                              <span className="text-xs text-muted-foreground">Upload Video (MP4)</span>
                              <input
                                type="file"
                                accept="video/*"
                                className="hidden"
                                onChange={(e) => handleVariantFileUpload(variant.id, e, 'video')}
                                disabled={isUploading && uploadingVariant?.type === 'video'}
                              />
                            </label>
                          )}
                        </div>

                        {/* 4. Document / Catalog (PDF) */}
                        <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/60 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                              <FileCheck className="w-4 h-4 text-amber-400" />
                              Document / Catalog (PDF)
                            </span>
                            {variant.documentUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  updateVariantField(variant.id, 'documentUrl', '');
                                  updateVariantField(variant.id, 'documentName', '');
                                }}
                                className="text-muted-foreground hover:text-red-400 text-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {variant.documentUrl ? (
                            <div className="p-3 rounded-lg bg-background/50 border border-border space-y-1">
                              <p className="text-xs font-medium text-white truncate">{variant.documentName || 'Document.pdf'}</p>
                              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                File attached
                              </p>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center p-3 border border-dashed border-border/80 rounded-xl cursor-pointer hover:bg-secondary/40 transition-colors">
                              <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                              <span className="text-xs text-muted-foreground">Upload Document (PDF/DOCX)</span>
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx"
                                className="hidden"
                                onChange={(e) => handleVariantFileUpload(variant.id, e, 'document')}
                                disabled={isUploading && uploadingVariant?.type === 'document'}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Add Another Variation Button */}
        <Button
          type="button"
          onClick={handleAddVariant}
          variant="outline"
          className="w-full border-dashed border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 py-5 flex items-center justify-center gap-2 font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>Add Another Variation (A/B Switching & Rotation)</span>
        </Button>
      </>
    )}
  </div>

      {/* 4. Module Controls (Toggles & Timing) */}
      <div className="p-6 rounded-2xl bg-card border border-border/60 space-y-6">
        <div className="border-b border-border/50 pb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            New Follow-up অটোমেশন ও প্রোটেকশন কন্ট্রোল
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            নতুন কাস্টমার অটো ফলো-আপের সেটিংস ও অ্যান্টি-ব্যান রুলস
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Toggle 1: Auto Follow-up */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/30 border border-border/40 gap-3">
            <div className="flex-1 min-w-0 pr-1">
              <div className="text-sm font-semibold text-white">⚡ অটো ফলো-আপ সক্রিয় (Auto Follow-up)</div>
              <div className="text-xs text-muted-foreground mt-0.5">২ মি, ৩ ঘণ্টা, ডে ১ ও ডে ২ এ ভ্যারিয়েশন রোটেট করে পাঠাবে</div>
            </div>
            <Switch
              checked={settings.auto_followup}
              onCheckedChange={(checked) => handleToggle('auto_followup', settings.auto_followup)}
              className="data-[state=checked]:bg-emerald-600 shrink-0"
            />
          </div>

          {/* Toggle 2: Gemini AI Brain */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/30 border border-border/40 gap-3">
            <div className="flex-1 min-w-0 pr-1">
              <div className="text-sm font-semibold text-white">🧠 Gemini AI ব্রেইন (Smart Variation)</div>
              <div className="text-xs text-muted-foreground mt-0.5">ন্যাচারাল বাংলায় প্রতিবার টেক্সট সামান্য বদলে পাঠাবে</div>
            </div>
            <Switch
              checked={settings.ai_brain}
              onCheckedChange={(checked) => handleToggle('ai_brain', settings.ai_brain)}
              className="data-[state=checked]:bg-emerald-600 shrink-0"
            />
          </div>

          {/* Toggle 3: Anti-Ban Protection */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/30 border border-border/40 gap-3">
            <div className="flex-1 min-w-0 pr-1">
              <div className="text-sm font-semibold text-white">🛡️ অ্যান্টি-ব্যান গার্ড (Anti-Ban Jitter)</div>
              <div className="text-xs text-muted-foreground mt-0.5">টাইপিং ৩-৮ সেকেন্ড, র্যান্ডম হিউম্যান ডিলে ও নাইট লক</div>
            </div>
            <Switch
              checked={settings.antiban}
              onCheckedChange={(checked) => handleToggle('antiban', settings.antiban)}
              className="data-[state=checked]:bg-emerald-600 shrink-0"
            />
          </div>

          {/* Toggle 4: Rolling 30-Day Cleanup */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/30 border border-border/40 gap-3">
            <div className="flex-1 min-w-0 pr-1">
              <div className="text-sm font-semibold text-white">🧹 রোলিং ৩০-দিনের ডেটা ক্লিনআপ (Rolling 30-Day Window)</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                ১ম ৩০ দিন ডেটা জমা থাকবে। ৩১তম দিনে ১ম দিনের ডেটা মুছে ৩১তম দিন যুক্ত হবে, ৩২তম দিনে ২য় দিনের ডেটা মুছে ৩২তম দিন যুক্ত হবে (সবসময় ঠিক ৩০ দিন ফ্রেশ থাকবে)।
              </div>
            </div>
            <Switch
              checked={settings.auto_cleanup}
              onCheckedChange={(checked) => handleToggle('auto_cleanup', settings.auto_cleanup)}
              className="data-[state=checked]:bg-emerald-600 shrink-0"
            />
          </div>
        </div>

        {/* Timing, Duration & Schedule Form Inputs */}
        <div className="pt-3 border-t border-border/50 space-y-5">
          {/* Row 1: Duration in Days & Daily Hours */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-secondary/20 border border-border/60">
            {/* Total Duration in Days */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>মোট কত দিন চলবে (ক্যাম্পেইন মেয়াদ)</span>
                </label>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {totalDays === 0 ? '∞ আনলিমিটেড' : `${totalDays} দিন`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  value={formSettings.total_duration_days}
                  onChange={(e) => setFormSettings({ ...formSettings, total_duration_days: Math.max(0, Number(e.target.value)) })}
                  className="bg-background/60 border-border/60 text-xs h-9 font-semibold"
                  placeholder="30"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">দিন (0 = আনলিমিটেড)</span>
              </div>

              {/* Quick Preset Selection Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {[
                  { label: '৭ দিন', value: 7 },
                  { label: '১৫ দিন', value: 15 },
                  { label: '৩০ দিন', value: 30 },
                  { label: '৬০ দিন', value: 60 },
                  { label: '৯০ দিন', value: 90 },
                  { label: '∞ আনলিমিটেড', value: 0 },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setFormSettings({ ...formSettings, total_duration_days: chip.value })}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border",
                      formSettings.total_duration_days === chip.value
                        ? "bg-emerald-600/30 text-emerald-300 border-emerald-500/50"
                        : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-white border-border/60"
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Daily Duration in Hours */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>দৈনিক কত ঘণ্টা চলবে</span>
                </label>
                <span className="text-[11px] text-muted-foreground">প্রতিদিনের সক্রিয় সময়</span>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={formSettings.duration_hours}
                  onChange={(e) => setFormSettings({ ...formSettings, duration_hours: Number(e.target.value) || 1 })}
                  className="bg-background/60 border-border/60 text-xs h-9 font-semibold"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">ঘণ্টা/দিন</span>
              </div>

              {/* Preset Chips for Hours */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {[
                  { label: '৪ ঘণ্টা', value: 4 },
                  { label: '৬ ঘণ্টা', value: 6 },
                  { label: '৮ ঘণ্টা', value: 8 },
                  { label: '১২ ঘণ্টা', value: 12 },
                  { label: '২৪ ঘণ্টা', value: 24 },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setFormSettings({ ...formSettings, duration_hours: chip.value })}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border",
                      formSettings.duration_hours === chip.value
                        ? "bg-emerald-600/30 text-emerald-300 border-emerald-500/50"
                        : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-white border-border/60"
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Real-time Duration Summary & Countdown Bar */}
          <div className="p-3.5 rounded-xl bg-background/50 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <Timer className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  <span>ক্যাম্পেইন সময়কাল ট্র্যাকিং</span>
                  {isExpired ? (
                    <Badge variant="outline" className="text-[10px] bg-red-500/15 text-red-300 border-red-500/30">
                      মেয়াদ শেষ (Completed)
                    </Badge>
                  ) : remainingDays !== null ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                      {remainingDays} দিন বাকি আছে
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-blue-500/15 text-blue-300 border-blue-500/30">
                      আনলিমিটেড চলবে
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  শুরুর তারিখ: {startDateFormatted} • সমাপ্তির তারিখ: {endDateFormatted}
                </p>
              </div>
            </div>

            {totalDays > 0 && (
              <div className="text-right sm:border-l sm:border-border/60 sm:pl-4">
                <p className="text-[11px] text-muted-foreground">অগ্রগতি (Progress)</p>
                <p className="font-semibold text-emerald-400">
                  {Math.min(elapsedDays, totalDays)} / {totalDays} দিন অতিবাহিত
                </p>
              </div>
            )}
          </div>

          {/* Row 2: Interval Delays & Batch Size */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Interval Delay Min - Max */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">বিরতি (মিনিট: সর্বনিম্ন - সর্বোচ্চ)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={formSettings.min_delay_minutes}
                  onChange={(e) => setFormSettings({ ...formSettings, min_delay_minutes: Number(e.target.value) || 1 })}
                  className="bg-background/50 border-border/60 text-xs flex-1 min-w-0 h-10"
                  placeholder="Min"
                />
                <span className="text-muted-foreground text-xs shrink-0">-</span>
                <Input
                  type="number"
                  min="1"
                  value={formSettings.max_delay_minutes}
                  onChange={(e) => setFormSettings({ ...formSettings, max_delay_minutes: Number(e.target.value) || 1 })}
                  className="bg-background/50 border-border/60 text-xs flex-1 min-w-0 h-10"
                  placeholder="Max"
                />
              </div>
            </div>

            {/* Batch People Min - Max */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">প্রতি ব্যাচে মানুষ (সর্বনিম্ন - সর্বোচ্চ)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={formSettings.min_batch_people}
                  onChange={(e) => setFormSettings({ ...formSettings, min_batch_people: Number(e.target.value) || 1 })}
                  className="bg-background/50 border-border/60 text-xs flex-1 min-w-0 h-10"
                  placeholder="Min"
                />
                <span className="text-muted-foreground text-xs shrink-0">-</span>
                <Input
                  type="number"
                  min="1"
                  value={formSettings.max_batch_people}
                  onChange={(e) => setFormSettings({ ...formSettings, max_batch_people: Number(e.target.value) || 1 })}
                  className="bg-background/50 border-border/60 text-xs flex-1 min-w-0 h-10"
                  placeholder="Max"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Working Hours & Daily Maximum Messages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Working Hours */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">কাজের সময় (শুরু - শেষ)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={formSettings.working_hours_start}
                  onChange={(e) => setFormSettings({ ...formSettings, working_hours_start: e.target.value })}
                  className="bg-background/50 border-border/60 text-xs flex-1 min-w-0 h-10"
                />
                <span className="text-muted-foreground text-xs shrink-0">-</span>
                <Input
                  type="time"
                  value={formSettings.working_hours_end}
                  onChange={(e) => setFormSettings({ ...formSettings, working_hours_end: e.target.value })}
                  className="bg-background/50 border-border/60 text-xs flex-1 min-w-0 h-10"
                />
              </div>
            </div>

            {/* Daily Maximum Messages */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">দৈনিক সর্বোচ্চ লিমিট</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={formSettings.max_daily_messages}
                  onChange={(e) => setFormSettings({ ...formSettings, max_daily_messages: Number(e.target.value) || 1 })}
                  className="bg-background/50 border-border/60 text-xs h-10"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">মেসেজ/দিন</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button Bar */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 p-3.5 sm:p-4 rounded-2xl bg-card/95 backdrop-blur-md border border-border/80 sticky bottom-3 sm:bottom-4 shadow-2xl z-20">
        <Link href="/whatsapp" className="w-full sm:w-auto">
          <Button variant="ghost" type="button" className="w-full sm:w-auto text-muted-foreground h-11 text-xs sm:text-sm">
            Cancel
          </Button>
        </Link>
        <Button
          onClick={handleSaveAll}
          disabled={saving}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 h-11 text-xs sm:text-sm shadow-md shadow-emerald-900/30"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving Changes...' : 'Save Follow-up Variations & Settings'}
        </Button>
      </div>

      {/* 5. New Leads Tracking Table Section */}
      <div className="p-6 rounded-2xl bg-card border border-border/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              নতুন কাস্টমার ও লিড ট্র্যাকিং (New Leads Tracking)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              সকল কাস্টমারের বর্তমান অবস্থা, প্রমিজ ডেট এবং ম্যানুয়াল টেকওভার লিস্ট
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'সবাই' },
              { id: 'in_followup', label: 'ফলো-আপ চলছে' },
              { id: 'manual_takeover', label: '🚨 ম্যানুয়াল চ্যাট' },
              { id: 'promised', label: '📅 তারিখ দেওয়া' },
              { id: 'archived', label: 'আর্কাইভড' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedFilter(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                  selectedFilter === tab.id
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-secondary/30 border-border/40 text-muted-foreground hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="py-2.5 px-3">ফোন নম্বর</th>
                <th className="py-2.5 px-3">নাম</th>
                <th className="py-2.5 px-3">সম্বোধন</th>
                <th className="py-2.5 px-3">স্ট্যাটাস</th>
                <th className="py-2.5 px-3">ধাপ</th>
                <th className="py-2.5 px-3">প্রমিজ ডেট</th>
                <th className="py-2.5 px-3">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    কোনো কাস্টমার পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredLeads.map((l: any) => {
                  const honorific = l.gender === 'apu' ? 'আপু' : l.gender === 'vai' ? 'ভাইয়া' : 'আপনি';
                  return (
                    <tr key={l.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-3 px-3 font-semibold text-white">{l.phone}</td>
                      <td className="py-3 px-3 text-muted-foreground">{l.name || 'N/A'}</td>
                      <td className="py-3 px-3">{honorific}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          l.status === 'manual_takeover' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                          l.status === 'in_followup' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          l.status === 'promised' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {l.status === 'manual_takeover' ? '🚨 ম্যানুয়াল চ্যাট' : l.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">ধাপ {l.follow_up_step || 0}</td>
                      <td className="py-3 px-3 text-emerald-400">{l.promise_date || '-'}</td>
                      <td className="py-3 px-3">
                        {l.status === 'manual_takeover' ? (
                          <button
                            onClick={() => handleLeadAction(l.phone, 'closed')}
                            className="px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 text-white text-[11px]"
                          >
                            ক্লোজ করুন
                          </button>
                        ) : (
                          <button
                            onClick={() => handleLeadAction(l.phone, 'manual_takeover')}
                            className="px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 text-white text-[11px]"
                          >
                            টেকওভার
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

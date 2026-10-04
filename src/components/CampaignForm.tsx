"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  FileCheck, 
  Upload, 
  Trash2, 
  Sparkles, 
  Save, 
  ArrowLeft, 
  Clock, 
  Layers, 
  Phone, 
  Plus, 
  Play, 
  RotateCcw, 
  CheckCircle,
  Bot,
  FileSpreadsheet,
  Send,
  Zap,
  FileUp,
  Key,
  Mail
} from 'lucide-react';
import { WaCampaign, WaCampaignVariant, WaFollowupConfig, WaUnderstandingFile, WaFollowupMediaFile } from '@/lib/whatsappTypes';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface CampaignFormProps {
  initialData?: Partial<WaCampaign>;
  isEditing?: boolean;
  returnTo?: string;
}

export function CampaignForm({ initialData, isEditing, returnTo }: CampaignFormProps) {
  const router = useRouter();

  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [accountId, setAccountId] = useState(initialData?.accountId || 'all');
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; phoneNumber?: string; status: string }>>([]);
  const [keywords, setKeywords] = useState(initialData?.keywords || '');
  const [isDefault, setIsDefault] = useState(initialData?.isDefault ?? false);

  useEffect(() => {
    if (initialData?.accountId) {
      setAccountId(initialData.accountId);
    }
  }, [initialData?.accountId]);

  // Delivery settings
  const [sendOrder, setSendOrder] = useState(initialData?.sendOrder || 'message,image,audio,video,document');
  const [delayBetweenSends, setDelayBetweenSends] = useState(initialData?.delayBetweenSends ?? 3);
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [chatReplyEnabled, setChatReplyEnabled] = useState(initialData?.chatReplyEnabled ?? false);


  // Variations (Multi-response auto switching)
  const [variants, setVariants] = useState<WaCampaignVariant[]>(() => {
    if (initialData?.variants && initialData.variants.length > 0) {
      return initialData.variants;
    }
    return [
      {
        id: 'var_1',
        name: 'Variation 1 (Default)',
        isActive: true,
        welcomeMessage: initialData?.welcomeMessage || '',
        imageUrl: initialData?.imageUrl || '',
        audioUrl: initialData?.audioUrl || '',
        videoUrl: initialData?.videoUrl || '',
        documentUrl: initialData?.documentUrl || '',
        documentName: initialData?.documentName || '',
      },
    ];
  });

  // Track expanded/collapsed state for each variation
  const [openVariantIds, setOpenVariantIds] = useState<Record<string, boolean>>(() => {
    const initialOpen: Record<string, boolean> = {};
    if (initialData?.variants && initialData.variants.length > 0) {
      initialData.variants.forEach((v, index) => {
        initialOpen[v.id] = index === 0; // Open first variation by default
      });
    } else {
      initialOpen['var_1'] = true;
    }
    return initialOpen;
  });

  const [uploadingVariant, setUploadingVariant] = useState<{ variantId: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Automation & Smart Follow-up State
  const [fupConfig, setFupConfig] = useState<WaFollowupConfig>(() => {
    return (
      initialData?.followupConfig || {
        aiEnabled: true,
        aiApiKey: '',
        aiModel: 'gemini-2.5-flash',
        aiSystemPrompt: 'প্রোডাক্ট নলেজ ও তথ্যের আলোকে ফলো-আপ মেসেজটি মিষ্টি, আকর্ষণীয় ও মার্জিত বাংলায় গুছিয়ে লিখে পাঠাবে। কোনো রোবোটিক ভাব রাখবে না।',
        understandingFiles: [],
        understandingText: '',
        followupEnabled: true,
        followupDelayValue: 3,
        followupDelayUnit: 'hours',
        followupCondition: 'no_reply',
        antiBanJitter: true,
        followupMessage: 'আসসালামু আলাইকুম {name}! আমাদের প্যাকেজ বা অফারটি নিয়ে কোনো প্রশ্ন থাকলে নির্দ্বিধায় জানাতে পারেন। আমরা আপনাকে সহায়তার জন্য প্রস্তুত আছি!',
        followupFiles: initialData?.followupConfig?.followupFiles || [],
        followupImageUrl: '',
        followupVideoUrl: '',
        followupAudioUrl: '',
        followupDocumentUrl: '',
        followupDocumentName: '',
      }
    );
  });

  const [apiKeys, setApiKeys] = useState<Array<{ id: string; label: string; gmail: string; status?: string }>>([]);
  const [keyMode, setKeyMode] = useState<'existing' | 'new'>('existing');
  const [newApiKeyInput, setNewApiKeyInput] = useState('');
  const [newApiGmailInput, setNewApiGmailInput] = useState('');
  const [newApiLabelInput, setNewApiLabelInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isUploadingFollowupMedia, setIsUploadingFollowupMedia] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/api-keys')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setApiKeys(data);
          if (data.length === 0) {
            setKeyMode('new');
          }
        }
      })
      .catch((err) => console.error('Failed to load api keys:', err));
  }, []);

  const updateFup = (field: keyof WaFollowupConfig, value: any) => {
    setFupConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveNewApiKey = async () => {
    if (!newApiKeyInput.trim() || !newApiGmailInput.trim()) {
      setError('Please enter both the Gemini API Key and Gmail address');
      return;
    }
    setSavingKey(true);
    setError(null);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: newApiKeyInput.trim(),
          gmail: newApiGmailInput.trim(),
          label: newApiLabelInput.trim() || newApiGmailInput.trim().split('@')[0],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save API key');

      setApiKeys((prev) => [...prev, data]);
      updateFup('aiApiKey', data.id);
      setKeyMode('existing');
      setNewApiKeyInput('');
      setNewApiGmailInput('');
      setNewApiLabelInput('');
    } catch (err: any) {
      setError(err.message || 'Failed to add API key');
    } finally {
      setSavingKey(false);
    }
  };

  const handleUnderstandingFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDoc(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'document');

      const res = await fetch('/api/whatsapp/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Upload failed');

      const newDoc: WaUnderstandingFile = {
        id: `doc_${Date.now()}`,
        name: data.filename || file.name,
        url: data.url,
        size: file.size,
        type: file.type || file.name.split('.').pop(),
        uploadedAt: new Date().toISOString(),
      };

      setFupConfig((prev) => ({
        ...prev,
        understandingFiles: [...(prev.understandingFiles || []), newDoc],
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to upload understanding file');
    } finally {
      setIsUploadingDoc(false);
      e.target.value = '';
    }
  };

  const handleDeleteUnderstandingFile = (id: string) => {
    setFupConfig((prev) => ({
      ...prev,
      understandingFiles: (prev.understandingFiles || []).filter((f) => f.id !== id),
    }));
  };

  const handleFollowupMediaUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'image' | 'video' | 'audio' | 'document'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFollowupMedia(type);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const res = await fetch('/api/whatsapp/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Upload failed');

      const newMediaFile: WaFollowupMediaFile = {
        id: `fup_media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: data.filename || file.name,
        url: data.url,
        type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };

      setFupConfig((prev) => ({
        ...prev,
        followupFiles: [...(prev.followupFiles || []), newMediaFile],
        ...(type === 'image' ? { followupImageUrl: data.url } : {}),
        ...(type === 'video' ? { followupVideoUrl: data.url } : {}),
        ...(type === 'audio' ? { followupAudioUrl: data.url } : {}),
        ...(type === 'document' ? { followupDocumentUrl: data.url, followupDocumentName: data.filename || file.name } : {}),
      }));
    } catch (err: any) {
      setError(err.message || `Failed to upload follow-up ${type}`);
    } finally {
      setIsUploadingFollowupMedia(null);
      e.target.value = '';
    }
  };

  const handleDeleteFollowupFile = (id: string) => {
    setFupConfig((prev) => ({
      ...prev,
      followupFiles: (prev.followupFiles || []).filter((f) => f.id !== id),
    }));
  };

  useEffect(() => {
    fetch(`/api/whatsapp/accounts?t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.accounts)) {
          setAccounts(data.accounts);
          if (initialData?.accountId && initialData.accountId !== 'all') {
            setAccountId(initialData.accountId);
          }
        }
      })
      .catch((err) => console.error('Failed to load accounts in form:', err));
  }, [initialData?.accountId]);

  const toggleVariantOpen = (id: string) => {
    setOpenVariantIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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

  const handleDeleteVariant = (id: string) => {
    if (variants.length <= 1) {
      setError('At least one variation must remain in the campaign.');
      return;
    }
    setVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const handleVariantFileUpload = async (
    variantId: string,
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'image' | 'video' | 'audio' | 'document'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingVariant({ variantId, type });
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const res = await fetch('/api/whatsapp/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      if (type === 'image') updateVariantField(variantId, 'imageUrl', data.url);
      if (type === 'video') updateVariantField(variantId, 'videoUrl', data.url);
      if (type === 'audio') updateVariantField(variantId, 'audioUrl', data.url);
      if (type === 'document') {
        updateVariantField(variantId, 'documentUrl', data.url);
        updateVariantField(variantId, 'documentName', data.filename || file.name);
      }
    } catch (err: any) {
      console.error(`Upload error for ${type}:`, err);
      setError(`Failed to upload ${type}: ${err.message}`);
    } finally {
      setUploadingVariant(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a campaign name');
      return;
    }

    if (variants.length === 0) {
      setError('Please provide at least one message variation');
      return;
    }

    setSaving(true);
    setError(null);

    // Primary active variant for backwards compatibility in top-level table columns
    const primary = variants.find((v) => v.isActive) || variants[0];

    const payload = {
      name: name.trim(),
      description,
      accountId,
      keywords,
      isDefault,
      welcomeMessage: primary?.welcomeMessage || '',
      imageUrl: primary?.imageUrl || '',
      audioUrl: primary?.audioUrl || '',
      videoUrl: primary?.videoUrl || '',
      documentUrl: primary?.documentUrl || '',
      documentName: primary?.documentName || '',
      variants,
      followupConfig: fupConfig,
      sendOrder,
      delayBetweenSends: Number(delayBetweenSends) || 3,
      isActive,
      chatReplyEnabled,
    };

    try {
      const url = isEditing && initialData?.id
        ? `/api/whatsapp/campaigns/${initialData.id}`
        : '/api/whatsapp/campaigns';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to save campaign');
      }


      if (returnTo) {
        router.push(returnTo);
      } else if (accountId && accountId !== 'all') {
        router.push(`/whatsapp/numbers/${accountId}`);
      } else {
        router.push('/whatsapp');
      }
      router.refresh();
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full pb-16">
      {/* Header & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={returnTo || (accountId && accountId !== 'all' ? `/whatsapp/numbers/${accountId}` : '/whatsapp')}
          className="flex items-center text-sm text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          {returnTo || (accountId && accountId !== 'all') ? 'Back to Number' : 'Back to WhatsApp Dashboard'}
        </Link>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-900/30"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Campaign'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      {/* 2-Column Side-by-Side Layout: Campaign Box on Left, AI Follow-up System on Right */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: Campaign Information, Auto-Reply Variations & Delivery Controls */}
        <div className="space-y-6">
          {/* 1. General Info & Keywords */}
          <Card className="border-border/60 bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                Campaign Information
              </CardTitle>
            </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Campaign Name *</label>
              <Input
                placeholder="e.g. Gemini Pro Promotion"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-background/50 border-border/60"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Assigned WhatsApp Number</span>
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-background/50 border border-border/60 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">🌐 All Numbers (Active on all devices)</option>
                {accountId && accountId !== 'all' && !accounts.some((a) => a.id === accountId) && (
                  <option value={accountId}>📱 Current Number ({accountId})</option>
                )}
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    📱 {acc.name} {acc.phoneNumber ? `(+${acc.phoneNumber.replace(/^\+/, '')})` : ''} - {acc.status === 'connected' ? 'Connected' : 'Disconnected'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Description (Optional)</label>
            <Input
              placeholder="Internal campaign description or product note"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background/50 border-border/60"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">
              Keywords (Comma-separated)
            </label>
            <Input
              placeholder="e.g. gemini, course, start, info"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="bg-background/50 border-border/60"
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Message Variations Section (A/B Switching & Rotation) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              Auto-Reply Message Variations
            </h3>
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
                {/* Variation Header (Click triangle arrow to toggle accordion) */}
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

                    {/* Variation Name Input / Display */}
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
                      <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                        {variant.isActive ? 'ON' : 'OFF'}
                      </span>
                      <Switch
                        checked={variant.isActive}
                        onCheckedChange={(checked) => toggleVariantActive(variant.id, checked)}
                        className="data-[state=checked]:bg-emerald-600"
                      />
                    </div>

                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteVariant(variant.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title="Delete this variation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Content */}
                {isOpen && (
                  <CardContent className="p-5 space-y-5 animate-in fade-in-50 duration-200">
                    {/* Text Message Field */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <span>Text Message Content</span>
                        </label>
                        <span className="text-[11px] text-muted-foreground">
                          {variant.welcomeMessage ? `${variant.welcomeMessage.length} characters` : 'Optional'}
                        </span>
                      </div>
                      <Textarea
                        rows={4}
                        placeholder="Write message to send automatically (e.g. Course details, price, greetings)..."
                        value={variant.welcomeMessage}
                        onChange={(e) => updateVariantField(variant.id, 'welcomeMessage', e.target.value)}
                        className="bg-background/50 border-border/60 font-mono text-xs leading-relaxed"
                      />
                    </div>

                    {/* Media Files Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {/* 1. Image */}
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
                                className="text-muted-foreground hover:text-destructive text-xs"
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

                        {/* 2. Audio Note */}
                        <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/60 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                              <Music className="w-4 h-4 text-purple-400" />
                              Voice Note / Audio (MP3/OGG)
                            </span>
                            {variant.audioUrl && (
                              <button
                                type="button"
                                onClick={() => updateVariantField(variant.id, 'audioUrl', '')}
                                className="text-muted-foreground hover:text-destructive text-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {variant.audioUrl ? (
                            <div className="space-y-2">
                              <audio controls src={variant.audioUrl} className="w-full h-8" />
                              <p className="text-[10px] text-emerald-400 truncate">
                                {variant.audioUrl.startsWith('data:') ? '✓ Audio file attached' : variant.audioUrl}
                              </p>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center p-3 border border-dashed border-border/80 rounded-xl cursor-pointer hover:bg-secondary/40 transition-colors">
                              <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                              <span className="text-xs text-muted-foreground">Upload Voice Note (MP3, WAV, OGG)</span>
                              <input
                                type="file"
                                accept="audio/*,.mp3,.ogg,.wav,.m4a,.aac,.opus"
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

                        {/* 3. Video */}
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
                                className="text-muted-foreground hover:text-destructive text-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {variant.videoUrl ? (
                            <div className="space-y-2">
                              <video controls src={variant.videoUrl} className="w-full max-h-32 rounded-lg bg-black" />
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
                          {isUploading && uploadingVariant?.type === 'video' && (
                            <p className="text-xs text-blue-400 animate-pulse">Uploading video...</p>
                          )}
                        </div>

                        {/* 4. Document */}
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
                                className="text-muted-foreground hover:text-destructive text-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {variant.documentUrl ? (
                            <div className="space-y-1">
                              <div className="p-2 rounded-lg bg-secondary/70 border border-border flex items-center gap-2">
                                <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                                <span className="text-xs font-medium text-foreground truncate">
                                  {variant.documentName || 'Document'}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground truncate">{variant.documentUrl}</p>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center p-3 border border-dashed border-border/80 rounded-xl cursor-pointer hover:bg-secondary/40 transition-colors">
                              <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                              <span className="text-xs text-muted-foreground">Upload Document (PDF/DOCX)</span>
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                                className="hidden"
                                onChange={(e) => handleVariantFileUpload(variant.id, e, 'document')}
                                disabled={isUploading && uploadingVariant?.type === 'document'}
                              />
                            </label>
                          )}
                          {isUploading && uploadingVariant?.type === 'document' && (
                            <p className="text-xs text-blue-400 animate-pulse">Uploading document...</p>
                          )}
                        </div>
                      </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Add Variation Button */}
        <Button
          type="button"
          onClick={handleAddVariant}
          variant="outline"
          className="w-full border-dashed border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 py-5 flex items-center justify-center gap-2 font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>Add Another Variation (A/B Switching & Rotation)</span>
        </Button>
      </div>

      {/* 3. Delivery Controls */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            Delivery Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Send Order (Comma-separated)</label>
            <Input
              value={sendOrder}
              onChange={(e) => setSendOrder(e.target.value)}
              placeholder="message,image,audio,video,document"
              className="bg-background/50 border-border/60"
            />
          </div>

          <div className="pt-2 border-t border-border/40">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/30 border border-border/50">
              <div>
                <p className="text-sm font-medium text-white">Campaign Active</p>
                <p className="text-xs text-muted-foreground">Turn on/off auto-sending for this product</p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
          </div>
        </CardContent>
      </Card>


        </div>
        {/* END OF LEFT COLUMN */}

        {/* RIGHT COLUMN: AI Automation & Follow-up Box (Attached Side-by-Side) */}
        <div className="space-y-6">
          <Card className="border-border/60 bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-white">
                      AI Automation & Smart Follow-up
                    </CardTitle>
                    <p className="text-[11px] text-emerald-400/90 font-medium">
                      AI শুধু সময়মতো প্ল্যান মতো মেসেজ পাঠাবে • কাস্টমারের মেসেজের উত্তর দিবে না
                    </p>
                  </div>
                </div>

                {/* Master Follow-up Toggle */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      fupConfig.followupEnabled
                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                        : "bg-secondary text-muted-foreground border-border/50"
                    )}
                  >
                    {fupConfig.followupEnabled ? 'ACTIVE' : 'OFF'}
                  </Badge>
                  <Switch
                    checked={fupConfig.followupEnabled}
                    onCheckedChange={(checked) => updateFup('followupEnabled', checked)}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-4">
              {/* 1. API Configuration & AI Engine (Telegram-Style Integration) */}
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Key className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-white">Google AI Studio (Gemini) API Key</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 font-medium">
                      ⚡ Auto-Switching Models Active
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-background/60 p-0.5 rounded-lg border border-border/60 text-xs">
                      <button
                        type="button"
                        onClick={() => setKeyMode('existing')}
                        className={cn(
                          "px-2.5 py-1 rounded-md transition-all font-medium text-xs",
                          keyMode === 'existing'
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-muted-foreground hover:text-white"
                        )}
                      >
                        Saved Key
                      </button>
                      <button
                        type="button"
                        onClick={() => setKeyMode('new')}
                        className={cn(
                          "px-2.5 py-1 rounded-md transition-all font-medium text-xs flex items-center gap-1",
                          keyMode === 'new'
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-muted-foreground hover:text-white"
                        )}
                      >
                        <Plus className="w-3 h-3" /> Add Key
                      </button>
                    </div>

                    <Switch
                      checked={fupConfig.aiEnabled}
                      onCheckedChange={(checked) => updateFup('aiEnabled', checked)}
                      className="data-[state=checked]:bg-emerald-600"
                    />
                  </div>
                </div>

                {keyMode === 'existing' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Select Saved Gmail Account:</label>
                    <select
                      value={fupConfig.aiApiKey || ''}
                      onChange={(e) => updateFup('aiApiKey', e.target.value)}
                      className="w-full h-10 px-3 rounded-md bg-background/50 border border-border/60 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">⚙️ System Default Active Key</option>
                      {apiKeys.map((k) => (
                        <option key={k.id} value={k.id}>
                          📧 {k.gmail} {k.label ? `(${k.label})` : ''} - {k.status || 'Active'}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2.5 p-3 rounded-lg bg-background/40 border border-border/60">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Gemini API Key (AI Studio)</label>
                      <Input
                        type="text"
                        placeholder="AIzaSy..."
                        value={newApiKeyInput}
                        onChange={(e) => setNewApiKeyInput(e.target.value)}
                        className="bg-background/60 border-border/60 font-mono text-xs h-9"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          <span>Gmail Account</span>
                        </label>
                        <Input
                          type="email"
                          placeholder="yourname@gmail.com"
                          value={newApiGmailInput}
                          onChange={(e) => setNewApiGmailInput(e.target.value)}
                          className="bg-background/60 border-border/60 text-xs h-9"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Account Label (Optional)</label>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            placeholder="e.g. Work Account"
                            value={newApiLabelInput}
                            onChange={(e) => setNewApiLabelInput(e.target.value)}
                            className="bg-background/60 border-border/60 text-xs h-9"
                          />
                          <Button
                            type="button"
                            onClick={handleSaveNewApiKey}
                            disabled={savingKey || !newApiKeyInput.trim() || !newApiGmailInput.trim()}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9 px-3 shrink-0"
                          >
                            {savingKey ? 'Saving...' : 'Save Key'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Prompt / Instruction */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">
                      AI Follow-up Writing Instruction (মেসেজ গুছিয়ে লেখার নির্দেশনা)
                    </label>
                    <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      🛡️ নো-চ্যাটবট: AI কোনো রিপ্লাই দিবে না
                    </span>
                  </div>
                  <Textarea
                    value={fupConfig.aiSystemPrompt || ''}
                    onChange={(e) => updateFup('aiSystemPrompt', e.target.value)}
                    placeholder="প্রোডাক্ট তথ্যের আলোকে ফলো-আপ মেসেজটি সুন্দর, মার্জিত ও ফ্রেন্ডলি ভাষায় গুছিয়ে লেখার নির্দেশনা দাও..."
                    rows={2}
                    className="bg-background/50 border-border/60 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    * AI কাস্টমারের কোনো মেসেজের রিপ্লাই দিবে না — শুধু প্ল্যান অনুযায়ী সময়মতো সুন্দরভাবে টেক্সট গুছিয়ে পাঠাবে।
                  </p>
                </div>
              </div>

              {/* 2. Understanding Files Upload (AI Knowledge Base) */}
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-white">Product Understanding Files (AI Knowledge)</h4>
                  </div>
                  <span className="text-[11px] text-muted-foreground">PDF, DOCX, XLSX, TXT</span>
                </div>

                {/* Upload Button */}
                <label className={cn(
                  "w-full border border-dashed border-emerald-500/40 rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer transition-colors",
                  isUploadingDoc ? "bg-emerald-500/10 opacity-70" : "hover:bg-emerald-500/5 hover:border-emerald-500/60"
                )}>
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">
                    {isUploadingDoc ? 'Uploading & parsing document...' : '+ Upload Understanding File (Knowledge Base)'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md"
                    className="hidden"
                    onChange={handleUnderstandingFileUpload}
                    disabled={isUploadingDoc}
                  />
                </label>

                {/* Uploaded Understanding Files List */}
                {fupConfig.understandingFiles && fupConfig.understandingFiles.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {fupConfig.understandingFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/50 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="truncate">
                            <p className="font-medium text-white truncate">{file.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Document'} • AI Ready
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteUnderstandingFile(file.id)}
                          className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors shrink-0"
                          title="Remove file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Optional Custom Context / Notes */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-medium text-foreground">
                    Product Notes & Specific Rules (Optional)
                  </label>
                  <Textarea
                    value={fupConfig.understandingText || ''}
                    onChange={(e) => updateFup('understandingText', e.target.value)}
                    placeholder="পণ্য সম্পর্কিত বিশেষ শর্ত, ডেলিভারি চার্জ বা মূল্য তালিকা..."
                    rows={2}
                    className="bg-background/50 border-border/60 text-xs"
                  />
                </div>
              </div>

              {/* Given Follow-up File Upload & Message */}
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-white">Given Follow-up Message & Files</h4>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Follow-up Template & Media</span>
                </div>

                {/* Follow-up Message */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">Follow-up Message Text</label>
                    <div className="flex items-center gap-1">
                      {['{name}', '{product}', '{time}'].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => updateFup('followupMessage', (fupConfig.followupMessage || '') + ` ${chip} `)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-secondary/60 hover:bg-emerald-500/20 text-emerald-400 transition-colors font-mono"
                          title={`Insert ${chip}`}
                        >
                          +{chip}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Textarea
                    value={fupConfig.followupMessage || ''}
                    onChange={(e) => updateFup('followupMessage', e.target.value)}
                    placeholder="ফলো-আপ মেসেজ লিখুন..."
                    rows={3}
                    className="bg-background/50 border-border/60 text-xs"
                  />
                </div>

                {/* Multiple Follow-up Media Files Upload System */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">
                      Follow-up Media Files (ইমেজ, অডিও, ভিডিও, ডকুমেন্ট)
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      প্ল্যান অনুযায়ী অটোমেটিক পাঠানো হবে
                    </span>
                  </div>

                  {/* 4 Action Buttons to Upload Any Media */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Image Upload */}
                    <label className="p-2.5 rounded-lg border border-dashed border-border/60 hover:border-emerald-500/60 bg-background/40 hover:bg-emerald-500/5 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors text-center">
                      <ImageIcon className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-medium">+ Add Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFollowupMediaUpload(e, 'image')}
                        disabled={Boolean(isUploadingFollowupMedia)}
                      />
                    </label>

                    {/* Audio Upload */}
                    <label className="p-2.5 rounded-lg border border-dashed border-border/60 hover:border-emerald-500/60 bg-background/40 hover:bg-emerald-500/5 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors text-center">
                      <Music className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-medium">+ Add Voice/Audio</span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => handleFollowupMediaUpload(e, 'audio')}
                        disabled={Boolean(isUploadingFollowupMedia)}
                      />
                    </label>

                    {/* Video Upload */}
                    <label className="p-2.5 rounded-lg border border-dashed border-border/60 hover:border-emerald-500/60 bg-background/40 hover:bg-emerald-500/5 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors text-center">
                      <Video className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-medium">+ Add Video</span>
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => handleFollowupMediaUpload(e, 'video')}
                        disabled={Boolean(isUploadingFollowupMedia)}
                      />
                    </label>

                    {/* Document Upload */}
                    <label className="p-2.5 rounded-lg border border-dashed border-border/60 hover:border-emerald-500/60 bg-background/40 hover:bg-emerald-500/5 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors text-center">
                      <FileCheck className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-medium">+ Add Document</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={(e) => handleFollowupMediaUpload(e, 'document')}
                        disabled={Boolean(isUploadingFollowupMedia)}
                      />
                    </label>
                  </div>

                  {isUploadingFollowupMedia && (
                    <p className="text-xs text-blue-400 animate-pulse pt-1">
                      Uploading {isUploadingFollowupMedia}...
                    </p>
                  )}

                  {/* List of Multiple Uploaded Follow-up Files */}
                  {fupConfig.followupFiles && fupConfig.followupFiles.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {fupConfig.followupFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/50 text-xs gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {file.type === 'image' && (
                              <div className="w-10 h-10 rounded border border-border overflow-hidden bg-black/40 shrink-0">
                                <img src={file.url} alt="Follow-up preview" className="w-full h-full object-cover" />
                              </div>
                            )}
                            {file.type === 'audio' && (
                              <div className="shrink-0 flex items-center gap-2">
                                <Music className="w-4 h-4 text-purple-400" />
                                <audio src={file.url} controls className="h-7 w-44" />
                              </div>
                            )}
                            {file.type === 'video' && (
                              <div className="w-12 h-10 rounded border border-border overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
                                <Video className="w-5 h-5 text-rose-400" />
                              </div>
                            )}
                            {file.type === 'document' && (
                              <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-amber-400" />
                              </div>
                            )}

                            <div className="truncate flex-1">
                              <p className="font-medium text-white truncate">{file.name}</p>
                              <p className="text-[10px] text-muted-foreground uppercase">
                                {file.type} • {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Ready to Send'}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteFollowupFile(file.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors shrink-0"
                            title="Remove file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Fallback for legacy single files if no followupFiles array */}
                  {(!fupConfig.followupFiles || fupConfig.followupFiles.length === 0) && (
                    <div className="space-y-2">
                      {fupConfig.followupImageUrl && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-background/60 border border-border/50 text-xs">
                          <div className="flex items-center gap-2 text-white">
                            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Follow-up Image Attached</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateFup('followupImageUrl', '')}
                            className="text-xs text-destructive hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                      {fupConfig.followupAudioUrl && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-background/60 border border-border/50 text-xs">
                          <div className="flex items-center gap-2 text-white">
                            <Music className="w-3.5 h-3.5 text-purple-400" />
                            <span>Follow-up Audio Attached</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateFup('followupAudioUrl', '')}
                            className="text-xs text-destructive hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* END OF RIGHT COLUMN */}
      </div>
      {/* END OF 2-COLUMN GRID */}

      {/* Submit Action */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 pt-4 border-t border-border/40">
        <Link href="/whatsapp" className="w-full sm:w-auto">
          <Button variant="ghost" type="button" className="w-full sm:w-auto text-muted-foreground h-11 text-xs sm:text-sm">
            Cancel
          </Button>
        </Link>
        <Button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 h-11 text-xs sm:text-sm shadow-md shadow-emerald-900/30"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Campaign'}
        </Button>
      </div>
    </form>
  );
}

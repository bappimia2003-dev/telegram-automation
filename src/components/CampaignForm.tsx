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
  CheckCircle
} from 'lucide-react';
import { WaCampaign, WaCampaignVariant } from '@/lib/whatsappTypes';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface CampaignFormProps {
  initialData?: Partial<WaCampaign>;
  isEditing?: boolean;
}

export function CampaignForm({ initialData, isEditing }: CampaignFormProps) {
  const router = useRouter();

  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [accountId, setAccountId] = useState(initialData?.accountId || 'all');
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; phoneNumber?: string; status: string }>>([]);
  const [keywords, setKeywords] = useState(initialData?.keywords || '');
  const [isDefault, setIsDefault] = useState(initialData?.isDefault ?? false);

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

  useEffect(() => {
    fetch(`/api/whatsapp/accounts?t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.accounts)) {
          setAccounts(data.accounts);
        }
      })
      .catch((err) => console.error('Failed to load accounts in form:', err));
  }, []);

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

      router.push('/whatsapp');
      router.refresh();
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/whatsapp"
          className="flex items-center text-sm text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to WhatsApp Dashboard
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

      {/* 1. General Info & Keywords */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            Campaign Information
          </CardTitle>
          <CardDescription className="text-xs">
            Set campaign name, assigned phone number, and trigger keywords.
          </CardDescription>
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
                <option value="all">🌐 All Numbers</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    📱 {acc.name} {acc.phoneNumber ? `(${acc.phoneNumber})` : ''} - {acc.status === 'connected' ? 'Connected' : 'Disconnected'}
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
            <p className="text-[11px] text-muted-foreground">
              When an incoming message exactly matches one of these words, auto-reply triggers automatically.
            </p>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/30 border border-border/50">
            <div>
              <p className="text-sm font-medium text-white">Default Fallback Campaign</p>
              <p className="text-xs text-muted-foreground">
                Trigger if incoming message doesn't match any specific keywords
              </p>
            </div>
            <Switch
              checked={isDefault}
              onCheckedChange={setIsDefault}
              className="data-[state=checked]:bg-emerald-600"
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
            <p className="text-xs text-muted-foreground">
              Add multiple variations (text, image, audio, video, document). Active variations automatically rotate/switch between different customers!
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
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-purple-400" />
                        <span>Attached Media Files for this Variation</span>
                      </label>

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
          <CardDescription className="text-xs">
            Send order, randomized human delays, and campaign status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Send Order (Comma-separated)</label>
              <Input
                value={sendOrder}
                onChange={(e) => setSendOrder(e.target.value)}
                placeholder="message,image,audio,video,document"
                className="bg-background/50 border-border/60"
              />
              <p className="text-[11px] text-muted-foreground">
                Options: <code>message</code>, <code>image</code>, <code>audio</code>, <code>video</code>, <code>document</code>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Delay Between Files (Seconds)</label>
              <Input
                type="number"
                min={0}
                max={60}
                value={delayBetweenSends}
                onChange={(e) => setDelayBetweenSends(Number(e.target.value))}
                className="bg-background/50 border-border/60"
              />
              <p className="text-[11px] text-emerald-400/90">
                ⚡ 1st message: 2-3s random ms after read | 2nd & subsequent items: 1-2s non-identical random ms.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-border/40 grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/30 border border-border/50">
              <div>
                <p className="text-sm font-medium text-white">Chat Reply (Default: OFF)</p>
                <p className="text-xs text-muted-foreground">Keep OFF for purely auto file sending mode</p>
              </div>
              <Switch
                checked={chatReplyEnabled}
                onCheckedChange={setChatReplyEnabled}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit Action */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link href="/whatsapp">
          <Button variant="ghost" type="button" className="text-muted-foreground">
            Cancel
          </Button>
        </Link>
        <Button
          type="submit"
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 shadow-md shadow-emerald-900/30"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Campaign'}
        </Button>
      </div>
    </form>
  );
}

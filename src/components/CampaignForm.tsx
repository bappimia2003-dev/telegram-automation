"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
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
  CheckCircle,
  HelpCircle,
  Clock,
  Layers,
  Phone
} from 'lucide-react';
import { WaCampaign } from '@/lib/whatsappTypes';
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

  useEffect(() => {
    fetch('/api/whatsapp/accounts')
      .then(res => res.json())
      .then(data => {
        if (data.ok && Array.isArray(data.accounts)) {
          setAccounts(data.accounts);
        }
      })
      .catch(err => console.error('Failed to load accounts in form:', err));
  }, []);

  const [welcomeMessage, setWelcomeMessage] = useState(initialData?.welcomeMessage || '');
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
  const [audioUrl, setAudioUrl] = useState(initialData?.audioUrl || '');
  const [videoUrl, setVideoUrl] = useState(initialData?.videoUrl || '');
  const [documentUrl, setDocumentUrl] = useState(initialData?.documentUrl || '');
  const [documentName, setDocumentName] = useState(initialData?.documentName || '');

  const [sendOrder, setSendOrder] = useState(initialData?.sendOrder || 'message,image,audio,video,document');
  const [delayBetweenSends, setDelayBetweenSends] = useState(initialData?.delayBetweenSends ?? 3);

  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [chatReplyEnabled, setChatReplyEnabled] = useState(initialData?.chatReplyEnabled ?? false);

  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'audio' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(type);
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

      if (type === 'image') setImageUrl(data.url);
      if (type === 'video') setVideoUrl(data.url);
      if (type === 'audio') setAudioUrl(data.url);
      if (type === 'document') {
        setDocumentUrl(data.url);
        setDocumentName(data.filename || file.name);
      }
    } catch (err: any) {
      console.error(`Upload error for ${type}:`, err);
      setError(`Failed to upload ${type}: ${err.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a campaign name');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name,
      description,
      accountId,
      keywords,
      isDefault,
      welcomeMessage,
      imageUrl,
      audioUrl,
      videoUrl,
      documentUrl,
      documentName,
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
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header & Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/whatsapp" className="flex items-center text-sm text-muted-foreground hover:text-white transition-colors">
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
            {saving ? 'Saving...' : isEditing ? 'Update Campaign' : 'Create Campaign'}
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
            Product name and Facebook Ads quick reply keyword matching.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Campaign Name *</label>
              <Input
                placeholder="e.g. Gemini Pro Package"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-background/50 border-border/60"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Assigned WhatsApp Number (কোন সিমে চলবে?)</span>
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-background/50 border border-border/60 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">🌐 All Numbers (যেকোনো কানেক্টেড নাম্বার)</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    📱 {acc.name} {acc.phoneNumber ? `(${acc.phoneNumber})` : ''} - {acc.status === 'connected' ? '🟢 Connected' : '⚪ Disconnected'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Description (Optional)</label>
            <Input
              placeholder="e.g. 18 months subscription promo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background/50 border-border/60"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <span>Ad Trigger Keywords (Comma-separated)</span>
                <span className="text-[11px] text-emerald-400 font-normal">Matching with customer's message</span>
              </label>
            </div>
            <Input
              placeholder="e.g. gemini pro, gemini, pro, কিভাবে gemini pro নেব"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="bg-background/50 border-border/60"
            />
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              Customer যখন Facebook Ad-এর quick reply বোতাম চাপ দিয়ে মেসেজ দিবে, এই কীওয়ার্ডগুলোর যেকোনো একটি মিললে এই ক্যাম্পেইনের ফাইলগুলো অটো চলে যাবে।
            </p>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/30 border border-border/50">
            <div>
              <p className="text-sm font-medium text-white">Default Fallback Campaign</p>
              <p className="text-xs text-muted-foreground">
                কোনো কীওয়ার্ড না মিললে (বা কাস্টমার হাই/হ্যালো লিখলে) কি এই ক্যাম্পেইনের ফাইলগুলো যাবে?
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

      {/* 2. Text Message Content */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Text Message Content
          </CardTitle>
          <CardDescription className="text-xs">
            Product pricing, package description and payment instructions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            rows={8}
            placeholder={`🔥 মাত্র ৩৫০ টাকায় Premium AI Package!

১৮ মাসের সাবস্ক্রিপশনে পাচ্ছেন—
✅ Gemini Pro — AI Chat + Image
🎬 Google Flow & Google Vids
💻 Antigravity Pro
✨ Google AI Studio
☁️ 5000 GB Cloud Storage

বিকাশ / নগদ / রকেটে Send Money করে পেমেন্টের Screenshot পাঠান:`}
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            className="bg-background/50 border-border/60 font-mono text-xs leading-relaxed"
          />
        </CardContent>
      </Card>

      {/* 3. Media Files Upload */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            Auto-Send Media Files
          </CardTitle>
          <CardDescription className="text-xs">
            Upload banner image, voice note, demo video, or PDF catalog.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Image */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                Product Image (Banner)
              </span>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="text-muted-foreground hover:text-destructive text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {imageUrl ? (
              <div className="space-y-2">
                <div className="relative rounded-lg overflow-hidden border border-border max-h-36 bg-black/40">
                  <img src={imageUrl} alt="Uploaded preview" className="w-full object-contain max-h-36" />
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{imageUrl}</p>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 border border-dashed border-border/80 rounded-xl cursor-pointer hover:bg-secondary/40 transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Upload Image (JPG/PNG)</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'image')}
                  disabled={uploading === 'image'}
                />
              </label>
            )}
            {uploading === 'image' && <p className="text-xs text-blue-400 animate-pulse">Uploading image...</p>}
          </div>

          {/* Audio */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Music className="w-4 h-4 text-purple-400" />
                Voice Note / Audio (MP3/OGG)
              </span>
              {audioUrl && (
                <button
                  type="button"
                  onClick={() => setAudioUrl('')}
                  className="text-muted-foreground hover:text-destructive text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {audioUrl ? (
              <div className="space-y-2">
                <audio controls src={audioUrl} className="w-full h-9" />
                <p className="text-[10px] text-muted-foreground truncate">{audioUrl}</p>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 border border-dashed border-border/80 rounded-xl cursor-pointer hover:bg-secondary/40 transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Upload Audio / Voice Note</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'audio')}
                  disabled={uploading === 'audio'}
                />
              </label>
            )}
            {uploading === 'audio' && <p className="text-xs text-blue-400 animate-pulse">Uploading audio...</p>}
          </div>

          {/* Video */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Video className="w-4 h-4 text-rose-400" />
                Demo Video (MP4)
              </span>
              {videoUrl && (
                <button
                  type="button"
                  onClick={() => setVideoUrl('')}
                  className="text-muted-foreground hover:text-destructive text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {videoUrl ? (
              <div className="space-y-2">
                <video controls src={videoUrl} className="w-full max-h-36 rounded-lg bg-black" />
                <p className="text-[10px] text-muted-foreground truncate">{videoUrl}</p>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 border border-dashed border-border/80 rounded-xl cursor-pointer hover:bg-secondary/40 transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Upload Video (MP4)</span>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'video')}
                  disabled={uploading === 'video'}
                />
              </label>
            )}
            {uploading === 'video' && <p className="text-xs text-blue-400 animate-pulse">Uploading video...</p>}
          </div>

          {/* Document */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-amber-400" />
                Document / Catalog (PDF)
              </span>
              {documentUrl && (
                <button
                  type="button"
                  onClick={() => { setDocumentUrl(''); setDocumentName(''); }}
                  className="text-muted-foreground hover:text-destructive text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {documentUrl ? (
              <div className="space-y-1">
                <div className="p-2.5 rounded-lg bg-secondary/70 border border-border flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium text-foreground truncate">{documentName || 'Document'}</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{documentUrl}</p>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 border border-dashed border-border/80 rounded-xl cursor-pointer hover:bg-secondary/40 transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Upload Document (PDF/DOCX)</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'document')}
                  disabled={uploading === 'document'}
                />
              </label>
            )}
            {uploading === 'document' && <p className="text-xs text-blue-400 animate-pulse">Uploading document...</p>}
          </div>
        </CardContent>
      </Card>

      {/* 4. Delivery Settings */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            Delivery Controls
          </CardTitle>
          <CardDescription className="text-xs">
            Send order, human-like delay intervals, and safety toggles.
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
              <p className="text-[11px] text-muted-foreground">
                Recommended: 2 - 4 seconds (prevents WhatsApp spam flag)
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

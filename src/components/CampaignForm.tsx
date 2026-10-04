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
import { WaCampaign, WaCampaignVariant, WaFollowupConfig, WaUnderstandingFile, WaFollowupMediaFile, WaFollowupStep } from '@/lib/whatsappTypes';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface CampaignFormProps {
  initialData?: Partial<WaCampaign>;
  isEditing?: boolean;
  returnTo?: string;
}

async function parseJsonSafely(res: Response, defaultAction = 'Action'): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (res.status === 413) {
      throw new Error('File or data is too large for serverless limit (max 4.5MB). Please upload a smaller media file or audio clip.');
    }
    if (!res.ok) {
      throw new Error(`Server returned error ${res.status}: ${res.statusText || defaultAction + ' failed'}`);
    }
    throw new Error(text.slice(0, 120) || defaultAction + ' failed');
  }
}

function ensureThreeSteps(steps?: WaFollowupStep[], legacy?: WaFollowupConfig): WaFollowupStep[] {
  const defaults: WaFollowupStep[] = [
    {
      stepNumber: 1,
      title: '১ম ফলো-আপ',
      delayText: '৩-৫ মিনিট পর (র্যান্ডম)',
      message: legacy?.followupMessage || 'আসসালামু আলাইকুম {name}! আমাদের প্যাকেজ বা অফারটি নিয়ে কোনো প্রশ্ন থাকলে নির্দ্বিধায় জানাতে পারেন। আমরা আপনাকে সহায়তার জন্য প্রস্তুত আছি!',
      imageUrl: legacy?.followupImageUrl || '',
      audioUrl: legacy?.followupAudioUrl || '',
      videoUrl: legacy?.followupVideoUrl || '',
      documentUrl: legacy?.followupDocumentUrl || '',
      documentName: legacy?.followupDocumentName || '',
      files: legacy?.followupFiles || [],
    },
    {
      stepNumber: 2,
      title: '২য় ফলো-আপ',
      delayText: '৩-৪ ঘণ্টা পর',
      message: '{name}, আশা করি ভালো আছেন! অফারটি কিন্তু সীমিত সময়ের জন্য চালু আছে। আপনার প্রয়োজন হলে এখনই জানিয়ে রাখতে পারেন।',
      imageUrl: '',
      audioUrl: '',
      videoUrl: '',
      documentUrl: '',
      documentName: '',
      files: [],
    },
    {
      stepNumber: 3,
      title: '৩য় ফলো-আপ',
      delayText: 'পরের দিন (২৪ ঘণ্টা পর)',
      message: 'শুভ সকাল {name}! আপনার কি এই প্যাকেজটির প্রয়োজন আছে? আপনার মতামত জানালে সুবিধা হতো। ধন্যবাদ!',
      imageUrl: '',
      audioUrl: '',
      videoUrl: '',
      documentUrl: '',
      documentName: '',
      files: [],
    },
  ];

  if (!steps || !Array.isArray(steps) || steps.length === 0) return defaults;

  return [1, 2, 3].map((num) => {
    const existing = steps.find((s) => s.stepNumber === num);
    if (existing) {
      return {
        ...defaults[num - 1],
        ...existing,
        files: existing.files || [],
      };
    }
    return defaults[num - 1];
  });
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
    let defaultFollowup = false;
    let defaultAi = false;
    if (typeof window !== 'undefined') {
      const savedFollowup = localStorage.getItem('wa_campaign_followup_enabled');
      if (savedFollowup !== null) defaultFollowup = savedFollowup === 'true';
      const savedAi = localStorage.getItem('wa_campaign_ai_enabled');
      if (savedAi !== null) defaultAi = savedAi === 'true';
    }
    const initialFup = initialData?.followupConfig;
    const initialSteps = ensureThreeSteps(initialFup?.steps, initialFup);
    return {
      aiEnabled: initialFup?.aiEnabled ?? defaultAi,
      aiApiKey: initialFup?.aiApiKey || '',
      aiModel: initialFup?.aiModel || 'gemini-flash-latest',
      aiSystemPrompt: initialFup?.aiSystemPrompt || 'প্রোডাক্ট নলেজ ও তথ্যের আলোকে ফলো-আপ মেসেজটি মিষ্টি, আকর্ষণীয় ও মার্জিত বাংলায় গুছিয়ে লিখে পাঠাবে। কোনো রোবোটিক ভাব রাখবে না।',
      understandingFiles: initialFup?.understandingFiles || [],
      understandingText: initialFup?.understandingText || '',
      followupEnabled: initialFup?.followupEnabled ?? defaultFollowup,
      followupDelayValue: initialFup?.followupDelayValue ?? 3,
      followupDelayUnit: initialFup?.followupDelayUnit || 'hours',
      followupCondition: initialFup?.followupCondition || 'no_reply',
      antiBanJitter: initialFup?.antiBanJitter ?? true,
      steps: initialSteps,
      followupMessage: initialSteps[0]?.message || '',
      followupFiles: initialSteps[0]?.files || [],
      followupImageUrl: initialSteps[0]?.imageUrl || '',
      followupVideoUrl: initialSteps[0]?.videoUrl || '',
      followupAudioUrl: initialSteps[0]?.audioUrl || '',
      followupDocumentUrl: initialSteps[0]?.documentUrl || '',
      followupDocumentName: initialSteps[0]?.documentName || '',
    };
  });

  useEffect(() => {
    if (initialData?.followupConfig) {
      setFupConfig((prev) => {
        const nextSteps = ensureThreeSteps(initialData.followupConfig?.steps, initialData.followupConfig);
        return {
          ...prev,
          ...initialData.followupConfig,
          steps: nextSteps,
        };
      });
    }
  }, [initialData?.followupConfig]);

  const [activeStepTab, setActiveStepTab] = useState<number>(1);
  const [isUploadingStepMedia, setIsUploadingStepMedia] = useState<{ stepNumber: number; type: string } | null>(null);

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
    setFupConfig((prev) => {
      const next = { ...prev, [field]: value };
      if (typeof window !== 'undefined') {
        if (field === 'followupEnabled') {
          localStorage.setItem('wa_campaign_followup_enabled', String(value));
        }
        if (field === 'aiEnabled') {
          localStorage.setItem('wa_campaign_ai_enabled', String(value));
        }
      }
      if (isEditing && initialData?.id && (field === 'followupEnabled' || field === 'aiEnabled')) {
        fetch(`/api/whatsapp/campaigns/${initialData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ followupConfig: next }),
        }).catch((err) => console.error('Failed auto-saving followup switch:', err));
      }
      return next;
    });
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
      const data = await parseJsonSafely(res, 'Save API key');
      if (!data || !res.ok) throw new Error(data?.error || 'Failed to save API key');

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

    if (file.size > 25 * 1024 * 1024) {
      setError(`File "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 25 MB.`);
      e.target.value = '';
      return;
    }

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

      const data = await parseJsonSafely(res, 'Document upload');
      if (!data || !data.ok) throw new Error(data?.error || 'Upload failed');

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

  const updateStepField = (stepNumber: number, field: keyof WaFollowupStep, value: any) => {
    setFupConfig((prev) => {
      const currentSteps = ensureThreeSteps(prev.steps, prev);
      const updatedSteps = currentSteps.map((step) =>
        step.stepNumber === stepNumber ? { ...step, [field]: value } : step
      );
      return {
        ...prev,
        steps: updatedSteps,
        ...(stepNumber === 1 && field === 'message' ? { followupMessage: value } : {}),
        ...(stepNumber === 1 && field === 'imageUrl' ? { followupImageUrl: value } : {}),
        ...(stepNumber === 1 && field === 'audioUrl' ? { followupAudioUrl: value } : {}),
        ...(stepNumber === 1 && field === 'videoUrl' ? { followupVideoUrl: value } : {}),
        ...(stepNumber === 1 && field === 'documentUrl' ? { followupDocumentUrl: value } : {}),
        ...(stepNumber === 1 && field === 'documentName' ? { followupDocumentName: value } : {}),
        ...(stepNumber === 1 && field === 'files' ? { followupFiles: value } : {}),
      };
    });
  };

  const handleStepMediaUpload = async (
    stepNumber: number,
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'image' | 'video' | 'audio' | 'document'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setError(`Media file "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 25 MB.`);
      e.target.value = '';
      return;
    }

    setIsUploadingStepMedia({ stepNumber, type });
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const res = await fetch('/api/whatsapp/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await parseJsonSafely(res, `Step ${stepNumber} ${type} upload`);
      if (!data || !data.ok) throw new Error(data?.error || 'Upload failed');

      const newMediaFile: WaFollowupMediaFile = {
        id: `fup_step${stepNumber}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: data.filename || file.name,
        url: data.url,
        type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };

      setFupConfig((prev) => {
        const currentSteps = ensureThreeSteps(prev.steps, prev);
        const updatedSteps = currentSteps.map((s) => {
          if (s.stepNumber !== stepNumber) return s;
          const prevFiles = s.files || [];
          return {
            ...s,
            files: [...prevFiles, newMediaFile],
            ...(type === 'image' ? { imageUrl: data.url } : {}),
            ...(type === 'video' ? { videoUrl: data.url } : {}),
            ...(type === 'audio' ? { audioUrl: data.url } : {}),
            ...(type === 'document' ? { documentUrl: data.url, documentName: data.filename || file.name } : {}),
          };
        });

        return {
          ...prev,
          steps: updatedSteps,
          ...(stepNumber === 1 ? {
            followupFiles: [...(prev.followupFiles || []), newMediaFile],
            ...(type === 'image' ? { followupImageUrl: data.url } : {}),
            ...(type === 'video' ? { followupVideoUrl: data.url } : {}),
            ...(type === 'audio' ? { followupAudioUrl: data.url } : {}),
            ...(type === 'document' ? { followupDocumentUrl: data.url, followupDocumentName: data.filename || file.name } : {}),
          } : {}),
        };
      });
    } catch (err: any) {
      setError(err.message || `Failed to upload step ${stepNumber} ${type}`);
    } finally {
      setIsUploadingStepMedia(null);
      e.target.value = '';
    }
  };

  const handleDeleteStepMediaFile = (stepNumber: number, fileId: string) => {
    setFupConfig((prev) => {
      const currentSteps = ensureThreeSteps(prev.steps, prev);
      const updatedSteps = currentSteps.map((s) => {
        if (s.stepNumber !== stepNumber) return s;
        const remainingFiles = (s.files || []).filter((f) => f.id !== fileId);
        const remainingImg = remainingFiles.find((f) => f.type === 'image')?.url || '';
        const remainingAud = remainingFiles.find((f) => f.type === 'audio')?.url || '';
        const remainingVid = remainingFiles.find((f) => f.type === 'video')?.url || '';
        const remainingDoc = remainingFiles.find((f) => f.type === 'document');

        return {
          ...s,
          files: remainingFiles,
          imageUrl: remainingImg,
          audioUrl: remainingAud,
          videoUrl: remainingVid,
          documentUrl: remainingDoc?.url || '',
          documentName: remainingDoc?.name || '',
        };
      });

      return {
        ...prev,
        steps: updatedSteps,
        ...(stepNumber === 1 ? {
          followupFiles: (prev.followupFiles || []).filter((f) => f.id !== fileId),
        } : {}),
      };
    });
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

    if (file.size > 25 * 1024 * 1024) {
      setError(`File "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 25 MB.`);
      e.target.value = '';
      return;
    }

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

      const data = await parseJsonSafely(res, `${type} upload`);
      if (!data || !data.ok) {
        throw new Error(data?.error || 'Upload failed');
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

      const data = await parseJsonSafely(res, 'Saving campaign');
      if (!data || !data.ok) {
        throw new Error(data?.error || 'Failed to save campaign');
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
          className="flex items-center text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          {returnTo || (accountId && accountId !== 'all') ? 'Back to Number' : 'Back to WhatsApp Dashboard'}
        </Link>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={saving}
            className="bg-green-700 hover:bg-green-600 text-white font-medium shadow-sm"
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
          <Card className="border-[#E6E2D8] dark:border-[#262930] bg-[#FBF9F4] dark:bg-[#181A1F] text-gray-900 dark:text-white">
            <CardHeader className="pb-3 border-b border-[#E6E2D8] dark:border-[#262930]">
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                Campaign Information
              </CardTitle>
            </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-900 dark:text-white">Campaign Name *</label>
              <Input
                placeholder="e.g. Gemini Pro Promotion"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-[#FAF8F5] dark:bg-[#121418] border-[#E6E2D8] dark:border-[#262930] text-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Assigned WhatsApp Number</span>
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-[#FAF8F5] dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#262930] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all" className="bg-[#FAF8F5] dark:bg-[#181A1F] text-gray-900 dark:text-white">🌐 All Numbers (Active on all devices)</option>
                {accountId && accountId !== 'all' && !accounts.some((a) => a.id === accountId) && (
                  <option value={accountId} className="bg-[#FAF8F5] dark:bg-[#181A1F] text-gray-900 dark:text-white">📱 Current Number ({accountId})</option>
                )}
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id} className="bg-[#FAF8F5] dark:bg-[#181A1F] text-gray-900 dark:text-white">
                    📱 {acc.name} {acc.phoneNumber ? `(+${acc.phoneNumber.replace(/^\+/, '')})` : ''} - {acc.status === 'connected' ? 'Connected' : 'Disconnected'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-900 dark:text-white">Description (Optional)</label>
            <Input
              placeholder="Internal campaign description or product note"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-[#FAF8F5] dark:bg-[#121418] border-[#E6E2D8] dark:border-[#262930] text-gray-900 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-900 dark:text-white">
              Keywords (Comma-separated)
            </label>
            <Input
              placeholder="e.g. gemini, course, start, info"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="bg-[#FAF8F5] dark:bg-[#121418] border-[#E6E2D8] dark:border-[#262930] text-gray-900 dark:text-white"
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Message Variations Section (A/B Switching & Rotation) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              Auto-Reply Message Variations
            </h3>
          </div>

          <Button
            type="button"
            onClick={handleAddVariant}
            variant="outline"
            size="sm"
            className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs flex items-center gap-1.5 self-start sm:self-auto"
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
                  "border transition-all duration-200 bg-[#FAF8F5] dark:bg-[#15171C] overflow-hidden",
                  variant.isActive ? "border-[#E6E2D8] dark:border-[#262930]" : "border-[#E6E2D8]/60 dark:border-[#262930]/60 opacity-75"
                )}
              >
                {/* Variation Header (Click triangle arrow to toggle accordion) */}
                <div className="p-4 bg-[#EDE8DE]/40 dark:bg-[#181A1F] border-b border-[#E6E2D8] dark:border-[#262930] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {/* Triangle Arrow Button */}
                    <button
                      type="button"
                      onClick={() => toggleVariantOpen(variant.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#EDE8DE] dark:bg-[#20242C] hover:bg-green-600/20 text-emerald-600 dark:text-emerald-400 transition-all shrink-0"
                      title={isOpen ? "Collapse variation" : "Expand variation"}
                    >
                      <Play
                        className={cn(
                          "w-3.5 h-3.5 fill-current transition-transform duration-200",
                          isOpen ? "rotate-90 text-emerald-600 dark:text-emerald-400" : "rotate-0 text-gray-500"
                        )}
                      />
                    </button>

                    {/* Variation Name Input / Display */}
                    <input
                      type="text"
                      value={variant.name}
                      onChange={(e) => updateVariantField(variant.id, 'name', e.target.value)}
                      className="bg-transparent font-semibold text-sm text-gray-900 dark:text-white hover:bg-[#EDE8DE]/40 dark:hover:bg-[#20242C] focus:bg-[#FAF8F5] dark:focus:bg-[#121418] px-2 py-1 rounded transition-colors border border-transparent focus:border-[#E6E2D8] dark:focus:border-[#262930] truncate max-w-[200px] sm:max-w-xs"
                      placeholder={`Variation ${index + 1}`}
                    />

                    {/* Active Status Badge */}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] hidden sm:flex items-center gap-1",
                        variant.isActive
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700"
                      )}
                    >
                      {variant.isActive ? 'Active in Rotation' : 'Disabled'}
                    </Badge>
                  </div>

                  {/* Header Actions: ON/OFF Toggle Switch & Delete */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-medium hidden sm:inline">
                        {variant.isActive ? 'ON' : 'OFF'}
                      </span>
                      <Switch
                        checked={variant.isActive}
                        onCheckedChange={(checked) => toggleVariantActive(variant.id, checked)}
                        className="data-[state=checked]:bg-green-700"
                      />
                    </div>

                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteVariant(variant.id)}
                        className="p-1.5 text-gray-500 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
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
                        <label className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <span>Text Message Content</span>
                        </label>
                        <span className="text-[11px] text-gray-500">
                          {variant.welcomeMessage ? `${variant.welcomeMessage.length} characters` : 'Optional'}
                        </span>
                      </div>
                      <Textarea
                        rows={4}
                        placeholder="Write message to send automatically (e.g. Course details, price, greetings)..."
                        value={variant.welcomeMessage}
                        onChange={(e) => updateVariantField(variant.id, 'welcomeMessage', e.target.value)}
                        className="bg-[#FAF8F5] dark:bg-[#121418] border-[#E6E2D8] dark:border-[#262930] text-gray-900 dark:text-white font-mono text-xs leading-relaxed"
                      />
                    </div>

                    {/* Media Files Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {/* 1. Image */}
                        <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#262930] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                              <ImageIcon className="w-4 h-4 text-emerald-600" />
                              Product Image (Banner)
                            </span>
                            {variant.imageUrl && (
                              <button
                                type="button"
                                onClick={() => updateVariantField(variant.id, 'imageUrl', '')}
                                className="text-gray-500 hover:text-destructive text-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {variant.imageUrl ? (
                            <div className="space-y-2">
                              <div className="relative rounded-lg overflow-hidden border border-[#E6E2D8] dark:border-[#262930] max-h-32 bg-black/40">
                                <img
                                  src={variant.imageUrl}
                                  alt="Uploaded preview"
                                  className="w-full object-contain max-h-32"
                                />
                              </div>
                              <p className="text-[10px] text-gray-500 truncate">{variant.imageUrl}</p>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center p-3 border border-dashed border-[#E6E2D8] dark:border-[#262930] rounded-xl cursor-pointer hover:bg-[#EDE8DE]/40 dark:hover:bg-[#181A1F] transition-colors">
                              <Upload className="w-5 h-5 text-gray-500 mb-1" />
                              <span className="text-xs text-gray-500">Upload Image (JPG/PNG)</span>
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
                        <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#262930] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                              <Music className="w-4 h-4 text-purple-400" />
                              Voice Note / Audio (MP3/OGG)
                            </span>
                            {variant.audioUrl && (
                              <button
                                type="button"
                                onClick={() => updateVariantField(variant.id, 'audioUrl', '')}
                                className="text-gray-500 hover:text-destructive text-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {variant.audioUrl ? (
                            <div className="space-y-2">
                              <audio controls src={variant.audioUrl} className="w-full h-8" />
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">
                                {variant.audioUrl.startsWith('data:') ? '✓ Audio file attached' : variant.audioUrl}
                              </p>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center p-3 border border-dashed border-[#E6E2D8] dark:border-[#262930] rounded-xl cursor-pointer hover:bg-[#EDE8DE]/40 dark:hover:bg-[#181A1F] transition-colors">
                              <Upload className="w-5 h-5 text-gray-500 mb-1" />
                              <span className="text-xs text-gray-500">Upload Voice Note (MP3, WAV, OGG)</span>
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
                        <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#262930] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                              <Video className="w-4 h-4 text-rose-400" />
                              Demo Video (MP4)
                            </span>
                            {variant.videoUrl && (
                              <button
                                type="button"
                                onClick={() => updateVariantField(variant.id, 'videoUrl', '')}
                                className="text-gray-500 hover:text-destructive text-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {variant.videoUrl ? (
                            <div className="space-y-2">
                              <video controls src={variant.videoUrl} className="w-full max-h-32 rounded-lg bg-black" />
                              <p className="text-[10px] text-gray-500 truncate">{variant.videoUrl}</p>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center p-3 border border-dashed border-[#E6E2D8] dark:border-[#262930] rounded-xl cursor-pointer hover:bg-[#EDE8DE]/40 dark:hover:bg-[#181A1F] transition-colors">
                              <Upload className="w-5 h-5 text-gray-500 mb-1" />
                              <span className="text-xs text-gray-500">Upload Video (MP4)</span>
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
                        <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#262930] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
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
                                className="text-gray-500 hover:text-destructive text-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {variant.documentUrl ? (
                            <div className="space-y-1">
                              <div className="p-2 rounded-lg bg-[#EDE8DE] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] flex items-center gap-2">
                                <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                                <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                  {variant.documentName || 'Document'}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-500 truncate">{variant.documentUrl}</p>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center p-3 border border-dashed border-[#E6E2D8] dark:border-[#262930] rounded-xl cursor-pointer hover:bg-[#EDE8DE]/40 dark:hover:bg-[#181A1F] transition-colors">
                              <Upload className="w-5 h-5 text-gray-500 mb-1" />
                              <span className="text-xs text-gray-500">Upload Document (PDF/DOCX)</span>
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
          className="w-full border-dashed border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 py-5 flex items-center justify-center gap-2 font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>Add Another Variation (A/B Switching & Rotation)</span>
        </Button>
      </div>

      {/* 3. Delivery Controls */}
      <Card className="border-[#E6E2D8] dark:border-[#262930] bg-[#FBF9F4] dark:bg-[#181A1F] text-gray-900 dark:text-white">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            Delivery Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-900 dark:text-white">Send Order (Comma-separated)</label>
            <Input
              value={sendOrder}
              onChange={(e) => setSendOrder(e.target.value)}
              placeholder="message,image,audio,video,document"
              className="bg-[#FAF8F5] dark:bg-[#121418] border-[#E6E2D8] dark:border-[#262930] text-gray-900 dark:text-white"
            />
          </div>

          <div className="pt-2 border-t border-[#E6E2D8] dark:border-[#262930]">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#262930]">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Campaign Active</p>
                <p className="text-xs text-gray-500">Turn on/off auto-sending for this product</p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                className="data-[state=checked]:bg-green-700"
              />
            </div>
          </div>
        </CardContent>
      </Card>


        </div>
        {/* END OF LEFT COLUMN */}

        {/* RIGHT COLUMN: AI Automation & Follow-up Box (Attached Side-by-Side) */}
        <div className="space-y-6">
          <Card className="border-[#E6E2D8] dark:border-[#262930] bg-[#FBF9F4] dark:bg-[#181A1F] text-gray-900 dark:text-white">
            <CardHeader className="pb-3 border-b border-[#E6E2D8] dark:border-[#262930]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                      AI Automation & Smart Follow-up
                    </CardTitle>
                  </div>
                </div>

                {/* Master Follow-up Toggle */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      fupConfig.followupEnabled
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700"
                    )}
                  >
                    {fupConfig.followupEnabled ? 'ACTIVE' : 'OFF'}
                  </Badge>
                  <Switch
                    checked={fupConfig.followupEnabled}
                    onCheckedChange={(checked) => updateFup('followupEnabled', checked)}
                    className="data-[state=checked]:bg-green-700"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-4">
              {/* 1. API Configuration & AI Engine (Telegram-Style Integration) */}
              <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#262930] space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Google AI Studio (Gemini) API Key</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-medium">
                      ⚡ Auto-Switching Models Active
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-[#EDE8DE] dark:bg-[#181A1F] p-0.5 rounded-lg border border-[#E6E2D8] dark:border-[#262930] text-xs">
                      <button
                        type="button"
                        onClick={() => setKeyMode('existing')}
                        className={cn(
                          "px-2.5 py-1 rounded-md transition-all font-medium text-xs",
                          keyMode === 'existing'
                            ? "bg-green-700 text-white shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
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
                            ? "bg-green-700 text-white shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        )}
                      >
                        <Plus className="w-3 h-3" /> Add Key
                      </button>
                    </div>

                    <Switch
                      checked={fupConfig.aiEnabled}
                      onCheckedChange={(checked) => updateFup('aiEnabled', checked)}
                      className="data-[state=checked]:bg-green-700"
                    />
                  </div>
                </div>

                {keyMode === 'existing' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-900 dark:text-white">Select Saved Gmail Account:</label>
                    <select
                      value={fupConfig.aiApiKey || ''}
                      onChange={(e) => updateFup('aiApiKey', e.target.value)}
                      className="w-full h-10 px-3 rounded-md bg-[#FAF8F5] dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#262930] text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="" className="bg-[#FAF8F5] dark:bg-[#181A1F] text-gray-900 dark:text-white">⚙️ System Default Active Key</option>
                      {apiKeys.map((k) => (
                        <option key={k.id} value={k.id} className="bg-[#FAF8F5] dark:bg-[#181A1F] text-gray-900 dark:text-white">
                          📧 {k.gmail} {k.label ? `(${k.label})` : ''} - {k.status || 'Active'}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2.5 p-3 rounded-lg bg-[#FAF8F5] dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#262930]">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-900 dark:text-white">Gemini API Key (AI Studio)</label>
                      <Input
                        type="text"
                        placeholder="AIzaSy..."
                        value={newApiKeyInput}
                        onChange={(e) => setNewApiKeyInput(e.target.value)}
                        className="bg-[#FAF8F5] dark:bg-[#181A1F] border-[#E6E2D8] dark:border-[#262930] text-gray-900 dark:text-white font-mono text-xs h-9"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-900 dark:text-white flex items-center gap-1">
                          <Mail className="w-3 h-3 text-gray-500" />
                          <span>Gmail Account</span>
                        </label>
                        <Input
                          type="email"
                          placeholder="yourname@gmail.com"
                          value={newApiGmailInput}
                          onChange={(e) => setNewApiGmailInput(e.target.value)}
                          className="bg-[#FAF8F5] dark:bg-[#181A1F] border-[#E6E2D8] dark:border-[#262930] text-gray-900 dark:text-white text-xs h-9"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-900 dark:text-white">Account Label (Optional)</label>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            placeholder="e.g. Work Account"
                            value={newApiLabelInput}
                            onChange={(e) => setNewApiLabelInput(e.target.value)}
                            className="bg-[#FAF8F5] dark:bg-[#181A1F] border-[#E6E2D8] dark:border-[#262930] text-gray-900 dark:text-white text-xs h-9"
                          />
                          <Button
                            type="button"
                            onClick={handleSaveNewApiKey}
                            disabled={savingKey || !newApiKeyInput.trim() || !newApiGmailInput.trim()}
                            className="bg-green-700 hover:bg-green-600 text-white text-xs h-9 px-3 shrink-0"
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
                    <label className="text-xs font-medium text-gray-900 dark:text-white">
                      AI Follow-up Writing Instruction (মেসেজ গুছিয়ে লেখার নির্দেশনা)
                    </label>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      🛡️ নো-চ্যাটবট: AI কোনো রিপ্লাই দিবে না
                    </span>
                  </div>
                  <Textarea
                    value={fupConfig.aiSystemPrompt || ''}
                    onChange={(e) => updateFup('aiSystemPrompt', e.target.value)}
                    placeholder="প্রোডাক্ট তথ্যের আলোকে ফলো-আপ মেসেজটি সুন্দর, মার্জিত ও ফ্রেন্ডলি ভাষায় গুছিয়ে লেখার নির্দেশনা দাও..."
                    rows={2}
                    className="bg-[#FAF8F5] dark:bg-[#181A1F] border-[#E6E2D8] dark:border-[#262930] text-gray-900 dark:text-white text-xs"
                  />
                  <p className="text-[11px] text-gray-500">
                    * AI কাস্টমারের কোনো মেসেজের রিপ্লাই দিবে না — শুধু প্ল্যান অনুযায়ী সময়মতো সুন্দরভাবে টেক্সট গুছিয়ে পাঠাবে।
                  </p>
                </div>
              </div>

              {/* 2. Understanding Files Upload (AI Knowledge Base) */}
              <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#262930] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Product Understanding Files (AI Knowledge)</h4>
                  </div>
                  <span className="text-[11px] text-gray-500">PDF, DOCX, XLSX, TXT</span>
                </div>

                {/* Upload Button */}
                <label className={cn(
                  "w-full border border-dashed border-emerald-500/40 rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer transition-colors",
                  isUploadingDoc ? "bg-emerald-500/10 opacity-70" : "hover:bg-green-600/5 hover:border-emerald-500/60"
                )}>
                  <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
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
                        className="flex items-center justify-between p-2.5 rounded-lg bg-[#EDE8DE] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div className="truncate">
                            <p className="font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                            <p className="text-[10px] text-gray-500">
                              {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Document'} • AI Ready
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteUnderstandingFile(file.id)}
                          className="p-1 text-gray-500 hover:text-destructive hover:bg-destructive/10 rounded transition-colors shrink-0"
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
                  <label className="text-xs font-medium text-gray-900 dark:text-white">
                    Product Notes & Specific Rules (Optional)
                  </label>
                  <Textarea
                    value={fupConfig.understandingText || ''}
                    onChange={(e) => updateFup('understandingText', e.target.value)}
                    placeholder="পণ্য সম্পর্কিত বিশেষ শর্ত, ডেলিভারি চার্জ বা মূল্য তালিকা..."
                    rows={2}
                    className="bg-[#FAF8F5] dark:bg-[#181A1F] border-[#E6E2D8] dark:border-[#262930] text-gray-900 dark:text-white text-xs"
                  />
                </div>
              </div>

              {/* 3-Step Follow-up System */}
              {(() => {
                const currentSteps = ensureThreeSteps(fupConfig.steps, fupConfig);
                const activeStep = currentSteps.find((s) => s.stepNumber === activeStepTab) || currentSteps[0];
                const hasText = Boolean(activeStep?.message && activeStep.message.trim());
                const hasImg = Boolean(activeStep?.imageUrl || activeStep?.files?.some((f) => f.type === 'image'));
                const hasAud = Boolean(activeStep?.audioUrl || activeStep?.files?.some((f) => f.type === 'audio'));
                const hasVid = Boolean(activeStep?.videoUrl || activeStep?.files?.some((f) => f.type === 'video'));
                const hasDoc = Boolean(activeStep?.documentUrl || activeStep?.files?.some((f) => f.type === 'document'));

                return (
                  <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#262930] space-y-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-[#E6E2D8] dark:border-[#262930]">
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                          ৩-ধাপের স্মার্ট ফলো-আপ (3-Step Follow-up System)
                        </h4>
                      </div>
                      <span className="text-[11px] text-gray-500 font-medium">
                        প্রতিটি ধাপ স্বাধীন • টেক্সট / ইমেজ / অডিও
                      </span>
                    </div>

                    {/* Step Tabs: Step 1 (3-5 min random), Step 2 (3-4h), Step 3 (Next Day) */}
                    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#EDE8DE] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930]">
                      {[
                        { num: 1, title: '১ম ফলো-আপ', delay: '৩-৫ মি. (র্যান্ডম)' },
                        { num: 2, title: '২য় ফলো-আপ', delay: '৩-৪ ঘণ্টা পর' },
                        { num: 3, title: '৩য় ফলো-আপ', delay: 'পরের দিন (২৪h)' },
                      ].map((tab) => {
                        const stepData = currentSteps.find((s) => s.stepNumber === tab.num);
                        const sHasText = Boolean(stepData?.message && stepData.message.trim());
                        const sHasImg = Boolean(stepData?.imageUrl || stepData?.files?.some((f) => f.type === 'image'));
                        const sHasAud = Boolean(stepData?.audioUrl || stepData?.files?.some((f) => f.type === 'audio'));
                        const sHasVid = Boolean(stepData?.videoUrl || stepData?.files?.some((f) => f.type === 'video'));
                        const sHasDoc = Boolean(stepData?.documentUrl || stepData?.files?.some((f) => f.type === 'document'));
                        const isCurrent = activeStepTab === tab.num;

                        return (
                          <button
                            key={tab.num}
                            type="button"
                            onClick={() => setActiveStepTab(tab.num)}
                            className={cn(
                              "flex flex-col items-center justify-center py-2 px-1.5 rounded-lg text-center transition-all",
                              isCurrent
                                ? "bg-[#FAF8F5] dark:bg-[#121418] text-green-800 dark:text-emerald-400 font-semibold shadow-sm border border-[#E6E2D8] dark:border-[#262930]"
                                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            )}
                          >
                            <span className="text-xs font-semibold leading-tight">{tab.title}</span>
                            <span className="text-[10px] text-gray-500 font-normal leading-tight mt-0.5">{tab.delay}</span>
                            <div className="flex items-center gap-1 mt-1 flex-wrap justify-center">
                              {sHasText && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">
                                  Text
                                </span>
                              )}
                              {sHasImg && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium">
                                  Img
                                </span>
                              )}
                              {sHasAud && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-medium">
                                  Aud
                                </span>
                              )}
                              {sHasVid && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-medium">
                                  Vid
                                </span>
                              )}
                              {sHasDoc && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-medium">
                                  Doc
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Quick Guidance Alert */}
                    <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">টিপস: </span>
                        আপনি চাইলে <strong>শুধু টেক্সট</strong> দিতে পারেন, অথবা <strong>শুধু ইমেজ</strong>, অথবা <strong>শুধু অডিও/ভয়েস নোট</strong> দিতে পারেন। কোনো কিছু বাধ্যতামূলক নয় — যা রাখবেন ঠিক সেটাই কাস্টমারকে পাঠানো হবে।
                      </div>
                    </div>

                    {/* Step Title & Delay Badge */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <h5 className="text-xs font-semibold text-gray-900 dark:text-white">
                          {activeStepTab === 1 && '১ম ফলো-আপ কনফিগারেশন (৩ থেকে ৫ মিনিট পর - র্যান্ডম)'}
                          {activeStepTab === 2 && '২য় ফলো-আপ কনফিগারেশন (৩ থেকে ৪ ঘণ্টা পর)'}
                          {activeStepTab === 3 && '৩য় ফলো-আপ কনফিগারেশন (পরের দিন - ২৪ ঘণ্টা পর)'}
                        </h5>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-[#EDE8DE] dark:bg-[#181A1F] text-gray-600 dark:text-gray-300 border-[#E6E2D8] dark:border-[#262930]">
                        Step {activeStepTab} of 3
                      </Badge>
                    </div>

                    {/* Step Message Text */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <label className="text-xs font-medium text-gray-900 dark:text-white">
                          ফলো-আপ মেসেজ টেক্সট (অপশনাল)
                        </label>
                        <div className="flex items-center gap-1">
                          {['{name}', '{product}', '{time}'].map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => {
                                const cur = activeStep?.message || '';
                                updateStepField(activeStepTab, 'message', cur ? `${cur} ${chip}` : chip);
                              }}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-[#EDE8DE] dark:bg-[#181A1F] hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors font-mono font-medium"
                              title={`Insert ${chip}`}
                            >
                              +{chip}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Textarea
                        value={activeStep?.message || ''}
                        onChange={(e) => updateStepField(activeStepTab, 'message', e.target.value)}
                        placeholder={
                          activeStepTab === 1
                            ? "যেমন: আসসালামু আলাইকুম {name}! আমাদের {product} সম্পর্কিত কোনো প্রশ্ন থাকলে জানাতে পারেন। (খালি রাখলে শুধু নিচের ইমেজ বা অডিও যাবে)"
                            : activeStepTab === 2
                            ? "যেমন: {name}, আশা করি ভালো আছেন! অফারটি কিন্তু সীমিত সময়ের জন্য চালু আছে। আপনার প্রয়োজন হলে এখনই জানিয়ে রাখতে পারেন।"
                            : "যেমন: শুভ সকাল {name}! আপনার কি এই প্যাকেজটির প্রয়োজন আছে? আপনার মতামত জানালে সুবিধা হতো।"
                        }
                        rows={3}
                        className="bg-[#FAF8F5] dark:bg-[#181A1F] border-[#E6E2D8] dark:border-[#262930] text-gray-900 dark:text-white text-xs"
                      />
                    </div>

                    {/* Step Media Upload Buttons */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-900 dark:text-white">
                          মিডিয়া ফাইল (ইমেজ, অডিও, ভিডিও, ডকুমেন্ট)
                        </label>
                        <span className="text-[10px] text-gray-500">
                          {activeStepTab === 1 ? '৩-৫ মিনিট পর যাবে' : activeStepTab === 2 ? '৩-৪ ঘণ্টা পর যাবে' : 'পরের দিন যাবে'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {/* Image Upload */}
                        <label className="p-2.5 rounded-lg border border-dashed border-[#E6E2D8] dark:border-[#262930] hover:border-emerald-500/60 bg-[#FAF8F5] dark:bg-[#181A1F] hover:bg-emerald-500/10 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors text-center">
                          <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs font-medium text-gray-900 dark:text-white">+ Add Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleStepMediaUpload(activeStepTab, e, 'image')}
                            disabled={Boolean(isUploadingStepMedia)}
                          />
                        </label>

                        {/* Audio Upload */}
                        <label className="p-2.5 rounded-lg border border-dashed border-[#E6E2D8] dark:border-[#262930] hover:border-emerald-500/60 bg-[#FAF8F5] dark:bg-[#181A1F] hover:bg-emerald-500/10 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors text-center">
                          <Music className="w-4 h-4 text-purple-400" />
                          <span className="text-xs font-medium text-gray-900 dark:text-white">+ Add Voice/Audio</span>
                          <input
                            type="file"
                            accept="audio/*,.mp3,.ogg,.wav,.m4a,.aac,.opus"
                            className="hidden"
                            onChange={(e) => handleStepMediaUpload(activeStepTab, e, 'audio')}
                            disabled={Boolean(isUploadingStepMedia)}
                          />
                        </label>

                        {/* Video Upload */}
                        <label className="p-2.5 rounded-lg border border-dashed border-[#E6E2D8] dark:border-[#262930] hover:border-emerald-500/60 bg-[#FAF8F5] dark:bg-[#181A1F] hover:bg-emerald-500/10 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors text-center">
                          <Video className="w-4 h-4 text-rose-400" />
                          <span className="text-xs font-medium text-gray-900 dark:text-white">+ Add Video</span>
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => handleStepMediaUpload(activeStepTab, e, 'video')}
                            disabled={Boolean(isUploadingStepMedia)}
                          />
                        </label>

                        {/* Document Upload */}
                        <label className="p-2.5 rounded-lg border border-dashed border-[#E6E2D8] dark:border-[#262930] hover:border-emerald-500/60 bg-[#FAF8F5] dark:bg-[#181A1F] hover:bg-emerald-500/10 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors text-center">
                          <FileCheck className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-medium text-gray-900 dark:text-white">+ Add Document</span>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            className="hidden"
                            onChange={(e) => handleStepMediaUpload(activeStepTab, e, 'document')}
                            disabled={Boolean(isUploadingStepMedia)}
                          />
                        </label>
                      </div>

                      {isUploadingStepMedia && isUploadingStepMedia.stepNumber === activeStepTab && (
                        <p className="text-xs text-blue-400 animate-pulse pt-1">
                          Uploading {isUploadingStepMedia.type} for Step {activeStepTab}...
                        </p>
                      )}

                      {/* Uploaded Files for this specific step */}
                      {activeStep?.files && activeStep.files.length > 0 && (
                        <div className="space-y-2 pt-1">
                          {activeStep.files.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-[#EDE8DE] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] text-xs gap-3"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                {file.type === 'image' && (
                                  <div className="w-10 h-10 rounded border border-[#E6E2D8] dark:border-[#262930] overflow-hidden bg-black/40 shrink-0">
                                    <img src={file.url} alt="Step preview" className="w-full h-full object-cover" />
                                  </div>
                                )}
                                {file.type === 'audio' && (
                                  <div className="shrink-0 flex items-center gap-2">
                                    <Music className="w-4 h-4 text-purple-400" />
                                    <audio src={file.url} controls className="h-7 w-44" />
                                  </div>
                                )}
                                {file.type === 'video' && (
                                  <div className="w-12 h-10 rounded border border-[#E6E2D8] dark:border-[#262930] overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
                                    <Video className="w-5 h-5 text-rose-400" />
                                  </div>
                                )}
                                {file.type === 'document' && (
                                  <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4 text-amber-400" />
                                  </div>
                                )}

                                <div className="truncate flex-1">
                                  <p className="font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                                  <p className="text-[10px] text-gray-500 uppercase">
                                    {file.type} • {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Ready to Send'}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteStepMediaFile(activeStepTab, file.id)}
                                className="p-1.5 text-gray-500 hover:text-destructive hover:bg-destructive/10 rounded transition-colors shrink-0"
                                title="Remove file"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Fallback display for legacy direct urls if files array is empty */}
                      {(!activeStep?.files || activeStep.files.length === 0) && (
                        <div className="space-y-2">
                          {activeStep?.imageUrl && (
                            <div className="flex items-center justify-between p-2 rounded-lg bg-[#EDE8DE] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] text-xs">
                              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                                <ImageIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Image Attached</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => updateStepField(activeStepTab, 'imageUrl', '')}
                                className="text-xs text-destructive hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                          {activeStep?.audioUrl && (
                            <div className="flex items-center justify-between p-2 rounded-lg bg-[#EDE8DE] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] text-xs">
                              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                                <Music className="w-3.5 h-3.5 text-purple-400" />
                                <span>Voice Note / Audio Attached</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => updateStepField(activeStepTab, 'audioUrl', '')}
                                className="text-xs text-destructive hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Step Execution Mode Indicator */}
                    <div className="p-2.5 rounded-lg bg-[#EDE8DE]/60 dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] text-xs flex items-center justify-between">
                      <span className="text-gray-500 font-medium">এই ধাপে যা যাবে:</span>
                      <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                        {hasText && !hasImg && !hasAud && !hasVid && !hasDoc && (
                          <span className="text-emerald-700 dark:text-emerald-400">📝 শুধু টেক্সট মেসেজ</span>
                        )}
                        {!hasText && hasImg && !hasAud && !hasVid && !hasDoc && (
                          <span className="text-blue-700 dark:text-blue-400">🖼️ শুধু ইমেজ (কোনো টেক্সট ছাড়া)</span>
                        )}
                        {!hasText && hasAud && !hasImg && !hasVid && !hasDoc && (
                          <span className="text-purple-700 dark:text-purple-400">🎙️ শুধু অডিও / ভয়েস নোট (কোনো টেক্সট ছাড়া)</span>
                        )}
                        {hasText && hasImg && (
                          <span className="text-indigo-700 dark:text-indigo-400">🖼️📝 ইমেজ + ক্যাপশন টেক্সট</span>
                        )}
                        {hasText && hasAud && (
                          <span className="text-purple-700 dark:text-purple-400">📝🎙️ টেক্সট মেসেজ + ভয়েস নোট</span>
                        )}
                        {hasText && hasVid && (
                          <span className="text-rose-700 dark:text-rose-400">🎥📝 ভিডিও + ক্যাপশন টেক্সট</span>
                        )}
                        {!hasText && !hasImg && !hasAud && !hasVid && !hasDoc && (
                          <span className="text-amber-600 dark:text-amber-400">⚠️ কিছু সিলেক্ট করা নেই (ডিফল্ট AI টেক্সট যাবে)</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
        {/* END OF RIGHT COLUMN */}
      </div>
      {/* END OF 2-COLUMN GRID */}

      {/* Submit Action */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 pt-4 border-t border-[#E6E2D8] dark:border-[#262930]">
        <Link href="/whatsapp" className="w-full sm:w-auto">
          <Button variant="ghost" type="button" className="w-full sm:w-auto text-gray-500 h-11 text-xs sm:text-sm">
            Cancel
          </Button>
        </Link>
        <Button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto bg-green-700 hover:bg-green-600 text-white font-medium px-6 h-11 text-xs sm:text-sm shadow-sm"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Campaign'}
        </Button>
      </div>
    </form>
  );
}

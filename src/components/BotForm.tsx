"use client"

import * as React from "react"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { Select } from "./ui/select"
import { Slider } from "./ui/slider"
import { Switch } from "./ui/switch"
import { Button } from "./ui/button"
import { 
  Key, 
  Plus, 
  Sparkles, 
  Mail, 
  Mic, 
  Image as ImageIcon, 
  FileText, 
  Globe,
  Video,
  Music,
  Trash2,
  Upload,
  Square,
  Play,
  Film,
  Volume2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Link as LinkIcon,
  Radio,
  FileAudio,
  Store,
  FileSpreadsheet
} from "lucide-react"
import { uploadFile } from "@/lib/uploadHelper"


export interface ApiKey {
  id: string;
  label?: string;
  gmail: string;
  key?: string;
}

interface BotFormProps {
  bot?: any;
  apiKeys: ApiKey[];
  onSubmit: (data: any) => void;
  loading?: boolean;
}

export function BotForm({ bot, apiKeys, onSubmit, loading }: BotFormProps) {
  const [name, setName] = React.useState(bot?.name || "")
  const [token, setToken] = React.useState(bot?.telegramToken || bot?.token || "")
  const [personality, setPersonality] = React.useState(bot?.aiPersonality || bot?.personality || "")
  const [details, setDetails] = React.useState(bot?.aiDetails || bot?.details || "")
  const [style, setStyle] = React.useState(bot?.responseStyle || bot?.style || "friendly")
  const [maxLength, setMaxLength] = React.useState(bot?.maxTokens || bot?.maxLength || 500)
  
  // Key mode: 'existing' or 'new'
  const hasExistingKeys = apiKeys && apiKeys.length > 0;
  const [keyMode, setKeyMode] = React.useState<'existing' | 'new'>(hasExistingKeys && bot?.apiKeyId ? 'existing' : (hasExistingKeys ? 'existing' : 'new'))
  const [selectedKeyId, setSelectedKeyId] = React.useState(bot?.apiKeyId || (hasExistingKeys ? apiKeys[0].id : ""))
  
  // New Key Inputs
  const [newKey, setNewKey] = React.useState("")
  const [newGmail, setNewGmail] = React.useState("")
  const [newLabel, setNewLabel] = React.useState("")

  const [autoActivate, setAutoActivate] = React.useState(
    bot?.isActive !== undefined ? Boolean(bot.isActive) : (bot?.status === "Active" || bot?.status === "active" || true)
  )

  // AI Multimodal & Tool Capabilities Toggles
  const [enableVoice, setEnableVoice] = React.useState(
    bot?.enableVoice !== undefined ? Boolean(bot.enableVoice) : true
  )
  const [enableVision, setEnableVision] = React.useState(
    bot?.enableVision !== undefined ? Boolean(bot.enableVision) : true
  )
  const [enableFiles, setEnableFiles] = React.useState(
    bot?.enableFiles !== undefined ? Boolean(bot.enableFiles) : true
  )
  const [enableWebSearch, setEnableWebSearch] = React.useState(
    bot?.enableWebSearch !== undefined ? Boolean(bot.enableWebSearch) : false
  )

  // Welcome Media Automation State
  const [enableWelcomeMedia, setEnableWelcomeMedia] = React.useState<boolean>(
    bot?.enableWelcomeMedia !== undefined ? Boolean(bot.enableWelcomeMedia) : false
  )
  const [welcomeImageUrl, setWelcomeImageUrl] = React.useState(bot?.welcomeImageUrl || "")
  const [welcomeAudioUrl, setWelcomeAudioUrl] = React.useState(bot?.welcomeAudioUrl || "")
  const [welcomeAudioType, setWelcomeAudioType] = React.useState<'voice' | 'audio'>(
    bot?.welcomeAudioType || "voice"
  )
  const [welcomeVideoUrl, setWelcomeVideoUrl] = React.useState(bot?.welcomeVideoUrl || "")
  const [welcomeMessage, setWelcomeMessage] = React.useState(bot?.welcomeMessage || "")

  // Sub-tabs for input modes
  const [imageTab, setImageTab] = React.useState<'upload' | 'url'>('upload')
  const [audioTab, setAudioTab] = React.useState<'record' | 'upload' | 'url'>('record')
  const [videoTab, setVideoTab] = React.useState<'upload' | 'url'>('upload')

  // Uploading indicators
  const [uploadingImage, setUploadingImage] = React.useState(false)
  const [uploadingAudio, setUploadingAudio] = React.useState(false)
  const [uploadingVideo, setUploadingVideo] = React.useState(false)

  // Live Audio Recording State
  const [isRecording, setIsRecording] = React.useState(false)
  const [recordingSeconds, setRecordingSeconds] = React.useState(0)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const audioChunksRef = React.useRef<Blob[]>([])
  const timerRef = React.useRef<NodeJS.Timeout | null>(null)

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/ogg'
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        const file = new File([audioBlob], `voice-note-${Date.now()}.ogg`, { type: mimeType })

        setUploadingAudio(true)
        try {
          const result = await uploadFile(file, 'audio')
          if (result.url) {
            setWelcomeAudioUrl(result.url)
            setWelcomeAudioType('voice')
          }
        } catch (err: any) {
          console.error('Failed to upload recorded voice:', err)
          alert(err.message || 'ভয়েস আপলোড করতে সমস্যা হয়েছে')
        } finally {
          setUploadingAudio(false)
        }
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start(200)
      setIsRecording(true)
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1)
      }, 1000)
    } catch (err: any) {
      alert('মাইক্রোফোন চালু করতে সমস্যা হয়েছে: ' + (err.message || 'Permission denied'))
    }
  }

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const handleFileUpload = async (file: File, type: 'image' | 'audio' | 'video') => {
    if (type === 'image') setUploadingImage(true)
    if (type === 'audio') setUploadingAudio(true)
    if (type === 'video') setUploadingVideo(true)

    try {
      const result = await uploadFile(file, type)
      if (result.url) {
        if (type === 'image') setWelcomeImageUrl(result.url)
        if (type === 'audio') {
          setWelcomeAudioUrl(result.url)
          setWelcomeAudioType('audio')
        }
        if (type === 'video') setWelcomeVideoUrl(result.url)
      }
    } catch (err: any) {
      console.error(`Failed to upload ${type}:`, err)
      alert(err.message || `${type} আপলোড করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।`)
    } finally {
      if (type === 'image') setUploadingImage(false)
      if (type === 'audio') setUploadingAudio(false)
      if (type === 'video') setUploadingVideo(false)
    }
  }

  // Shop & Work Knowledge Base State
  const [workInfo, setWorkInfo] = React.useState(bot?.workInfo || "")
  const [productFileUrl, setProductFileUrl] = React.useState(bot?.productFileUrl || "")
  const [productFileName, setProductFileName] = React.useState(bot?.productFileName || "")
  const [productFileContent, setProductFileContent] = React.useState(bot?.productFileContent || "")
  const [uploadingDoc, setUploadingDoc] = React.useState(false)

  const handleDocumentUpload = async (file: File) => {
    setUploadingDoc(true)
    try {
      const result = await uploadFile(file, 'document')
      if (result.url) {
        setProductFileUrl(result.url)
        setProductFileName(result.filename || file.name)
        if (result.parsedContent) {
          setProductFileContent(result.parsedContent)
        }
      }
    } catch (err: any) {
      console.error('Failed to upload document:', err)
      alert(err.message || 'ফাইল আপলোড করতে সমস্যা হয়েছে')
    } finally {
      setUploadingDoc(false)
    }
  }

  const handleRemoveDocument = () => {
    setProductFileUrl("")
    setProductFileName("")
    setProductFileContent("")
  }

  const loadSampleShopTemplate = () => {
    const template = `[দোকানের তথ্য]
দোকানের নাম: আমাদের দোকান
ঠিকানা / শোরুম: ঢাকা, বাংলাদেশ
কাস্টমার কেয়ার: সকাল ১০টা - রাত ১০টা

[পণ্যের তালিকা ও সঠিক দাম]
১. প্রোডাক্ট ১ - দাম: ৫০০ টাকা
২. প্রোডাক্ট ২ - দাম: ১,২০০ টাকা
৩. প্রোডাক্ট ৩ - দাম: ৮৫০ টাকা

[ডেলিভারি চার্জ ও নিয়ম]
- ঢাকার ভিতরে ডেলিভারি চার্জ: ৭০ টাকা (১-২ দিনে ডেলিভারি)
- ঢাকার বাইরে ডেলিভারি চার্জ: ১৩০ টাকা (২-৩ দিনে ডেলিভারি)
- ক্যাশ অন ডেলিভারি (Cash on Delivery) সুবিধা রয়েছে।

[অর্ডার নেওয়ার নিয়ম]
কাস্টমার কোনো পণ্য কিনতে চাইলে বিনয়ের সাথে তাদের নাম, মোবাইল নম্বর এবং সম্পূর্ণ ডেলিভারি ঠিকানা চেয়ে নিবে।`;

    if (!workInfo.trim()) {
      setWorkInfo(template)
    } else {
      setWorkInfo((prev: string) => prev + '\n\n' + template)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const payload: any = {
      name: name.trim(),
      telegramToken: token.trim(),
      token: token.trim(),
      aiPersonality: personality.trim(),
      personality: personality.trim(),
      aiDetails: details.trim(),
      details: details.trim(),
      responseStyle: style.toLowerCase(),
      style,
      maxTokens: Number(maxLength),
      maxLength: Number(maxLength),
      autoActivate,
      isActive: autoActivate,
      enableVoice,
      enableVision,
      enableFiles,
      enableWebSearch,
      enableWelcomeMedia,
      welcomeImageUrl: welcomeImageUrl.trim(),
      welcomeAudioUrl: welcomeAudioUrl.trim(),
      welcomeAudioType,
      welcomeVideoUrl: welcomeVideoUrl.trim(),
      welcomeMessage: welcomeMessage.trim(),
      workInfo: workInfo.trim(),
      productFileUrl: productFileUrl.trim(),
      productFileName: productFileName.trim(),
      productFileContent: productFileContent.trim(),
    }


    if (keyMode === 'existing' && selectedKeyId) {
      payload.apiKeyId = selectedKeyId;
    } else {
      payload.apiKeyId = 'new';
      payload.newApiKey = {
        key: newKey.trim(),
        gmail: newGmail.trim(),
        label: newLabel.trim() || newGmail.trim().split('@')[0],
      };
    }

    onSubmit(payload)
  }

  const styleOptions = [
    { label: "Friendly (Warm & Natural)", value: "friendly" },
    { label: "Formal (Professional & Polite)", value: "formal" },
    { label: "Casual (Relaxed & Conversational)", value: "casual" },
    { label: "Custom (Defined strictly in prompt)", value: "custom" },
  ]

  const existingKeyOptions = (apiKeys || []).map(k => ({
    label: `${k.label ? k.label + ' - ' : ''}${k.gmail}`,
    value: k.id
  }))

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Bot Name */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Bot Name</label>
        <Input 
          required 
          value={name} 
          onChange={e => setName(e.target.value)} 
          placeholder="e.g. Smart Customer Assistant" 
          className="text-base sm:text-sm h-11"
        />
      </div>

      {/* Telegram Token */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground flex items-center justify-between">
          <span>Telegram Bot Token</span>
          <span className="text-xs text-primary font-normal">From @BotFather</span>
        </label>
        <Input 
          required 
          className="font-mono text-xs sm:text-sm h-11" 
          value={token} 
          onChange={e => setToken(e.target.value)} 
          placeholder="7839210452:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw" 
        />
        <p className="text-xs text-muted-foreground">
          Create a bot on Telegram with <code className="text-primary">@BotFather</code> and paste the HTTP API token here.
        </p>
      </div>

      {/* API Key Section */}
      <div className="p-4 sm:p-5 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-primary shrink-0" />
            <h4 className="text-sm font-semibold text-foreground">Google AI Studio (Gemini) API Key</h4>
          </div>

          {hasExistingKeys && (
            <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-lg border border-border/60 text-xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setKeyMode('existing')}
                className={`px-3 py-1 rounded-md transition-all ${keyMode === 'existing' ? 'bg-primary text-primary-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Use Saved Key
              </button>
              <button
                type="button"
                onClick={() => setKeyMode('new')}
                className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 ${keyMode === 'new' ? 'bg-primary text-primary-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Plus size={12} /> Add New Key
              </button>
            </div>
          )}
        </div>

        {keyMode === 'existing' && hasExistingKeys ? (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Select one of your saved Gmail accounts:</label>
            <Select 
              options={existingKeyOptions} 
              value={selectedKeyId} 
              onChange={e => setSelectedKeyId(e.target.value)}
              placeholder="Select an API Key"
              required
            />
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Gemini API Key (free from AI Studio)</label>
              <Input 
                required={keyMode === 'new'} 
                type="text"
                className="font-mono text-xs sm:text-sm h-11"
                value={newKey} 
                onChange={e => setNewKey(e.target.value)} 
                placeholder="AIzaSy..." 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1">
                  <Mail size={12} className="text-muted-foreground" />
                  Gmail Account (remembers where key came from)
                </label>
                <Input 
                  required={keyMode === 'new'} 
                  type="email"
                  className="text-base sm:text-sm h-11"
                  value={newGmail} 
                  onChange={e => setNewGmail(e.target.value)} 
                  placeholder="yourname@gmail.com" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Account Label (optional)</label>
                <Input 
                  className="text-base sm:text-sm h-11"
                  value={newLabel} 
                  onChange={e => setNewLabel(e.target.value)} 
                  placeholder="e.g. Personal Account #1" 
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              This API key will be saved securely and tracked in your API Key Management center.
            </p>
          </div>
        )}
      </div>

      {/* AI Personality */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-purple-400" />
          AI Personality (How the AI talks)
        </label>
        <Textarea 
          required 
          rows={4}
          value={personality} 
          onChange={e => setPersonality(e.target.value)} 
          placeholder="You are a warm, polite assistant. Speak fluent Bengali and English. Always assist the user politely and helpfully." 
          className="text-base sm:text-sm"
        />
      </div>

      {/* AI Details / Context */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Extra Knowledge & Rules (Optional)</label>
        <Textarea 
          rows={3}
          value={details} 
          onChange={e => setDetails(e.target.value)} 
          placeholder="Working hours: 10 AM - 10 PM. We offer 24/7 online support. Product prices start at 500 BDT." 
          className="text-base sm:text-sm"
        />
      </div>

      {/* 🏪 Shop Knowledge & Product Training (Work Info & Excel/Word File) */}
      <div className="p-4 sm:p-5 border border-emerald-500/30 bg-emerald-950/10 rounded-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-foreground">
                Shop Knowledge & Product Training (দোকানের তথ্য ও প্রোডাক্ট)
              </h3>
              <p className="text-xs text-muted-foreground">
                আপনার দোকানের পণ্য, দাম ও নিয়ম দিয়ে বটকে ট্রেইন করুন
              </p>
            </div>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            AI Sales Brain
          </span>
        </div>

        {/* 1. Work Info Text Box */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-400" />
              Work Info (দোকান ও প্রোডাক্টের বিস্তারিত তথ্য)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadSampleShopTemplate}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 transition-colors"
              >
                📋 Load Sample Template
              </button>
              {workInfo && (
                <button
                  type="button"
                  onClick={() => setWorkInfo("")}
                  className="text-[11px] text-muted-foreground hover:text-red-400 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <Textarea 
            rows={5}
            value={workInfo} 
            onChange={e => setWorkInfo(e.target.value)} 
            placeholder="এখানে আপনার দোকানের নাম, পণ্যের নাম, দাম, সাইজ, কালার, স্টক, ডেলিভারি চার্জ (যেমন: ঢাকার ভেতরে ৭০, বাইরে ১৩০) এবং অর্ডার নেওয়ার নিয়ম বিস্তারিত লিখে দিন..." 
            className="text-base sm:text-sm font-mono text-xs leading-relaxed"
          />
          <p className="text-[11px] text-muted-foreground">
            💡 কাস্টমার যেকোনো পণ্যের দাম বা তথ্য জানতে চাইলে বট এই তথ্য দেখে শতভাগ সঠিক উত্তর দেবে।
          </p>
        </div>

        {/* 2. Product Sheet (Excel / Word Document) */}
        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-teal-400" />
              Product Sheet (Excel / Word Document)
            </label>
            <span className="text-[11px] text-muted-foreground">.xlsx, .csv, .docx, .txt</span>
          </div>

          {productFileUrl ? (
            <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-card/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                    {productFileName || 'Uploaded Product Document'}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Loaded into AI Knowledge Base
                    </span>
                    {productFileContent && (
                      <span className="text-[10px] text-muted-foreground">
                        ({productFileContent.length} characters parsed)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={handleRemoveDocument}
                  className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 size={12} /> Remove File
                </button>
              </div>
            </div>
          ) : (
            <label className={`border border-dashed border-border/80 hover:border-emerald-500/50 hover:bg-emerald-500/5 rounded-xl p-4 sm:p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${uploadingDoc ? 'opacity-70 pointer-events-none' : ''}`}>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.docx,.doc,.txt,.json"
                className="hidden"
                disabled={uploadingDoc}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleDocumentUpload(f);
                  e.target.value = '';
                }}
              />
              {uploadingDoc ? (
                <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
              ) : (
                <Upload className="w-5 h-5 text-muted-foreground" />
              )}
              <span className="text-xs sm:text-sm text-foreground font-medium text-center">
                {uploadingDoc ? 'ডকুমেন্ট আপলোড ও প্রসেসিং হচ্ছে... অপেক্ষা করুন' : 'Click to Upload Excel (.xlsx, .csv) or Word (.docx)'}
              </span>
              <span className="text-[11px] text-muted-foreground text-center">
                এক্সেল বা ওয়ার্ড ফাইল আপলোড করলে বট স্বয়ংক্রিয়ভাবে সব পণ্য ও দাম পড়ে মুখস্থ করে নেবে
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Response Style & Max Tokens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Response Style</label>
          <Select 
            options={styleOptions} 
            value={style} 
            onChange={e => setStyle(e.target.value)} 
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Max Response Length ({maxLength} tokens)</label>
          <Slider min={50} max={2000} step={50} value={maxLength} onChange={setMaxLength} />
        </div>
      </div>

      {/* AI Superpowers & Multimodal Capabilities */}
      <div className="p-4 sm:p-5 border border-purple-500/30 bg-purple-950/15 rounded-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-foreground">AI Superpowers & Capabilities (ফিচারসমূহ)</h3>
              <p className="text-xs text-muted-foreground">Turn features ON or OFF for this bot</p>
            </div>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            Multimodal
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
          {/* 1. Voice & Audio */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/60 hover:border-blue-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <Mic className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Voice & Audio Messages</p>
                <p className="text-[11px] text-muted-foreground">ভয়েস ও অডিও শুনে উত্তর দেবে</p>
              </div>
            </div>
            <Switch checked={enableVoice} onCheckedChange={setEnableVoice} />
          </div>

          {/* 2. Image Vision */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/60 hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Image Vision & Reading</p>
                <p className="text-[11px] text-muted-foreground">ছবি ও ফটো দেখে বুঝতে পারবে</p>
              </div>
            </div>
            <Switch checked={enableVision} onCheckedChange={setEnableVision} />
          </div>

          {/* 3. Document & File Reading */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/60 hover:border-amber-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <FileText className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Document & File Reading</p>
                <p className="text-[11px] text-muted-foreground">PDF ও টেক্সট ফাইল পড়ে বিশ্লেষণ করবে</p>
              </div>
            </div>
            <Switch checked={enableFiles} onCheckedChange={setEnableFiles} />
          </div>

          {/* 4. Live Web Search */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/60 hover:border-cyan-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                <Globe className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Live Web Search</p>
                <p className="text-[11px] text-muted-foreground">গুগল লাইভ সার্চ করে সাম্প্রতিক তথ্য দেবে</p>
              </div>
            </div>
            <Switch checked={enableWebSearch} onCheckedChange={setEnableWebSearch} />
          </div>
        </div>
      </div>

      {/* Welcome Media Automation (/start trigger) */}
      <div className={`p-4 sm:p-5 border rounded-2xl transition-all duration-300 space-y-5 ${
        enableWelcomeMedia 
          ? 'border-indigo-500/40 bg-gradient-to-br from-indigo-950/20 via-background to-purple-950/15 shadow-lg shadow-indigo-500/5' 
          : 'border-border/60 bg-card/40'
      }`}>
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl transition-colors ${
              enableWelcomeMedia ? 'bg-indigo-500/20 text-indigo-400' : 'bg-muted text-muted-foreground'
            }`}>
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base text-foreground">
                  Welcome Media Automation (স্বাগতম মিডিয়া)
                </h3>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                  enableWelcomeMedia 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-muted/40 text-muted-foreground border-border/40'
                }`}>
                  {enableWelcomeMedia ? 'Active (সক্রিয়)' : 'Disabled (বন্ধ)'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                টেলিগ্রামে কেউ বটটি <code className="text-primary font-mono text-[11px]">/start</code> করলে স্বয়ংক্রিয়ভাবে ছবি, অডিও/ভয়েস ও ভিডিও চলে যাবে
              </p>
            </div>
          </div>
          <Switch 
            checked={enableWelcomeMedia} 
            onCheckedChange={setEnableWelcomeMedia} 
          />
        </div>

        {enableWelcomeMedia && (
          <div className="space-y-5 pt-1">
            {/* Welcome Caption / Message */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-medium text-foreground flex items-center justify-between">
                <span>Welcome Text / Caption (স্বাগতম বার্তা বা ক্যাপশন)</span>
                <span className="text-[11px] text-muted-foreground">ছবির সাথে বা শুরুতে যাবে</span>
              </label>
              <Textarea
                rows={2}
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="যেমন: স্বাগতম আমাদের অফিসিয়াল বটে! নিচে আমাদের ইন্ট্রোডাকশন ছবি, ভয়েস মেসেজ ও ভিডিওটি দেখে নিন..."
                className="text-sm"
              />
            </div>

            {/* 3 Media Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* 1. Welcome Image */}
              <div className="p-4 rounded-xl border border-border/70 bg-card/70 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <ImageIcon className="w-4 h-4 text-emerald-400" />
                      1. Welcome Image (ছবি)
                    </span>
                    {welcomeImageUrl && (
                      <button
                        type="button"
                        onClick={() => setWelcomeImageUrl("")}
                        className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    )}
                  </div>

                  {welcomeImageUrl ? (
                    <div className="space-y-2">
                      <div className="relative group rounded-lg overflow-hidden border border-border/80 bg-black/40 aspect-video flex items-center justify-center">
                        <img 
                          src={welcomeImageUrl} 
                          alt="Welcome Preview" 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setWelcomeImageUrl("")}
                            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium flex items-center gap-1 shadow"
                          >
                            <Trash2 size={12} /> Delete Image
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate font-mono">
                        {welcomeImageUrl}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 text-[11px] bg-secondary/60 p-0.5 rounded-lg border border-border/40">
                        <button
                          type="button"
                          onClick={() => setImageTab('upload')}
                          className={`flex-1 py-1 rounded-md transition-all text-center ${
                            imageTab === 'upload' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'
                          }`}
                        >
                          Upload File
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageTab('url')}
                          className={`flex-1 py-1 rounded-md transition-all text-center ${
                            imageTab === 'url' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'
                          }`}
                        >
                          Paste URL / ID
                        </button>
                      </div>

                      {imageTab === 'upload' ? (
                        <label className={`border border-dashed border-border/80 hover:border-emerald-500/50 hover:bg-emerald-500/5 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${uploadingImage ? 'opacity-70 pointer-events-none' : ''}`}>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingImage}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFileUpload(f, 'image');
                              e.target.value = '';
                            }}
                          />
                          {uploadingImage ? (
                            <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                          ) : (
                            <Upload className="w-5 h-5 text-muted-foreground" />
                          )}
                          <span className="text-xs text-foreground font-medium">
                            {uploadingImage ? 'ছবি আপলোড হচ্ছে...' : 'Click to Upload Image'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">PNG, JPG, WEBP, GIF</span>
                        </label>
                      ) : (
                        <Input
                          placeholder="https://... or Telegram file_id"
                          value={welcomeImageUrl}
                          onChange={(e) => setWelcomeImageUrl(e.target.value)}
                          className="text-xs font-mono h-9"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Welcome Audio & Live Voice Recording */}
              <div className="p-4 rounded-xl border border-border/70 bg-card/70 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <Mic className="w-4 h-4 text-blue-400" />
                      2. Audio / Voice (অডিও/ভয়েস)
                    </span>
                    {welcomeAudioUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setWelcomeAudioUrl("");
                          stopVoiceRecording();
                        }}
                        className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    )}
                  </div>

                  {welcomeAudioUrl ? (
                    <div className="space-y-2.5">
                      <div className="p-2.5 rounded-lg bg-black/40 border border-border/70 space-y-2">
                        <audio 
                          controls 
                          src={welcomeAudioUrl} 
                          className="w-full h-8" 
                        />
                        <div className="flex items-center justify-between pt-1 text-[11px]">
                          <span className="text-muted-foreground">Telegram Format:</span>
                          <button
                            type="button"
                            onClick={() => setWelcomeAudioType(prev => prev === 'voice' ? 'audio' : 'voice')}
                            className="px-2 py-0.5 rounded bg-secondary text-primary font-medium text-[11px] border border-border/60 hover:bg-primary/20 transition-colors"
                          >
                            {welcomeAudioType === 'voice' ? '🎙️ Voice Note (Waveform)' : '🎵 Music Audio (MP3)'}
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setWelcomeAudioUrl("");
                          stopVoiceRecording();
                        }}
                        className="w-full py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Trash2 size={12} /> Remove / Re-record
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 text-[11px] bg-secondary/60 p-0.5 rounded-lg border border-border/40">
                        <button
                          type="button"
                          onClick={() => setAudioTab('record')}
                          className={`flex-1 py-1 rounded-md transition-all text-center ${
                            audioTab === 'record' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'
                          }`}
                        >
                          🎙️ Live Record
                        </button>
                        <button
                          type="button"
                          onClick={() => setAudioTab('upload')}
                          className={`flex-1 py-1 rounded-md transition-all text-center ${
                            audioTab === 'upload' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'
                          }`}
                        >
                          📁 Upload Audio
                        </button>
                        <button
                          type="button"
                          onClick={() => setAudioTab('url')}
                          className={`flex-1 py-1 rounded-md transition-all text-center ${
                            audioTab === 'url' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'
                          }`}
                        >
                          🔗 URL / ID
                        </button>
                      </div>

                      {audioTab === 'record' && (
                        <div className="p-3 border border-border/80 rounded-xl bg-secondary/30 flex flex-col items-center justify-center gap-2">
                          {isRecording ? (
                            <div className="flex flex-col items-center gap-2">
                              <div className="flex items-center gap-2 text-red-400 animate-pulse text-xs font-semibold">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                                Recording: {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                              </div>
                              <button
                                type="button"
                                onClick={stopVoiceRecording}
                                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                              >
                                <Square size={13} /> Stop & Save Voice
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={startVoiceRecording}
                              disabled={uploadingAudio}
                              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-2 transition-all shadow-md active:scale-95"
                            >
                              <Mic size={14} className="text-white" />
                              {uploadingAudio ? 'Saving Voice...' : 'Click to Record Voice (কথা বলুন)'}
                            </button>
                          )}
                          <p className="text-[10px] text-muted-foreground text-center">
                            টেলিগ্রামে আসল ভয়েস নোট বাবলের মতো যাবে
                          </p>
                        </div>
                      )}

                      {audioTab === 'upload' && (
                        <label className={`border border-dashed border-border/80 hover:border-blue-500/50 hover:bg-blue-500/5 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${uploadingAudio ? 'opacity-70 pointer-events-none' : ''}`}>
                          <input
                            type="file"
                            accept="audio/*,.mp3,.wav,.ogg,.m4a"
                            className="hidden"
                            disabled={uploadingAudio}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFileUpload(f, 'audio');
                              e.target.value = '';
                            }}
                          />
                          {uploadingAudio ? (
                            <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                          ) : (
                            <Music className="w-5 h-5 text-muted-foreground" />
                          )}
                          <span className="text-xs text-foreground font-medium">
                            {uploadingAudio ? 'অডিও আপলোড হচ্ছে...' : 'Choose Downloaded Audio'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">MP3, WAV, OGG, M4A</span>
                        </label>
                      )}

                      {audioTab === 'url' && (
                        <Input
                          placeholder="https://... or Telegram file_id"
                          value={welcomeAudioUrl}
                          onChange={(e) => setWelcomeAudioUrl(e.target.value)}
                          className="text-xs font-mono h-9"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Welcome Video */}
              <div className="p-4 rounded-xl border border-border/70 bg-card/70 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <Video className="w-4 h-4 text-purple-400" />
                      3. Welcome Video (ভিডিও)
                    </span>
                    {welcomeVideoUrl && (
                      <button
                        type="button"
                        onClick={() => setWelcomeVideoUrl("")}
                        className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    )}
                  </div>

                  {welcomeVideoUrl ? (
                    <div className="space-y-2">
                      <div className="rounded-lg overflow-hidden border border-border/80 bg-black/40 aspect-video flex items-center justify-center">
                        <video 
                          controls 
                          src={welcomeVideoUrl} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setWelcomeVideoUrl("")}
                        className="w-full py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Trash2 size={12} /> Remove Video
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 text-[11px] bg-secondary/60 p-0.5 rounded-lg border border-border/40">
                        <button
                          type="button"
                          onClick={() => setVideoTab('upload')}
                          className={`flex-1 py-1 rounded-md transition-all text-center ${
                            videoTab === 'upload' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'
                          }`}
                        >
                          Upload Video
                        </button>
                        <button
                          type="button"
                          onClick={() => setVideoTab('url')}
                          className={`flex-1 py-1 rounded-md transition-all text-center ${
                            videoTab === 'url' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'
                          }`}
                        >
                          Paste URL / ID
                        </button>
                      </div>

                      {videoTab === 'upload' ? (
                        <label className={`border border-dashed border-border/80 hover:border-purple-500/50 hover:bg-purple-500/5 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${uploadingVideo ? 'opacity-70 pointer-events-none' : ''}`}>
                          <input
                            type="file"
                            accept="video/*,.mp4,.webm,.mov,.mkv"
                            className="hidden"
                            disabled={uploadingVideo}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFileUpload(f, 'video');
                              e.target.value = '';
                            }}
                          />
                          {uploadingVideo ? (
                            <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
                          ) : (
                            <Upload className="w-5 h-5 text-muted-foreground" />
                          )}
                          <span className="text-xs text-foreground font-medium text-center">
                            {uploadingVideo ? 'ভিডিও আপলোড হচ্ছে... (দয়া করে অপেক্ষা করুন)' : 'Click to Upload Video (ভিডিও আপলোড করুন)'}
                          </span>
                          <span className="text-[10px] text-muted-foreground text-center">
                            MP4, WEBM, MOV (সর্বোচ্চ ৫০ MB পর্যন্ত)
                          </span>
                        </label>
                      ) : (
                        <Input
                          placeholder="https://... or Telegram file_id"
                          value={welcomeVideoUrl}
                          onChange={(e) => setWelcomeVideoUrl(e.target.value)}
                          className="text-xs font-mono h-9"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Auto-Activate Switch */}
      <div className="flex items-center justify-between p-4 border border-border rounded-xl bg-secondary/40">
        <div>
          <p className="font-medium text-sm text-foreground">Auto-Activate on Telegram</p>
          <p className="text-xs text-muted-foreground">Register webhook with Telegram and make bot live immediately</p>
        </div>
        <Switch checked={autoActivate} onCheckedChange={setAutoActivate} />
      </div>


      {/* Submit Button */}
      <Button 
        type="submit" 
        className="w-full h-11 text-base font-medium shadow-md" 
        disabled={loading || (keyMode === 'existing' && !selectedKeyId)}
      >
        {loading ? "Saving & Connecting..." : (bot ? "Save Changes" : "Create Bot")}
      </Button>
    </form>
  )
}

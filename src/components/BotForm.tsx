"use client"

import * as React from "react"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { Select } from "./ui/select"
import { Slider } from "./ui/slider"
import { Switch } from "./ui/switch"
import { Button } from "./ui/button"
import { Key, Plus, Sparkles, Mail, Mic, Image as ImageIcon, FileText, Globe } from "lucide-react"


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

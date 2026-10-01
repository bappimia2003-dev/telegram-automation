"use client"

import * as React from "react"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { Select } from "./ui/select"
import { Slider } from "./ui/slider"
import { Switch } from "./ui/switch"
import { Button } from "./ui/button"

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
  const [apiKeyId, setApiKeyId] = React.useState(bot?.apiKeyId || "")
  const [autoActivate, setAutoActivate] = React.useState(
    bot?.isActive !== undefined ? Boolean(bot.isActive) : (bot?.status === "Active" || bot?.status === "active" || false)
  )

  // Auto-select first API key if none is selected
  React.useEffect(() => {
    if (!apiKeyId && apiKeys && apiKeys.length > 0) {
      setApiKeyId(apiKeys[0].id)
    }
  }, [apiKeys, apiKeyId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name,
      telegramToken: token,
      token,
      aiPersonality: personality,
      personality,
      aiDetails: details,
      details,
      responseStyle: style.toLowerCase(),
      style,
      maxTokens: Number(maxLength),
      maxLength: Number(maxLength),
      apiKeyId,
      autoActivate,
      isActive: autoActivate,
    })
  }

  const styleOptions = [
    { label: "Friendly (Warm & Helpful)", value: "friendly" },
    { label: "Formal (Professional)", value: "formal" },
    { label: "Casual (Relaxed)", value: "casual" },
    { label: "Custom (Defined in prompt)", value: "custom" },
  ]

  const apiKeyOptions = (apiKeys || []).map(k => ({
    label: `${k.label ? k.label + ' - ' : ''}${k.gmail}`,
    value: k.id
  }))

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Bot Name</label>
        <Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Customer Support Bot" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Telegram Bot Token (from @BotFather)</label>
        <Input required className="font-mono text-xs sm:text-sm" value={token} onChange={e => setToken(e.target.value)} placeholder="1234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw" />
        <p className="text-xs text-muted-foreground">Get this from @BotFather on Telegram with the /newbot command</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">AI Personality (System Prompt)</label>
        <Textarea 
          required 
          rows={4}
          value={personality} 
          onChange={e => setPersonality(e.target.value)} 
          placeholder="You are a helpful customer support agent. Answer politely, concisely, and accurately in the user's language." 
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">AI Details & Knowledge Base (Optional Context)</label>
        <Textarea 
          rows={3}
          value={details} 
          onChange={e => setDetails(e.target.value)} 
          placeholder="Business hours: 9 AM - 6 PM. Refund policy: 7 days. Contact: support@example.com" 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Response Style</label>
          <Select 
            options={styleOptions} 
            value={style} 
            onChange={e => setStyle(e.target.value)} 
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Google AI Studio API Key</label>
          {apiKeyOptions.length === 0 ? (
            <div className="text-xs text-amber-400 bg-amber-500/10 p-3 rounded-md border border-amber-500/20">
              No API keys found. Please add a Gemini API key in the API Keys tab first!
            </div>
          ) : (
            <Select 
              options={apiKeyOptions} 
              value={apiKeyId} 
              onChange={e => setApiKeyId(e.target.value)}
              placeholder="Select an API Key"
              required
            />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Max Response Length ({maxLength} tokens)</label>
        <Slider min={50} max={2000} step={50} value={maxLength} onChange={setMaxLength} />
      </div>

      <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-secondary/50">
        <div>
          <p className="font-medium text-sm">Auto-Activate Webhook</p>
          <p className="text-xs text-muted-foreground">Register webhook with Telegram and start the bot immediately</p>
        </div>
        <Switch checked={autoActivate} onCheckedChange={setAutoActivate} />
      </div>

      <Button type="submit" className="w-full md:w-auto" disabled={loading || apiKeyOptions.length === 0}>
        {loading ? "Saving..." : (bot ? "Save Changes" : "Create Bot")}
      </Button>
    </form>
  )
}

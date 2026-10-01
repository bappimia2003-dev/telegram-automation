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
  label: string;
  gmail: string;
  key: string;
}

interface BotFormProps {
  bot?: any; // any for simplified Bot type
  apiKeys: ApiKey[];
  onSubmit: (data: any) => void;
  loading?: boolean;
}

export function BotForm({ bot, apiKeys, onSubmit, loading }: BotFormProps) {
  const [name, setName] = React.useState(bot?.name || "")
  const [token, setToken] = React.useState(bot?.token || "")
  const [personality, setPersonality] = React.useState(bot?.personality || "")
  const [details, setDetails] = React.useState(bot?.details || "")
  const [style, setStyle] = React.useState(bot?.style || "Formal")
  const [maxLength, setMaxLength] = React.useState(bot?.maxLength || 500)
  const [apiKeyId, setApiKeyId] = React.useState(bot?.apiKeyId || "")
  const [autoActivate, setAutoActivate] = React.useState(bot?.status === "Active" || false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name,
      token,
      personality,
      details,
      style,
      maxLength,
      apiKeyId,
      status: autoActivate ? "Active" : "Inactive"
    })
  }

  const styleOptions = [
    { label: "Formal", value: "Formal" },
    { label: "Casual", value: "Casual" },
    { label: "Friendly", value: "Friendly" },
    { label: "Custom", value: "Custom" },
  ]

  const apiKeyOptions = apiKeys.map(k => ({
    label: `${k.label} (${k.gmail})`,
    value: k.id
  }))

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Bot Name</label>
        <Input required value={name} onChange={e => setName(e.target.value)} placeholder="My Awesome Bot" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Telegram Bot Token</label>
        <Input required className="font-mono" value={token} onChange={e => setToken(e.target.value)} placeholder="1234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">AI Personality</label>
        <Textarea required value={personality} onChange={e => setPersonality(e.target.value)} placeholder="Describe how the AI should behave..." />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">AI Details</label>
        <Textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Extra context, knowledge base, rules..." />
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
          <label className="text-sm font-medium">API Key</label>
          <Select 
            options={apiKeyOptions} 
            value={apiKeyId} 
            onChange={e => setApiKeyId(e.target.value)}
            placeholder="Select an API Key"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Max Response Length ({maxLength})</label>
        <Slider min={50} max={2000} step={50} value={maxLength} onChange={setMaxLength} />
      </div>

      <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-secondary/50">
        <div>
          <p className="font-medium">Auto-Activate</p>
          <p className="text-sm text-muted-foreground">Start the bot immediately after saving</p>
        </div>
        <Switch checked={autoActivate} onCheckedChange={setAutoActivate} />
      </div>

      <Button type="submit" className="w-full md:w-auto" disabled={loading}>
        {loading ? "Saving..." : (bot ? "Save Changes" : "Create Bot")}
      </Button>
    </form>
  )
}

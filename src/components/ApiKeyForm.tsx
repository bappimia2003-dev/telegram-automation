"use client"

import * as React from "react"
import { Input } from "./ui/input"
import { Button } from "./ui/button"

export interface ApiKey {
  id: string;
  label: string;
  gmail: string;
  key: string;
}

interface ApiKeyFormProps {
  apiKey?: ApiKey;
  onSubmit: (data: any) => void;
  loading?: boolean;
}

export function ApiKeyForm({ apiKey, onSubmit, loading }: ApiKeyFormProps) {
  const [key, setKey] = React.useState(apiKey?.key || "")
  const [gmail, setGmail] = React.useState(apiKey?.gmail || "")
  const [label, setLabel] = React.useState(apiKey?.label || "")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ key, gmail, label })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">API Key</label>
        <Input 
          required 
          className="font-mono" 
          value={key} 
          onChange={e => setKey(e.target.value)} 
          placeholder="AIzaSy..." 
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Gmail Account</label>
        <Input 
          required 
          type="email" 
          value={gmail} 
          onChange={e => setGmail(e.target.value)} 
          placeholder="account@gmail.com" 
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Label</label>
        <Input 
          value={label} 
          onChange={e => setLabel(e.target.value)} 
          placeholder="e.g., Main Account, Backup #2" 
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : (apiKey ? "Update Key" : "Add API Key")}
      </Button>
    </form>
  )
}

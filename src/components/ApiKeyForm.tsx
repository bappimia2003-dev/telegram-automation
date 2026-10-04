"use client"

import * as React from "react"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { Mail, Key, Tag } from "lucide-react"

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
    onSubmit({ 
      key: key.trim(), 
      gmail: gmail.trim(), 
      label: label.trim() || gmail.trim().split('@')[0] 
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs sm:text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <Key size={14} className="text-amber-500" />
          Google AI Studio API Key
        </label>
        <Input 
          required 
          className="font-mono text-xs sm:text-sm h-11 bg-white border-gray-200" 
          value={key} 
          onChange={e => setKey(e.target.value)} 
          placeholder="AIzaSy..." 
        />
        <p className="text-[11px] text-gray-500">
          Free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline font-medium">Google AI Studio</a>
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs sm:text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <Mail size={14} className="text-gray-400" />
          Gmail Account
        </label>
        <Input 
          required 
          type="email" 
          className="text-base sm:text-sm h-11 bg-white border-gray-200"
          value={gmail} 
          onChange={e => setGmail(e.target.value)} 
          placeholder="youraccount@gmail.com" 
        />
        <p className="text-[11px] text-gray-500">
          This lets you easily identify which Google account this key belongs to.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs sm:text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <Tag size={14} className="text-gray-400" />
          Label / Tag (optional)
        </label>
        <Input 
          className="text-base sm:text-sm h-11 bg-white border-gray-200"
          value={label} 
          onChange={e => setLabel(e.target.value)} 
          placeholder="e.g. Main Account, Work Account" 
        />
      </div>

      <div className="pt-2">
        <Button type="submit" className="w-full h-11 text-sm font-semibold shadow-sm rounded-xl" disabled={loading}>
          {loading ? "Saving..." : (apiKey ? "Update API Key" : "Save & Add Key")}
        </Button>
      </div>
    </form>
  )
}

"use client"

import * as React from "react"
import { Edit2, Trash2, Key } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"

export interface ApiKey {
  id: string;
  label: string;
  gmail: string;
  key: string;
  status: string;
  requestsToday?: number;
  lastUsed?: string;
}

interface ApiKeyListProps {
  apiKeys: ApiKey[];
  onDelete: (id: string) => void;
  onEdit: (apiKey: ApiKey) => void;
}

export function ApiKeyList({ apiKeys, onDelete, onEdit }: ApiKeyListProps) {
  if (!apiKeys || apiKeys.length === 0) {
    return (
      <div className="text-center p-12 border border-dashed border-border rounded-lg bg-card/30">
        <Key size={40} className="mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground font-medium">No API keys added yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Add your Google AI Studio (Gemini) API key to start connecting bots.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-border overflow-hidden bg-card/50">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-secondary/80 text-muted-foreground">
            <tr>
              <th className="px-6 py-3 font-medium">Label / Account</th>
              <th className="px-6 py-3 font-medium">Masked Key</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Requests Today</th>
              <th className="px-6 py-3 font-medium">Last Used</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {apiKeys.map((k) => {
              const isActive = (k.status || 'active').toLowerCase() === 'active';
              const displayKey = k.key ? (k.key.includes('...') ? k.key : `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}`) : '****';
              return (
                <tr key={k.id} className="bg-card hover:bg-secondary/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-foreground">{k.label || "Gemini Account"}</div>
                    <div className="text-muted-foreground text-xs">{k.gmail}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {displayKey}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={isActive ? "success" : "destructive"}>
                      {isActive ? "Active" : k.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {k.requestsToday ?? 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-muted-foreground">
                    {k.lastUsed ? new Date(k.lastUsed).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(k)} title="Edit Key">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => onDelete(k.id)} title="Delete Key">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

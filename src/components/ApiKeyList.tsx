"use client"

import * as React from "react"
import { Edit2, Trash2 } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"

export interface ApiKey {
  id: string;
  label: string;
  gmail: string;
  key: string;
  status: "Active" | "Limit Reached" | "Invalid";
  requestsToday: number;
  lastUsed: string;
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
        <p className="text-muted-foreground">No API keys yet. Add one to get started.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-border overflow-hidden bg-card/50">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-secondary/80 text-muted-foreground">
            <tr>
              <th className="px-6 py-3 font-medium">Label / Gmail</th>
              <th className="px-6 py-3 font-medium">Key</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Requests Today</th>
              <th className="px-6 py-3 font-medium">Last Used</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {apiKeys.map((k) => (
              <tr key={k.id} className="bg-card hover:bg-secondary/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium">{k.label || "Unnamed"}</div>
                  <div className="text-muted-foreground text-xs">{k.gmail}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">
                  {k.key.substring(0, 4)}****{k.key.substring(k.key.length - 4)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={k.status === "Active" ? "success" : "destructive"}>
                    {k.status}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                  {k.requestsToday}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                  {k.lastUsed}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(k)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => onDelete(k.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

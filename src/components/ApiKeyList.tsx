"use client"

import * as React from "react"
import { Edit2, Trash2, Key, Bot, Activity, CheckCircle2, PauseCircle, Power } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"

export interface ApiKey {
  id: string;
  label: string;
  gmail: string;
  key: string;
  status: string;
  requestsToday?: number;
  tokensUsed?: number;
  lastUsed?: string;
  botsCount?: number;
  activeBotsCount?: number;
  botNames?: Array<{ id: string; name: string; isActive: boolean; currentModel: string }>;
}

interface ApiKeyListProps {
  apiKeys: ApiKey[];
  onDelete: (id: string) => void;
  onEdit: (apiKey: ApiKey) => void;
  onToggleStatus?: (id: string, newStatus: string) => void;
}

export function ApiKeyList({ apiKeys, onDelete, onEdit, onToggleStatus }: ApiKeyListProps) {
  if (!apiKeys || apiKeys.length === 0) {
    return (
      <div className="text-center p-8 sm:p-12 border border-dashed border-border rounded-xl bg-card/30">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3 text-amber-500">
          <Key size={24} />
        </div>
        <h4 className="text-base font-semibold text-foreground">No API Keys Connected</h4>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          Add your Google AI Studio (Gemini) API key here or directly when creating a New Bot.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Mobile Card View (< sm) and Desktop Table View (>= sm) */}
      <div className="grid grid-cols-1 gap-4">
        {apiKeys.map((k) => {
          const isActive = (k.status || 'active').toLowerCase() === 'active';
          const displayKey = k.key ? (k.key.includes('...') ? k.key : `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}`) : '****';
          const botsCount = k.botsCount ?? (k.botNames?.length || 0);
          const activeBotsCount = k.activeBotsCount ?? (k.botNames?.filter(b => b.isActive).length || 0);

          return (
            <div 
              key={k.id} 
              className="p-4 sm:p-5 rounded-xl border border-border/60 bg-card hover:border-border transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Left Column: Account Details & Bots */}
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                    <Key size={14} />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
                    {k.label || "Gemini Account"}
                  </h3>
                  <Badge variant={isActive ? "success" : "destructive"} className="text-[11px] py-0">
                    {isActive ? "Active" : "Paused"}
                  </Badge>
                </div>

                {/* Gmail & Key */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">{k.gmail}</span>
                  <span className="font-mono bg-secondary/80 px-2 py-0.5 rounded text-[11px] border border-border/50">
                    {displayKey}
                  </span>
                </div>

                {/* Bots running on this key */}
                <div className="pt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Bot size={13} className="text-primary" />
                    AI Bots Running: <strong className="text-foreground">{activeBotsCount} active</strong> / {botsCount} total
                  </span>
                  
                  {k.botNames && k.botNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 sm:mt-0">
                      {k.botNames.map(b => (
                        <span 
                          key={b.id} 
                          className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${b.isActive ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-secondary text-muted-foreground border-border/40'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${b.isActive ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                          {b.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Middle Column: Activity Stats */}
              <div className="flex items-center gap-6 py-2 md:py-0 border-y md:border-y-0 border-border/40 text-xs shrink-0">
                <div>
                  <p className="text-muted-foreground text-[11px]">Today's Requests</p>
                  <p className="font-bold text-foreground text-sm">{k.requestsToday ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Last Activity</p>
                  <p className="font-medium text-foreground">
                    {k.lastUsed ? new Date(k.lastUsed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                  </p>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex items-center justify-end gap-2 shrink-0">
                {onToggleStatus && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-9 px-3 text-xs gap-1.5 ${isActive ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10' : 'text-green-400 hover:text-green-300 hover:bg-green-500/10'}`}
                    onClick={() => onToggleStatus(k.id, isActive ? 'paused' : 'active')}
                    title={isActive ? "Pause Key" : "Activate Key"}
                  >
                    <Power size={13} />
                    <span>{isActive ? "Pause" : "Activate"}</span>
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 px-2.5" 
                  onClick={() => onEdit(k)} 
                  title="Edit Key & Gmail"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>

                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="h-9 px-2.5" 
                  onClick={() => onDelete(k.id)} 
                  title="Delete Key"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  )
}

"use client"

import * as React from "react"
import { Edit2, Trash2, Key, Bot, Power } from "lucide-react"
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
      <div className="text-center p-8 sm:p-12 border border-dashed border-[#E6E2D8] dark:border-[#262930] rounded-2xl bg-transparent">
        <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-center justify-center mx-auto mb-3 text-amber-600 dark:text-amber-400">
          <Key size={24} />
        </div>
        <h4 className="text-base font-bold text-gray-900 dark:text-white">No API Keys Connected</h4>
        <p className="text-xs sm:text-sm text-[#4B5563] dark:text-[#9CA3AF] mt-1 max-w-sm mx-auto">
          Add your Google AI Studio (Gemini) API key here or directly when creating a New Bot.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        {apiKeys.map((k) => {
          const isActive = (k.status || 'active').toLowerCase() === 'active';
          const displayKey = k.key ? (k.key.includes('...') ? k.key : `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}`) : '****';
          const botsCount = k.botsCount ?? (k.botNames?.length || 0);
          const activeBotsCount = k.activeBotsCount ?? (k.botNames?.filter(b => b.isActive).length || 0);

          return (
            <div 
              key={k.id} 
              className="p-4 sm:p-5 rounded-2xl border transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FBF9F4] dark:bg-[#15171C] border-[#E6E2D8] dark:border-[#22252C] hover:border-gray-400 dark:hover:border-[#323640]"
            >
              {/* Left Column: Account Details & Bots */}
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                    <Key size={16} />
                  </div>
                  <h3 className="font-black text-gray-900 dark:text-white text-base sm:text-lg">
                    {k.label || "Gemini Account"}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    isActive 
                      ? "bg-[#16A34A] text-white" 
                      : "bg-amber-600 text-white"
                  }`}>
                    {isActive ? "Active" : "Paused"}
                  </span>
                </div>

                {/* Gmail & Key */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-800 dark:text-gray-200">
                  <span className="font-bold text-gray-900 dark:text-gray-100">{k.gmail}</span>
                  <span className="font-mono font-bold bg-[#E8E4DA] dark:bg-[#121418] text-gray-900 dark:text-gray-100 px-3 py-1 rounded-lg text-xs border border-[#DDD7CB] dark:border-[#262930] tracking-wider">
                    {displayKey}
                  </span>
                </div>

                {/* Bots running on this key */}
                <div className="pt-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <Bot size={15} className="text-[#164E43] dark:text-emerald-400" />
                    AI Bots Running: <strong className="text-gray-900 dark:text-white font-extrabold">{activeBotsCount} active</strong> / {botsCount} total
                  </span>
                  
                  {k.botNames && k.botNames.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1 sm:mt-0">
                      {k.botNames.map(b => (
                        <span 
                          key={b.id} 
                          className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${
                            b.isActive 
                              ? 'bg-[#DCFCE7] dark:bg-[#143825] text-[#15803D] dark:text-[#86EFAC] border-[#BBF7D0] dark:border-[#1D5438]' 
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${b.isActive ? 'bg-[#15803D] dark:bg-[#86EFAC]' : 'bg-gray-400'}`} />
                          {b.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Middle Column: Activity Stats */}
              <div className="flex items-center gap-6 py-2 md:py-0 border-y md:border-y-0 border-[#E6E2D8] dark:border-[#22252C] shrink-0">
                <div>
                  <p className="text-gray-700 dark:text-gray-400 text-xs font-bold">Today's Requests</p>
                  <p className="font-black text-gray-900 dark:text-white text-base sm:text-lg">{k.requestsToday ?? 0}</p>
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-400 text-xs font-bold">Last Activity</p>
                  <p className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">
                    {k.lastUsed ? new Date(k.lastUsed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                  </p>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex items-center justify-end gap-2 shrink-0">
                {onToggleStatus && (
                  <button
                    onClick={() => onToggleStatus(k.id, isActive ? 'paused' : 'active')}
                    className={`h-9 px-4 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm ${
                      isActive 
                        ? 'bg-[#FEEBC8] text-[#975A16] hover:bg-[#FBD38D] dark:bg-[#E5A93C] dark:hover:bg-[#D4992C] dark:text-[#1A1400]' 
                        : 'bg-[#164E43] text-white hover:bg-[#124238]'
                    }`}
                    title={isActive ? "Pause Key" : "Activate Key"}
                  >
                    <Power size={14} />
                    <span>{isActive ? "Pause" : "Activate"}</span>
                  </button>
                )}
                
                <button 
                  className="h-9 px-3.5 rounded-xl border border-[#E6E2D8] dark:border-[#262930] bg-[#FAF8F5] dark:bg-[#181A1F] text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center cursor-pointer shadow-sm" 
                  onClick={() => onEdit(k)} 
                  title="Edit Key & Gmail"
                >
                  <Edit2 className="h-4 w-4" />
                </button>

                <button 
                  className="h-9 px-3.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center cursor-pointer shadow-sm" 
                  onClick={() => onDelete(k.id)} 
                  title="Delete Key"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  )
}

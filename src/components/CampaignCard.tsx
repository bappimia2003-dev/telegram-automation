"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  FileCheck, 
  Send, 
  Tag, 
  ExternalLink, 
  Trash2, 
  Clock,
  Sparkles,
  Layers,
  Bot,
  ChevronDown
} from 'lucide-react';
import { WaCampaign, WaConnection } from '@/lib/whatsappTypes';

interface CampaignCardProps {
  campaign: WaCampaign;
  accounts?: WaConnection[];
  account?: WaConnection;
  defaultExpanded?: boolean;
  onToggleActive?: (id: string, active: boolean) => void;
  onDelete?: (id: string) => void;
}

export function CampaignCard({ campaign, accounts, account, defaultExpanded = false, onToggleActive, onDelete }: CampaignCardProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [localAccounts, setLocalAccounts] = useState<WaConnection[]>(() => {
    if (accounts && accounts.length > 0) return accounts;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('wa_cached_accounts');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });

  React.useEffect(() => {
    if (accounts && accounts.length > 0) {
      setLocalAccounts(accounts);
      return;
    }
    if (campaign.accountId && campaign.accountId !== 'all') {
      fetch(`/api/whatsapp/accounts?t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data.ok && Array.isArray(data.accounts)) {
            setLocalAccounts(data.accounts);
          }
        })
        .catch(() => {});
    }
  }, [accounts, campaign.accountId]);

  const assignedAccount = account || localAccounts.find(a => a.id === campaign.accountId);

  const accountDisplay = React.useMemo(() => {
    if (!campaign.accountId || campaign.accountId === 'all') {
      return {
        label: 'All Numbers',
        isAll: true,
      };
    }
    if (assignedAccount) {
      const cleanPhone = assignedAccount.phoneNumber ? `(+${assignedAccount.phoneNumber.replace(/^\+/, '')})` : '';
      const name = assignedAccount.name || 'Account';
      return {
        label: cleanPhone ? `${name} ${cleanPhone}` : name,
        isAll: false,
      };
    }
    if (campaign.accountId === 'main') {
      return {
        label: 'Primary WhatsApp',
        isAll: false,
      };
    }
    return {
      label: campaign.accountId,
      isAll: false,
    };
  }, [campaign.accountId, assignedAccount]);

  const [isActive, setIsActive] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`wa_camp_active_${campaign.id}`);
      if (cached !== null) return cached === 'true';
    }
    return Boolean(campaign.isActive);
  });
  const [isToggling, setIsToggling] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`wa_camp_active_${campaign.id}`);
      if (cached !== null) {
        setIsActive(cached === 'true');
        return;
      }
    }
    setIsActive(Boolean(campaign.isActive));
  }, [campaign.id, campaign.isActive]);

  const handleToggle = async (checked: boolean) => {
    setIsActive(checked);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`wa_camp_active_${campaign.id}`, String(checked));
    }
    setIsToggling(true);
    try {
      const res = await fetch(`/api/whatsapp/campaigns/${campaign.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: checked }),
      });
      const data = await res.json();
      if (!data.ok) {
        setIsActive(!checked); // Revert
        if (typeof window !== 'undefined') {
          localStorage.setItem(`wa_camp_active_${campaign.id}`, String(!checked));
        }
      } else if (onToggleActive) {
        onToggleActive(campaign.id, checked);
      }
    } catch {
      setIsActive(!checked);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`wa_camp_active_${campaign.id}`, String(!checked));
      }
    } finally {
      setIsToggling(false);
    }
  };

  const keywordsList = (campaign.keywords || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  const activeVariants = (campaign.variants && campaign.variants.length > 0)
    ? campaign.variants.filter(v => v.isActive)
    : [];

  const hasMedia = {
    text: Boolean(campaign.welcomeMessage?.trim()) || activeVariants.some(v => Boolean(v.welcomeMessage?.trim())),
    image: Boolean(campaign.imageUrl?.trim()) || activeVariants.some(v => Boolean(v.imageUrl?.trim())),
    video: Boolean(campaign.videoUrl?.trim()) || activeVariants.some(v => Boolean(v.videoUrl?.trim())),
    audio: Boolean(campaign.audioUrl?.trim()) || activeVariants.some(v => Boolean(v.audioUrl?.trim())),
    document: Boolean(campaign.documentUrl?.trim()) || activeVariants.some(v => Boolean(v.documentUrl?.trim())),
  };

  return (
    <div className="rounded-[20px] overflow-hidden bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E4DFD2] dark:border-[#262930] shadow-xs hover:border-[#164E43]/40 transition-all duration-200 flex flex-col h-fit self-start w-full">
      {/* Mini Header Banner (Matching WhatsApp Numbers style exactly) */}
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full border-0 p-0 text-left bg-[#164E43] dark:bg-[#13443A] text-white px-4 py-3 min-h-[62px] flex items-center gap-3 active:brightness-95 transition-all select-none cursor-pointer"
      >
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
          isActive ? 'bg-[#4ADE9E] shadow-[0_0_8px_#4ADE9E]' : 'bg-gray-400'
        }`} />

        <div className="flex-1 min-w-0 pr-2">
          <span className="block font-bold text-[15px] font-['Sora',sans-serif] text-white truncate">
            {campaign.name}
          </span>
          <span className="block text-[12.5px] font-medium text-white/90 mt-0.5 font-mono truncate">
            {accountDisplay.label}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge 
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle(!isActive);
            }} 
            className={`text-[9.5px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border-0 cursor-pointer select-none active:scale-95 transition-all ${
              isActive 
                ? 'bg-white/15 text-white hover:bg-white/25' 
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
            title="Click to toggle active"
          >
            {isActive ? 'Active' : 'Offline'}
          </Badge>

          <ChevronDown className={`w-5 h-5 text-white/90 transition-transform duration-300 ${
            isExpanded ? 'rotate-180' : 'rotate-0'
          }`} />
        </div>
      </button>

      {/* Expandable Accordion Body */}
      <div className={`transition-all duration-300 overflow-hidden ${
        isExpanded ? 'max-h-[700px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
      }`}>
        <div className="p-3.5 sm:p-4 space-y-3.5 border-t border-[#E6E2D8] dark:border-[#262930]">
          {/* Badges for Default / Variations / Follow-up */}
          {(campaign.isDefault || (campaign.variants && campaign.variants.length > 1) || campaign.followupConfig?.followupEnabled) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {campaign.isDefault && (
                <Badge variant="outline" className="text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 px-1.5 py-0.5 flex items-center gap-1 rounded-md">
                  <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  Default
                </Badge>
              )}

              {campaign.variants && campaign.variants.length > 1 && (
                <Badge variant="outline" className="text-[10px] font-semibold bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-700 px-1.5 py-0.5 flex items-center gap-1 rounded-md">
                  <Layers className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  {campaign.variants.filter(v => v.isActive).length} Variations
                </Badge>
              )}

              {campaign.followupConfig?.followupEnabled && (
                <Badge variant="outline" className="text-[10px] font-semibold bg-[#E3F1EA] dark:bg-[#1E2D27] text-[#164F43] dark:text-[#5FD1A5] border-[#B7DFCD] dark:border-[#264E3D] px-1.5 py-0.5 flex items-center gap-1 rounded-md">
                  <Bot className="w-3 h-3" />
                  3-Step Follow-up
                </Badge>
              )}
            </div>
          )}

          {/* Description */}
          {campaign.description && (
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {campaign.description}
            </p>
          )}

          {/* Keywords for Facebook quick reply match */}
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-gray-900 dark:text-white flex items-center gap-1">
              <Tag className="w-3 h-3 text-[#164E43] dark:text-[#5FD1A5]" />
              <span>Keywords (Ad Quick Reply Match):</span>
            </div>
            {keywordsList.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {keywordsList.map((kw, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#EDE8DE] dark:bg-[#14161B] text-gray-900 dark:text-white border border-[#DDD7CB] dark:border-[#2C3038]"
                  >
                    "{kw}"
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 italic">No keywords set (Triggers on all if default)</p>
            )}
          </div>

          {/* Configured Files / Media badges */}
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-gray-900 dark:text-white">Auto-Sent Files:</div>
            <div className="flex flex-wrap gap-1">
              {hasMedia.text && (
                <Badge variant="secondary" className="text-[11px] font-medium flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EDE8DE] dark:bg-[#14161B] text-gray-900 dark:text-white border border-[#DDD7CB] dark:border-[#2C3038]">
                  <FileText className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  Text
                </Badge>
              )}
              {hasMedia.image && (
                <Badge variant="secondary" className="text-[11px] font-medium flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EDE8DE] dark:bg-[#14161B] text-gray-900 dark:text-white border border-[#DDD7CB] dark:border-[#2C3038]">
                  <ImageIcon className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Image
                </Badge>
              )}
              {hasMedia.audio && (
                <Badge variant="secondary" className="text-[11px] font-medium flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EDE8DE] dark:bg-[#14161B] text-gray-900 dark:text-white border border-[#DDD7CB] dark:border-[#2C3038]">
                  <Music className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  Audio Note
                </Badge>
              )}
              {hasMedia.video && (
                <Badge variant="secondary" className="text-[11px] font-medium flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EDE8DE] dark:bg-[#14161B] text-gray-900 dark:text-white border border-[#DDD7CB] dark:border-[#2C3038]">
                  <Video className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                  Video
                </Badge>
              )}
              {hasMedia.document && (
                <Badge variant="secondary" className="text-[11px] font-medium flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EDE8DE] dark:bg-[#14161B] text-gray-900 dark:text-white border border-[#DDD7CB] dark:border-[#2C3038]">
                  <FileCheck className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  Document
                </Badge>
              )}
              {!Object.values(hasMedia).some(Boolean) && (
                <span className="text-[11px] font-medium text-gray-500 italic">No media attached</span>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-[#E6E2D8] dark:border-[#262930] text-[11px] font-semibold text-gray-700 dark:text-gray-300">
            <div className="flex items-center gap-1">
              <Send className="w-3 h-3 text-[#164E43] dark:text-[#5FD1A5]" />
              <span>Delivered:</span>
              <strong className="text-gray-900 dark:text-white font-mono text-xs font-bold ml-1">{campaign.totalSent || 0}</strong>
            </div>

            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#164E43] dark:text-[#5FD1A5]" />
              <span>Auto delay</span>
            </div>
          </div>

          {/* Action Buttons: Manage & Logs + Delete */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#E6E2D8] dark:border-[#262930]">
            <Link href={`/whatsapp/campaigns/${campaign.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs font-semibold bg-[#EDE8DE] dark:bg-[#121418] border border-[#DDD7CB] dark:border-[#262930] text-gray-900 dark:text-white hover:bg-[#164E43] hover:text-white transition-colors h-8 rounded-lg">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Manage & Logs
              </Button>
            </Link>

            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(campaign.id)}
                className="text-gray-400 hover:text-red-600 hover:bg-red-500/10 p-1.5 h-8 w-8 rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
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
  Phone,
  Layers,
  Globe,
  Bot
} from 'lucide-react';
import { WaCampaign, WaConnection } from '@/lib/whatsappTypes';

interface CampaignCardProps {
  campaign: WaCampaign;
  accounts?: WaConnection[];
  account?: WaConnection;
  onToggleActive?: (id: string, active: boolean) => void;
  onDelete?: (id: string) => void;
}

export function CampaignCard({ campaign, accounts, account, onToggleActive, onDelete }: CampaignCardProps) {
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
    <Card className="border-[#E6E2D8] dark:border-[#262930] bg-[#FBF9F4] dark:bg-[#181A1F] text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-700 transition-all shadow-sm group flex flex-col justify-between rounded-xl">
      <div>
        <CardHeader className="p-3.5 pb-2.5 border-b border-[#E6E2D8] dark:border-[#262930]">
          {/* Top Row: Title & Active Switch */}
          <div className="flex items-center justify-between gap-2.5">
            <CardTitle className="text-sm sm:text-base font-bold text-gray-900 dark:text-white group-hover:text-emerald-500 transition-colors break-words">
              {campaign.name}
            </CardTitle>
            <div className="flex items-center gap-1.5 shrink-0">
              <Switch
                checked={isActive}
                onCheckedChange={handleToggle}
                disabled={isToggling}
                className="scale-90 data-[state=checked]:bg-green-700"
              />
            </div>
          </div>

          {/* Second Row: Badges with full account & phone number */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <Badge 
              variant="outline" 
              className="text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 px-2 py-0.5 flex items-center gap-1 rounded-md"
              title={accountDisplay.label}
            >
              {accountDisplay.isAll ? (
                <Globe className="w-3 h-3 shrink-0 text-emerald-700 dark:text-emerald-400" />
              ) : (
                <Phone className="w-3 h-3 shrink-0 text-emerald-700 dark:text-emerald-400" />
              )}
              <span>{accountDisplay.label}</span>
            </Badge>

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
              <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 px-1.5 py-0.5 flex items-center gap-1 rounded-md">
                <Bot className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                3-Step Follow-up
              </Badge>
            )}
          </div>

          {campaign.description && (
            <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 mt-1.5 line-clamp-2">{campaign.description}</p>
          )}
        </CardHeader>

        <CardContent className="p-3.5 space-y-3">
          {/* Keywords for Facebook quick reply match */}
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-gray-900 dark:text-white flex items-center gap-1">
              <Tag className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
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
              <Send className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
              <span>Delivered:</span>
              <strong className="text-gray-900 dark:text-white font-mono text-xs font-bold ml-1">{campaign.totalSent || 0}</strong>
            </div>

            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
              <span>Auto delay</span>
            </div>
          </div>
        </CardContent>
      </div>

      <div className="p-3 pt-0 flex items-center justify-between gap-2 border-t border-[#E6E2D8] dark:border-[#262930] mt-2">
        <Link href={`/whatsapp/campaigns/${campaign.id}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full text-xs font-semibold bg-[#EDE8DE] dark:bg-[#121418] border border-[#DDD7CB] dark:border-[#262930] text-gray-900 dark:text-white hover:bg-green-700 hover:text-white transition-colors h-8 rounded-lg">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Manage & Logs
          </Button>
        </Link>

        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(campaign.id)}
            className="text-gray-400 hover:text-red-600 hover:bg-red-500/10 p-1.5 h-8 w-8"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );
}

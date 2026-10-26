"use client";

import React, { useState } from 'react';
import Link from 'next/link';
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
  ChevronDown,
  Webhook
} from 'lucide-react';
import { WaCampaign, WaConnection, WaMessageLog } from '@/lib/whatsappTypes';
import { cn } from '@/lib/utils';

interface CampaignCardProps {
  campaign: WaCampaign;
  accounts?: WaConnection[];
  account?: WaConnection;
  logs?: WaMessageLog[];
  defaultExpanded?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onToggleActive?: (id: string, active: boolean) => void;
  onDelete?: (id: string) => void;
}

export function CampaignCard({
  campaign,
  accounts,
  account,
  logs = [],
  defaultExpanded = false,
  selected = false,
  onToggleSelect,
  onToggleActive,
  onDelete
}: CampaignCardProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [localAccounts, setLocalAccounts] = useState<WaConnection[]>(() => {
    if (accounts && accounts.length > 0) return accounts;
    return [];
  });

  React.useEffect(() => {
    if (accounts && accounts.length > 0) {
      setLocalAccounts(accounts);
      return;
    }
    try {
      const cached = localStorage.getItem('wa_cached_accounts');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLocalAccounts(parsed);
        }
      }
    } catch {}
    if (campaign.accountId && campaign.accountId !== 'all') {
      fetch(`/api/whatsapp/accounts?t=${Date.now()}`)
        .then(async res => {
          if (!res.ok) return null;
          const text = await res.text();
          if (!text || text.trim().startsWith('<')) return null;
          return JSON.parse(text);
        })
        .then(data => {
          if (data?.ok && Array.isArray(data.accounts)) {
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

  const [isActive, setIsActive] = useState<boolean>(Boolean(campaign.isActive));
  const [isToggling, setIsToggling] = useState(false);

  React.useEffect(() => {
    setIsActive(Boolean(campaign.isActive));
  }, [campaign.id, campaign.isActive]);

  const handleToggle = async (checked: boolean) => {
    setIsActive(checked);
    try {
      localStorage.setItem(`wa_camp_active_${campaign.id}`, String(checked));
    } catch {}
    setIsToggling(true);
    try {
      const res = await fetch(`/api/whatsapp/campaigns/${campaign.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: checked }),
      });
      const text = await res.text();
      const data = text && !text.trim().startsWith('<') ? JSON.parse(text) : {};
      if (!data.ok) {
        setIsActive(!checked);
        try {
          localStorage.setItem(`wa_camp_active_${campaign.id}`, String(!checked));
        } catch {}
      } else if (onToggleActive) {
        onToggleActive(campaign.id, checked);
      }
    } catch {
      setIsActive(!checked);
      try {
        localStorage.setItem(`wa_camp_active_${campaign.id}`, String(!checked));
      } catch {}
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

  // Compute Delivery Rate & Webhook Status at a glance
  const campLogs = logs.filter(l => l.campaignId === campaign.id);
  const sentLogsCount = campLogs.filter(l => l.status === 'sent').length;
  const failedLogsCount = campLogs.filter(l => l.status === 'failed').length;
  const deliveryRate = (sentLogsCount + failedLogsCount) > 0
    ? Math.round((sentLogsCount / (sentLogsCount + failedLogsCount)) * 1000) / 10
    : 100;

  const isDeviceOnline = accountDisplay.isAll
    ? localAccounts.some(a => a.status === 'connected') || localAccounts.length === 0
    : assignedAccount?.status === 'connected';

  const webhookState = !isActive
    ? { label: 'Muted', tone: 'text-muted-foreground' }
    : isDeviceOnline
    ? { label: 'Listening', tone: 'text-[#075E54] dark:text-[#00A884]' }
    : { label: 'Ready', tone: 'text-amber-600 dark:text-amber-400' };

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden bg-card border day-box-shadow hover:border-[#075E54]/40 dark:hover:border-[#00A884]/40 transition-all duration-150 flex flex-col h-fit self-start w-full',
        selected
          ? 'border-[#075E54] dark:border-[#00A884] ring-1 ring-[#075E54]/30 dark:ring-[#00A884]/30'
          : 'border-border'
      )}
    >
      {/* Header Banner */}
      <div
        onClick={() => setIsExpanded(prev => !prev)}
        className={cn(
          'w-full border-0 text-left hover:bg-secondary/75 text-foreground px-3.5 py-2.5 flex flex-col gap-2 transition-colors select-none cursor-pointer',
          selected ? 'bg-[#075E54]/8 dark:bg-[#00A884]/12' : 'bg-secondary/45'
        )}
      >
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
            {onToggleSelect && (
              <input
                type="checkbox"
                checked={selected}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onToggleSelect(campaign.id)}
                className="w-4 h-4 rounded border-border text-[#075E54] focus:ring-0 cursor-pointer shrink-0"
                title="Select campaign"
              />
            )}
            <div className="min-w-0 flex-1">
              <span className="block font-bold text-sm text-foreground truncate">
                {campaign.name}
              </span>
              <span className="block text-xs text-muted-foreground font-mono truncate">
                {accountDisplay.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                if (!isToggling) handleToggle(!isActive);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  if (!isToggling) handleToggle(!isActive);
                }
              }}
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md cursor-pointer select-none active:scale-95 transition-all ${
                isActive 
                  ? 'bg-[#25D366]/15 text-[#075E54] dark:text-[#00A884]' 
                  : 'bg-secondary text-muted-foreground'
              }`}
              title="Click to toggle active"
            >
              {isActive ? 'Active' : 'Paused'}
            </span>

            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : 'rotate-0'
            }`} />
          </div>
        </div>

        {/* Always-Visible At-a-Glance Metrics Row (Delivery Rate + Webhook Status + Sent) */}
        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/60 w-full text-[11px]">
          <div className="flex items-center gap-1.5">
            <Webhook className={cn("w-3 h-3 shrink-0", webhookState.tone)} />
            <span className="text-muted-foreground">Webhook:</span>
            <strong className={cn("font-bold", webhookState.tone)}>{webhookState.label}</strong>
          </div>

          <div className="flex items-center gap-1.5 font-mono tabular-nums">
            <span className="text-muted-foreground font-sans">Delivery Rate:</span>
            <strong className="text-foreground font-bold">{deliveryRate.toFixed(1)}%</strong>
            <span className="text-muted-foreground">({campaign.totalSent || 0})</span>
          </div>
        </div>
      </div>

      {/* Expandable Accordion Body */}
      <div className={`transition-all duration-200 overflow-hidden ${
        isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
      }`}>
        <div className="p-3.5 space-y-3 border-t border-border">
          {/* Unboxed Metadata Kicker */}
          {(campaign.isDefault || (campaign.variants && campaign.variants.length > 1) || campaign.followupConfig?.followupEnabled) && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              {campaign.isDefault && <span className="text-amber-600 dark:text-amber-400 font-semibold">Default Fallback</span>}
              {campaign.isDefault && ((campaign.variants && campaign.variants.length > 1) || campaign.followupConfig?.followupEnabled) && <span>·</span>}
              {campaign.variants && campaign.variants.length > 1 && (
                <span>{campaign.variants.filter(v => v.isActive).length} Variations</span>
              )}
              {campaign.variants && campaign.variants.length > 1 && campaign.followupConfig?.followupEnabled && <span>·</span>}
              {campaign.followupConfig?.followupEnabled && (
                <span className="text-[#075E54] dark:text-[#00A884] font-semibold">3-Step Follow-up</span>
              )}
            </div>
          )}

          {campaign.description && (
            <p className="text-xs text-muted-foreground">
              {campaign.description}
            </p>
          )}

          {/* Keywords */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Tag className="w-3 h-3 text-[#075E54] dark:text-[#00A884]" />
              <span>Keywords:</span>
            </div>
            {keywordsList.length > 0 ? (
              <p className="text-xs font-medium text-foreground">
                {keywordsList.join(' · ')}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">Auto-Send Sequence</p>
            )}
          </div>

          {/* Configured Media Summary */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {hasMedia.text && <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3 text-blue-500" /> Text</span>}
            {hasMedia.image && <span className="inline-flex items-center gap-1"><ImageIcon className="w-3 h-3 text-emerald-500" /> Image</span>}
            {hasMedia.audio && <span className="inline-flex items-center gap-1"><Music className="w-3 h-3 text-purple-500" /> Audio</span>}
            {hasMedia.video && <span className="inline-flex items-center gap-1"><Video className="w-3 h-3 text-rose-500" /> Video</span>}
            {hasMedia.document && <span className="inline-flex items-center gap-1"><FileCheck className="w-3 h-3 text-amber-500" /> Document</span>}
          </div>

          {/* Stats Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Send className="w-3 h-3 text-[#075E54] dark:text-[#00A884]" />
              <span>Delivered</span>
              <span aria-hidden="true">·</span>
              <strong className="text-foreground font-mono tabular-nums font-bold">{campaign.totalSent || 0}</strong>
            </div>

            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#075E54] dark:text-[#00A884]" />
              <span>{campaign.delayBetweenSends || 2}s delay</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-border">
            <Link href={`/whatsapp/campaigns/${campaign.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs font-bold bg-secondary/60 border-border text-foreground hover:bg-[#075E54] hover:text-white dark:hover:bg-[#00A884] dark:hover:text-[#0B141A] transition-colors h-8 rounded-lg">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                <span>Manage & Logs</span>
              </Button>
            </Link>

            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(campaign.id)}
                className="text-muted-foreground hover:text-red-600 hover:bg-red-500/10 p-1.5 h-8 w-8 rounded-lg"
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

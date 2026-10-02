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
  Sparkles
} from 'lucide-react';
import { WaCampaign } from '@/lib/whatsappTypes';

interface CampaignCardProps {
  campaign: WaCampaign;
  onToggleActive?: (id: string, active: boolean) => void;
  onDelete?: (id: string) => void;
}

export function CampaignCard({ campaign, onToggleActive, onDelete }: CampaignCardProps) {
  const [isActive, setIsActive] = useState(campaign.isActive);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setIsActive(checked);
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
      } else if (onToggleActive) {
        onToggleActive(campaign.id, checked);
      }
    } catch {
      setIsActive(!checked);
    } finally {
      setIsToggling(false);
    }
  };

  const keywordsList = (campaign.keywords || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  const hasMedia = {
    text: Boolean(campaign.welcomeMessage?.trim()),
    image: Boolean(campaign.imageUrl?.trim()),
    video: Boolean(campaign.videoUrl?.trim()),
    audio: Boolean(campaign.audioUrl?.trim()),
    document: Boolean(campaign.documentUrl?.trim()),
  };

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-md hover:border-emerald-500/40 transition-all shadow-md group flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-white group-hover:text-emerald-300 transition-colors">
                  {campaign.name}
                </CardTitle>
                {campaign.isDefault && (
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-300 border-amber-500/30 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Default
                  </Badge>
                )}
              </div>
              {campaign.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">{campaign.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Switch
                checked={isActive}
                onCheckedChange={handleToggle}
                disabled={isToggling}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Keywords for Facebook quick reply match */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Tag className="w-3 h-3 text-emerald-400" />
              Keywords (Ad Quick Reply Match):
            </div>
            {keywordsList.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {keywordsList.map((kw, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-secondary/80 text-foreground border border-border/60"
                  >
                    "{kw}"
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-amber-400/80 italic">No keywords set (Triggers on all if default)</p>
            )}
          </div>

          {/* Configured Files / Media badges */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-muted-foreground">Auto-Sent Files:</div>
            <div className="flex flex-wrap gap-1.5">
              {hasMedia.text && (
                <Badge variant="secondary" className="text-[10px] flex items-center gap-1 bg-secondary/70">
                  <FileText className="w-3 h-3 text-blue-400" />
                  Text
                </Badge>
              )}
              {hasMedia.image && (
                <Badge variant="secondary" className="text-[10px] flex items-center gap-1 bg-secondary/70">
                  <ImageIcon className="w-3 h-3 text-emerald-400" />
                  Image
                </Badge>
              )}
              {hasMedia.audio && (
                <Badge variant="secondary" className="text-[10px] flex items-center gap-1 bg-secondary/70">
                  <Music className="w-3 h-3 text-purple-400" />
                  Audio Note
                </Badge>
              )}
              {hasMedia.video && (
                <Badge variant="secondary" className="text-[10px] flex items-center gap-1 bg-secondary/70">
                  <Video className="w-3 h-3 text-rose-400" />
                  Video
                </Badge>
              )}
              {hasMedia.document && (
                <Badge variant="secondary" className="text-[10px] flex items-center gap-1 bg-secondary/70">
                  <FileCheck className="w-3 h-3 text-amber-400" />
                  Document
                </Badge>
              )}
              {!Object.values(hasMedia).some(Boolean) && (
                <span className="text-[11px] text-muted-foreground italic">No media or message attached</span>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              <span>Delivered:</span>
              <strong className="text-white font-mono text-sm">{campaign.totalSent || 0}</strong>
            </div>

            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{campaign.delayBetweenSends || 3}s delay</span>
            </div>
          </div>
        </CardContent>
      </div>

      <div className="p-4 pt-0 flex items-center justify-between gap-2 border-t border-border/30 mt-3">
        <Link href={`/whatsapp/campaigns/${campaign.id}`} className="flex-1">
          <Button variant="secondary" size="sm" className="w-full text-xs hover:bg-emerald-600 hover:text-white transition-colors">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Manage & Logs
          </Button>
        </Link>

        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(campaign.id)}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );
}

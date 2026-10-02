'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { CampaignForm } from '@/components/CampaignForm';
import { WhatsAppMessageLog } from '@/components/WhatsAppMessageLog';
import { WaCampaign } from '@/lib/whatsappTypes';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, Clock } from 'lucide-react';

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const [campaign, setCampaign] = useState<WaCampaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campaignId) return;

    fetch(`/api/whatsapp/campaigns/${campaignId}?t=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.campaign) {
          setCampaign(data.campaign);
        }
      })
      .catch(err => console.error('Failed fetching campaign:', err))
      .finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) {
    return (
      <div className="py-20 text-center animate-pulse text-muted-foreground text-sm">
        Loading campaign details...
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="py-20 text-center text-muted-foreground text-sm">
        Campaign not found or has been deleted.
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Campaign Summary Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card/60 border border-border/60 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">{campaign.name}</h1>
            {campaign.isActive ? (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-xs">
                Paused
              </Badge>
            )}
            {campaign.isDefault && (
              <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Default Fallback
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{campaign.description || 'No description provided'}</p>
        </div>

        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Send className="w-4 h-4 text-emerald-400" />
            <span>Delivered:</span>
            <strong className="text-white font-mono text-base">{campaign.totalSent || 0}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>Delay:</span>
            <strong className="text-white">{campaign.delayBetweenSends || 3}s</strong>
          </div>
        </div>
      </div>

      {/* Campaign Edit Form */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Edit Campaign Assets & Rules</h2>
        <CampaignForm initialData={campaign} isEditing={true} />
      </div>

      {/* Delivery Logs Specific to this campaign */}
      <div className="pt-6 border-t border-border/40">
        <WhatsAppMessageLog campaignId={campaign.id} />
      </div>
    </div>
  );
}

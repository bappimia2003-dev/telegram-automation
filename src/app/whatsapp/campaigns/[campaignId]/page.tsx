'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { CampaignForm } from '@/components/CampaignForm';
import { WhatsAppMessageLog } from '@/components/WhatsAppMessageLog';
import { WaCampaign, WaConnection } from '@/lib/whatsappTypes';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, Clock, Phone, Globe } from 'lucide-react';

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const [campaign, setCampaign] = useState<WaCampaign | null>(null);
  const [accounts, setAccounts] = useState<WaConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campaignId) return;

    Promise.all([
      fetch(`/api/whatsapp/campaigns/${campaignId}?t=${Date.now()}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/whatsapp/accounts?t=${Date.now()}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ accounts: [] }))
    ])
      .then(([campData, accData]) => {
        if (campData.ok && campData.campaign) {
          setCampaign(campData.campaign);
        }
        if (accData.ok && Array.isArray(accData.accounts)) {
          setAccounts(accData.accounts);
        }
      })
      .catch(err => console.error('Failed fetching campaign:', err))
      .finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) {
    return (
      <div className="py-20 text-center animate-pulse text-gray-500 text-sm">
        Loading campaign details...
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="py-20 text-center text-gray-500 text-sm">
        Campaign not found or has been deleted.
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Campaign Summary Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] shadow-sm">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{campaign.name}</h1>
            {campaign.isActive ? (
              <Badge className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-gray-500 border-[#E6E2D8] dark:border-[#262930] text-xs">
                Paused
              </Badge>
            )}
            {campaign.isDefault && (
              <Badge variant="outline" className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-xs flex items-center gap-1 font-semibold">
                <Sparkles className="w-3 h-3 text-amber-600" />
                Default Fallback
              </Badge>
            )}
            {(() => {
              const acc = accounts.find(a => a.id === campaign.accountId);
              const isAll = !campaign.accountId || campaign.accountId === 'all';
              const cleanPhone = acc?.phoneNumber ? `(+${acc.phoneNumber.replace(/^\+/, '')})` : '';
              const label = isAll
                ? 'All Numbers'
                : acc
                ? `${acc.name || 'Account'} ${cleanPhone}`.trim()
                : campaign.accountId === 'main'
                ? 'Primary WhatsApp'
                : campaign.accountId;
              return (
                <Badge variant="outline" className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 flex items-center gap-1 font-medium">
                  {isAll ? <Globe className="w-3 h-3 text-emerald-600" /> : <Phone className="w-3 h-3 text-emerald-600" />}
                  {label}
                </Badge>
              );
            })()}
          </div>
          <p className="text-sm text-gray-500">{campaign.description || 'No description provided'}</p>
        </div>

        <div className="flex items-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Send className="w-4 h-4 text-emerald-600" />
            <span>Delivered:</span>
            <strong className="text-gray-900 dark:text-white font-mono text-base font-bold">{campaign.totalSent || 0}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Delay:</span>
            <strong className="text-gray-900 dark:text-white font-semibold">Auto (Randomized)</strong>
          </div>
        </div>
      </div>

      {/* Campaign Edit Form */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Edit Campaign Assets & Rules</h2>
        <CampaignForm 
          initialData={campaign} 
          isEditing={true} 
          returnTo={campaign.accountId && campaign.accountId !== 'all' ? `/whatsapp/numbers/${campaign.accountId}` : '/whatsapp'}
        />
      </div>

      {/* Delivery Logs Specific to this campaign */}
      <div className="pt-6 border-t border-[#E6E2D8] dark:border-[#262930]">
        <WhatsAppMessageLog campaignId={campaign.id} />
      </div>
    </div>
  );
}

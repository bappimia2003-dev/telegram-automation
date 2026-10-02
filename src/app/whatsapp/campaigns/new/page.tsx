'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CampaignForm } from '@/components/CampaignForm';

function NewCampaignContent() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('accountId') || 'all';

  return <CampaignForm isEditing={false} initialData={{ accountId }} />;
}

export default function NewCampaignPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
          Create Ad Campaign
        </h1>
        <p className="text-xs text-muted-foreground">
          Configure product keywords, audio/video/image assets, and delivery rules for incoming WhatsApp leads.
        </p>
      </div>

      <Suspense fallback={<div className="h-64 rounded-xl bg-card/40 animate-pulse" />}>
        <NewCampaignContent />
      </Suspense>
    </div>
  );
}

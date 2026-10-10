'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CampaignForm } from '@/components/CampaignForm';

function NewCampaignContent() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('accountId') || 'all';
  const clientId = searchParams.get('clientId') || undefined;
  const returnTo = searchParams.get('returnTo') || (clientId ? '/whatsapp/clients' : '');

  return <CampaignForm isEditing={false} initialData={{ accountId, clientId }} returnTo={returnTo} />;
}

export default function NewCampaignPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Create Ad Campaign
        </h1>
      </div>

      <Suspense fallback={<div className="h-64 rounded-2xl bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] animate-pulse" />}>
        <NewCampaignContent />
      </Suspense>
    </div>
  );
}

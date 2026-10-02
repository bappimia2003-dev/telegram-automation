'use client';

import React from 'react';
import { CampaignForm } from '@/components/CampaignForm';

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

      <CampaignForm isEditing={false} />
    </div>
  );
}

export interface WaCampaignVariant {
  id: string;
  name: string;
  isActive: boolean;
  welcomeMessage: string;
  imageUrl: string;
  audioUrl: string;
  videoUrl: string;
  documentUrl: string;
  documentName: string;
}

export interface WaFollowupStep {
  stepNumber: number; // 1, 2, 3
  title?: string;
  delayText?: string;
  message?: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  documentUrl?: string;
  documentName?: string;
  files?: Array<{ id: string; name: string; url: string; type: string; size?: number }>;
}

export interface WaFollowupConfig {
  aiEnabled: boolean;
  aiApiKey?: string;
  aiModel?: string;
  aiSystemPrompt?: string;
  understandingText?: string;
  followupEnabled: boolean;
  followupDelayValue?: number;
  followupDelayUnit?: 'minutes' | 'hours' | 'days';
  followupCondition?: 'no_reply' | 'unconfirmed' | 'always';
  antiBanJitter?: boolean;
  steps?: WaFollowupStep[];
  followupMessage?: string;
  followupImageUrl?: string;
  followupVideoUrl?: string;
  followupAudioUrl?: string;
  followupDocumentUrl?: string;
  followupDocumentName?: string;
  followupFiles?: Array<{ id: string; name: string; url: string; type: string; size?: number }>;
}

export interface WaCampaign {
  id: string;
  name: string;
  description: string;
  keywords: string;
  isDefault: boolean;
  welcomeMessage: string;
  imageUrl: string;
  audioUrl: string;
  videoUrl: string;
  documentUrl: string;
  documentName: string;
  variants?: WaCampaignVariant[];
  sendOrder: string;
  delayBetweenSends: number;
  accountId?: string;
  followupConfig?: WaFollowupConfig;
  isActive: boolean;
  chatReplyEnabled: boolean;
  totalSent: number;
  createdAt: string;
  updatedAt: string;
}

export interface WaContactedUser {
  id: string;
  campaignId: string;
  phoneNumber: string;
  contactName: string;
  sentAt: string;
  status: 'sent' | 'failed' | 'pending';
}

export interface WaMessageLog {
  id: string;
  campaignId: string;
  phoneNumber: string;
  contactName: string;
  messageType: 'image' | 'video' | 'audio' | 'text' | 'document';
  fileUrl: string;
  status: 'sent' | 'failed';
  errorMessage: string;
  sentAt: string;
}

export interface WaConnection {
  id: string;
  name?: string;
  phoneNumber: string;
  status: 'connected' | 'disconnected' | 'qr_pending' | 'connecting';
  qrCode: string;
  lastConnected: string;
  createdAt: string;
}

export type WaAccount = WaConnection;

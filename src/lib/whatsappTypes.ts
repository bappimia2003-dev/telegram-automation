// =============================================
// WhatsApp Automation System - Type Definitions
// =============================================

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

export interface WaCampaign {
  id: string;
  name: string;
  description: string;

  // Keyword matching (Facebook Ads quick reply buttons)
  keywords: string; // comma-separated: "gemini pro,gemini,pro"
  isDefault: boolean; // keyword match না হলে এটার files যাবে

  // Auto-send media files (Default / Variant 1)
  welcomeMessage: string;
  imageUrl: string;
  audioUrl: string;
  videoUrl: string;
  documentUrl: string;
  documentName: string;

  // Multiple variations / A/B rotation
  variants?: WaCampaignVariant[];

  // Send order & delay
  sendOrder: string; // comma-separated: 'message,image,video,audio,document'
  delayBetweenSends: number; // seconds

  // WhatsApp Account Assignment
  accountId?: string; // 'all' or specific account id

  // AI Automation & Intelligent Follow-up Configuration
  followupConfig?: WaFollowupConfig;

  // Controls
  isActive: boolean;
  chatReplyEnabled: boolean;

  // Stats
  totalSent: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface WaUnderstandingFile {
  id: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
  snippet?: string;
  uploadedAt: string;
}

export interface WaFollowupMediaFile {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'audio' | 'video' | 'document';
  size?: number;
  uploadedAt: string;
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
  files?: WaFollowupMediaFile[];
}

export interface WaFollowupConfig {
  aiEnabled: boolean;
  aiApiKey?: string;
  aiModel?: string;
  aiSystemPrompt?: string;

  // Understanding files for AI context (knowledge base)
  understandingFiles?: WaUnderstandingFile[];
  understandingText?: string;

  // Timing & Schedule ("some time later follow up")
  followupEnabled: boolean;
  followupDelayValue?: number;
  followupDelayUnit?: 'minutes' | 'hours' | 'days';
  followupCondition?: 'no_reply' | 'unconfirmed' | 'always';
  antiBanJitter?: boolean;
  minDelayMinutes?: number;
  maxDelayMinutes?: number;
  minBatchPeople?: number;
  maxBatchPeople?: number;
  followupVariants?: WaCampaignVariant[];

  // 3-step follow-up system (Step 1: 3-5 min random, Step 2: 3-4h, Step 3: next day)
  steps?: WaFollowupStep[];

  // Given follow-up message & multiple files (legacy/fallback)
  followupMessage?: string;
  followupFiles?: WaFollowupMediaFile[];
  followupImageUrl?: string;
  followupVideoUrl?: string;
  followupAudioUrl?: string;
  followupDocumentUrl?: string;
  followupDocumentName?: string;
}

export interface WaContactedUser {
  id: string;
  campaignId: string;
  phoneNumber: string; // WhatsApp JID e.g. "8801712XXXXX@s.whatsapp.net"
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
  name?: string; // e.g. 'SIM 1 - Gemini', 'SIM 2 - Courses'
  phoneNumber: string;
  status: 'connected' | 'disconnected' | 'qr_pending' | 'connecting';
  qrCode: string;
  lastConnected: string;
  createdAt: string;
}

export type WaAccount = WaConnection;

export interface WaDashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalSent: number;
  uniqueUsers: number;
  connectionStatus: WaConnection['status'];
}

// =============================================
// WhatsApp Automation System - Type Definitions
// =============================================

export interface WaCampaign {
  id: string;
  name: string;
  description: string;

  // Keyword matching (Facebook Ads quick reply buttons)
  keywords: string; // comma-separated: "gemini pro,gemini,pro"
  isDefault: boolean; // keyword match না হলে এটার files যাবে

  // Auto-send media files
  welcomeMessage: string;
  imageUrl: string;
  audioUrl: string;
  videoUrl: string;
  documentUrl: string;
  documentName: string;

  // Send order & delay
  sendOrder: string; // comma-separated: 'message,image,video,audio,document'
  delayBetweenSends: number; // seconds

  // WhatsApp Account Assignment
  accountId?: string; // 'all' or specific account id

  // Controls
  isActive: boolean;
  chatReplyEnabled: boolean;

  // Stats
  totalSent: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
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

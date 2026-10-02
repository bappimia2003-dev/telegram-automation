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
  sendOrder: string;
  delayBetweenSends: number;
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
  phoneNumber: string;
  status: 'connected' | 'disconnected' | 'qr_pending' | 'connecting';
  qrCode: string;
  lastConnected: string;
  createdAt: string;
}

export interface Bot {
  id: string;
  name: string;
  telegramToken: string;
  chatId?: string;
  aiPersonality: string;
  aiDetails: string;
  responseStyle: 'formal' | 'casual' | 'friendly' | 'custom';
  maxTokens: number;
  apiKeyId: string;
  currentModel: string;
  isActive: boolean;
  webhookUrl: string;
  messageCount: number;
  enableVoice?: boolean;
  enableVision?: boolean;
  enableFiles?: boolean;
  enableWebSearch?: boolean;
  createdAt: string;
  updatedAt: string;
}


export interface ApiKey {
  id: string;
  key: string;
  gmail: string;
  label: string;
  status: 'active' | 'rate_limited' | 'exhausted';
  requestsToday: number;
  tokensUsed: number;
  lastUsed: string;
  lastReset: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  botId: string;
  direction: 'incoming' | 'outgoing';
  senderName: string;
  senderId: number;
  text: string;
  aiModel: string;
  apiKeyId: string;
  timestamp: string;
}

export interface DashboardStats {
  totalBots: number;
  activeBots: number;
  totalMessages: number;
  todayMessages: number;
  totalApiKeys: number;
  activeApiKeys: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  displayName: string;
  rpm: number;
  tpd: number;
  priority: number;
}

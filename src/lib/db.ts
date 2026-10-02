import { getSupabase } from './supabase';
import { Bot, ApiKey, ChatMessage, DashboardStats } from './types';

// In-memory fallback for local dev / testing before Supabase env vars are provided
const memoryStore = {
  bots: [] as Bot[],
  apiKeys: [] as ApiKey[],
  messages: {} as Record<string, ChatMessage[]>,
};

// Row mappers for PostgreSQL snake_case <-> TypeScript camelCase
function rowToBot(r: any): Bot {
  let aiDetails = r.ai_details || '';
  let enableVoice = true;
  let enableVision = true;
  let enableFiles = true;
  let enableWebSearch = false;
  let enableWelcomeMedia = false;
  let welcomeImageUrl = '';
  let welcomeAudioUrl = '';
  let welcomeAudioType: 'voice' | 'audio' = 'voice';
  let welcomeVideoUrl = '';
  let welcomeMessage = '';
  let workInfo = '';
  let productFileUrl = '';
  let productFileName = '';
  let productFileContent = '';

  if (typeof aiDetails === 'string' && aiDetails.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(aiDetails);
      aiDetails = parsed.details !== undefined ? parsed.details : '';
      if (parsed.enableVoice !== undefined) enableVoice = Boolean(parsed.enableVoice);
      if (parsed.enableVision !== undefined) enableVision = Boolean(parsed.enableVision);
      if (parsed.enableFiles !== undefined) enableFiles = Boolean(parsed.enableFiles);
      if (parsed.enableWebSearch !== undefined) enableWebSearch = Boolean(parsed.enableWebSearch);
      if (parsed.enableWelcomeMedia !== undefined) enableWelcomeMedia = Boolean(parsed.enableWelcomeMedia);
      if (parsed.welcomeImageUrl !== undefined) welcomeImageUrl = parsed.welcomeImageUrl;
      if (parsed.welcomeAudioUrl !== undefined) welcomeAudioUrl = parsed.welcomeAudioUrl;
      if (parsed.welcomeAudioType !== undefined) welcomeAudioType = parsed.welcomeAudioType;
      if (parsed.welcomeVideoUrl !== undefined) welcomeVideoUrl = parsed.welcomeVideoUrl;
      if (parsed.welcomeMessage !== undefined) welcomeMessage = parsed.welcomeMessage;
      if (parsed.workInfo !== undefined) workInfo = parsed.workInfo;
      if (parsed.productFileUrl !== undefined) productFileUrl = parsed.productFileUrl;
      if (parsed.productFileName !== undefined) productFileName = parsed.productFileName;
      if (parsed.productFileContent !== undefined) productFileContent = parsed.productFileContent;
    } catch {
      // Keep plain text
    }
  }

  if (r.enable_voice !== undefined) enableVoice = Boolean(r.enable_voice);
  if (r.enable_vision !== undefined) enableVision = Boolean(r.enable_vision);
  if (r.enable_files !== undefined) enableFiles = Boolean(r.enable_files);
  if (r.enable_web_search !== undefined) enableWebSearch = Boolean(r.enable_web_search);
  if (r.enable_welcome_media !== undefined) enableWelcomeMedia = Boolean(r.enable_welcome_media);
  if (r.welcome_image_url !== undefined) welcomeImageUrl = r.welcome_image_url;
  if (r.welcome_audio_url !== undefined) welcomeAudioUrl = r.welcome_audio_url;
  if (r.welcome_audio_type !== undefined) welcomeAudioType = r.welcome_audio_type;
  if (r.welcome_video_url !== undefined) welcomeVideoUrl = r.welcome_video_url;
  if (r.welcome_message !== undefined) welcomeMessage = r.welcome_message;
  if (r.work_info !== undefined) workInfo = r.work_info;
  if (r.product_file_url !== undefined) productFileUrl = r.product_file_url;
  if (r.product_file_name !== undefined) productFileName = r.product_file_name;
  if (r.product_file_content !== undefined) productFileContent = r.product_file_content;

  return {
    id: r.id,
    name: r.name,
    telegramToken: r.telegram_token,
    chatId: r.chat_id || undefined,
    aiPersonality: r.ai_personality || '',
    aiDetails,
    responseStyle: (r.response_style as any) || 'friendly',
    maxTokens: r.max_tokens ?? 500,
    apiKeyId: r.api_key_id || '',
    currentModel: r.current_model || 'gemini-2.5-flash',
    isActive: Boolean(r.is_active),
    webhookUrl: r.webhook_url || '',
    messageCount: r.message_count ?? 0,
    enableVoice,
    enableVision,
    enableFiles,
    enableWebSearch,
    enableWelcomeMedia,
    welcomeImageUrl,
    welcomeAudioUrl,
    welcomeAudioType,
    welcomeVideoUrl,
    welcomeMessage,
    workInfo,
    productFileUrl,
    productFileName,
    productFileContent,
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
  };
}

function botToRow(b: Partial<Bot>): any {
  const row: any = {};
  if (b.id !== undefined) row.id = b.id;
  if (b.name !== undefined) row.name = b.name;
  if (b.telegramToken !== undefined) row.telegram_token = b.telegramToken;
  if (b.chatId !== undefined) row.chat_id = b.chatId;
  if (b.aiPersonality !== undefined) row.ai_personality = b.aiPersonality;
  
  const details = b.aiDetails !== undefined ? b.aiDetails : '';
  row.ai_details = JSON.stringify({
    details,
    enableVoice: b.enableVoice !== undefined ? Boolean(b.enableVoice) : true,
    enableVision: b.enableVision !== undefined ? Boolean(b.enableVision) : true,
    enableFiles: b.enableFiles !== undefined ? Boolean(b.enableFiles) : true,
    enableWebSearch: b.enableWebSearch !== undefined ? Boolean(b.enableWebSearch) : false,
    enableWelcomeMedia: b.enableWelcomeMedia !== undefined ? Boolean(b.enableWelcomeMedia) : false,
    welcomeImageUrl: b.welcomeImageUrl || '',
    welcomeAudioUrl: b.welcomeAudioUrl || '',
    welcomeAudioType: b.welcomeAudioType || 'voice',
    welcomeVideoUrl: b.welcomeVideoUrl || '',
    welcomeMessage: b.welcomeMessage || '',
    workInfo: b.workInfo || '',
    productFileUrl: b.productFileUrl || '',
    productFileName: b.productFileName || '',
    productFileContent: b.productFileContent || '',
  });

  if (b.responseStyle !== undefined) row.response_style = b.responseStyle;
  if (b.maxTokens !== undefined) row.max_tokens = b.maxTokens;
  if (b.apiKeyId !== undefined) row.api_key_id = b.apiKeyId;
  if (b.currentModel !== undefined) row.current_model = b.currentModel;
  if (b.isActive !== undefined) row.is_active = b.isActive;
  if (b.webhookUrl !== undefined) row.webhook_url = b.webhookUrl;
  if (b.messageCount !== undefined) row.message_count = b.messageCount;
  if (b.createdAt !== undefined) row.created_at = b.createdAt;
  if (b.updatedAt !== undefined) row.updated_at = b.updatedAt;
  return row;
}


function rowToApiKey(r: any): ApiKey {
  return {
    id: r.id,
    key: r.key,
    gmail: r.gmail,
    label: r.label || '',
    status: (r.status as any) || 'active',
    requestsToday: r.requests_today ?? 0,
    tokensUsed: r.tokens_used ?? 0,
    lastUsed: r.last_used || new Date().toISOString(),
    lastReset: r.last_reset || new Date().toISOString(),
    createdAt: r.created_at || new Date().toISOString(),
  };
}

function apiKeyToRow(k: Partial<ApiKey>): any {
  const row: any = {};
  if (k.id !== undefined) row.id = k.id;
  if (k.key !== undefined) row.key = k.key;
  if (k.gmail !== undefined) row.gmail = k.gmail;
  if (k.label !== undefined) row.label = k.label;
  if (k.status !== undefined) row.status = k.status;
  if (k.requestsToday !== undefined) row.requests_today = k.requestsToday;
  if (k.tokensUsed !== undefined) row.tokens_used = k.tokensUsed;
  if (k.lastUsed !== undefined) row.last_used = k.lastUsed;
  if (k.lastReset !== undefined) row.last_reset = k.lastReset;
  if (k.createdAt !== undefined) row.created_at = k.createdAt;
  return row;
}

function rowToMessage(r: any): ChatMessage {
  return {
    id: r.id,
    botId: r.bot_id,
    direction: r.direction as any,
    senderName: r.sender_name || '',
    senderId: Number(r.sender_id || 0),
    text: r.text || '',
    aiModel: r.ai_model || '',
    apiKeyId: r.api_key_id || '',
    timestamp: r.timestamp || new Date().toISOString(),
  };
}

// --- BOTS ---
export async function getAllBots(): Promise<Bot[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return memoryStore.bots;
  }
  const { data, error } = await supabase.from('bots').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching bots from Supabase:', error.message);
    return memoryStore.bots;
  }
  return (data || []).map(rowToBot);
}

export async function getBotById(id: string): Promise<Bot | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return memoryStore.bots.find(b => b.id === id) || null;
  }
  const { data, error } = await supabase.from('bots').select('*').eq('id', id).maybeSingle();
  if (error || !data) {
    if (error) console.error('Error fetching bot by id:', error.message);
    return memoryStore.bots.find(b => b.id === id) || null;
  }
  return rowToBot(data);
}

export async function createBot(bot: Bot): Promise<Bot> {
  const supabase = getSupabase();
  if (!supabase) {
    memoryStore.bots.push(bot);
    return bot;
  }
  const row = botToRow(bot);
  const { data, error } = await supabase.from('bots').insert(row).select().single();
  if (error) {
    console.error('Error creating bot in Supabase:', error.message);
    memoryStore.bots.push(bot);
    return bot;
  }
  return rowToBot(data);
}

export async function updateBot(id: string, updates: Partial<Bot>): Promise<Bot | null> {
  const supabase = getSupabase();
  const rowUpdates = botToRow({ ...updates, updatedAt: new Date().toISOString() });

  if (!supabase) {
    const index = memoryStore.bots.findIndex(b => b.id === id);
    if (index === -1) return null;
    memoryStore.bots[index] = { ...memoryStore.bots[index], ...updates, updatedAt: new Date().toISOString() };
    return memoryStore.bots[index];
  }

  const { data, error } = await supabase.from('bots').update(rowUpdates).eq('id', id).select().maybeSingle();
  if (error || !data) {
    if (error) console.error('Error updating bot in Supabase:', error.message);
    const index = memoryStore.bots.findIndex(b => b.id === id);
    if (index === -1) return null;
    memoryStore.bots[index] = { ...memoryStore.bots[index], ...updates, updatedAt: new Date().toISOString() };
    return memoryStore.bots[index];
  }
  return rowToBot(data);
}

export async function deleteBot(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    const before = memoryStore.bots.length;
    memoryStore.bots = memoryStore.bots.filter(b => b.id !== id);
    delete memoryStore.messages[id];
    return memoryStore.bots.length < before;
  }

  // Delete associated messages first
  await supabase.from('chat_messages').delete().eq('bot_id', id);
  const { error } = await supabase.from('bots').delete().eq('id', id);
  if (error) {
    console.error('Error deleting bot from Supabase:', error.message);
    return false;
  }
  return true;
}

// --- API KEYS ---
export async function getAllApiKeys(): Promise<ApiKey[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return memoryStore.apiKeys;
  }
  const { data, error } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching api keys from Supabase:', error.message);
    return memoryStore.apiKeys;
  }
  return (data || []).map(rowToApiKey);
}

export async function getApiKeyById(id: string): Promise<ApiKey | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return memoryStore.apiKeys.find(k => k.id === id) || null;
  }
  const { data, error } = await supabase.from('api_keys').select('*').eq('id', id).maybeSingle();
  if (error || !data) {
    if (error) console.error('Error fetching api key by id:', error.message);
    return memoryStore.apiKeys.find(k => k.id === id) || null;
  }
  return rowToApiKey(data);
}

export async function createApiKey(apiKey: ApiKey): Promise<ApiKey> {
  const supabase = getSupabase();
  if (!supabase) {
    memoryStore.apiKeys.push(apiKey);
    return apiKey;
  }
  const row = apiKeyToRow(apiKey);
  const { data, error } = await supabase.from('api_keys').insert(row).select().single();
  if (error) {
    console.error('Error creating api key in Supabase:', error.message);
    memoryStore.apiKeys.push(apiKey);
    return apiKey;
  }
  return rowToApiKey(data);
}

export async function updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey | null> {
  const supabase = getSupabase();
  const rowUpdates = apiKeyToRow(updates);

  if (!supabase) {
    const index = memoryStore.apiKeys.findIndex(k => k.id === id);
    if (index === -1) return null;
    memoryStore.apiKeys[index] = { ...memoryStore.apiKeys[index], ...updates };
    return memoryStore.apiKeys[index];
  }

  const { data, error } = await supabase.from('api_keys').update(rowUpdates).eq('id', id).select().maybeSingle();
  if (error || !data) {
    if (error) console.error('Error updating api key in Supabase:', error.message);
    const index = memoryStore.apiKeys.findIndex(k => k.id === id);
    if (index === -1) return null;
    memoryStore.apiKeys[index] = { ...memoryStore.apiKeys[index], ...updates };
    return memoryStore.apiKeys[index];
  }
  return rowToApiKey(data);
}

export async function deleteApiKey(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    const before = memoryStore.apiKeys.length;
    memoryStore.apiKeys = memoryStore.apiKeys.filter(k => k.id !== id);
    return memoryStore.apiKeys.length < before;
  }
  const { error } = await supabase.from('api_keys').delete().eq('id', id);
  if (error) {
    console.error('Error deleting api key from Supabase:', error.message);
    return false;
  }
  return true;
}

export async function getActiveApiKeys(): Promise<ApiKey[]> {
  const keys = await getAllApiKeys();
  return keys.filter(k => k.status === 'active');
}

// --- MESSAGES ---
export async function getMessages(botId: string, limit: number = 100): Promise<ChatMessage[]> {
  const supabase = getSupabase();
  if (!supabase) {
    const all = memoryStore.messages[botId] || [];
    return all.slice(-limit);
  }
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('bot_id', botId)
    .order('timestamp', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching chat messages from Supabase:', error.message);
    return (memoryStore.messages[botId] || []).slice(-limit);
  }
  return (data || []).map(rowToMessage);
}

export async function addMessage(message: ChatMessage): Promise<void> {
  const supabase = getSupabase();
  // Also keep in memory as backup
  if (!memoryStore.messages[message.botId]) {
    memoryStore.messages[message.botId] = [];
  }
  memoryStore.messages[message.botId].push(message);
  if (memoryStore.messages[message.botId].length > 500) {
    memoryStore.messages[message.botId].shift();
  }

  if (supabase) {
    const row = {
      id: message.id,
      bot_id: message.botId,
      direction: message.direction,
      sender_name: message.senderName,
      sender_id: message.senderId,
      text: message.text,
      ai_model: message.aiModel,
      api_key_id: message.apiKeyId,
      timestamp: message.timestamp,
    };
    const { error } = await supabase.from('chat_messages').insert(row);
    if (error) {
      console.error('Error inserting chat message into Supabase:', error.message);
    }
  }
}

// --- STATS ---
export async function getDashboardStats(): Promise<DashboardStats> {
  const bots = await getAllBots();
  const apiKeys = await getAllApiKeys();
  const totalMessages = bots.reduce((sum, b) => sum + (b.messageCount || 0), 0);

  return {
    totalBots: bots.length,
    activeBots: bots.filter(b => b.isActive).length,
    totalMessages,
    todayMessages: 0,
    totalApiKeys: apiKeys.length,
    activeApiKeys: apiKeys.filter(k => k.status === 'active').length,
  };
}

export async function incrementBotMessageCount(botId: string): Promise<void> {
  const bot = await getBotById(botId);
  if (bot) {
    await updateBot(botId, { messageCount: (bot.messageCount || 0) + 1 });
  }
}

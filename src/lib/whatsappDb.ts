import { getSupabase } from './supabase';
import { 
  WaCampaign, 
  WaCampaignVariant, 
  WaFollowupConfig,
  WaUnderstandingFile,
  WaFollowupMediaFile,
  WaContactedUser, 
  WaMessageLog, 
  WaConnection, 
  WaDashboardStats 
} from './whatsappTypes';

// =============================================
// In-memory fallback (same pattern as db.ts)
// =============================================
const waMemory = {
  campaigns: [] as WaCampaign[],
  contactedUsers: [] as WaContactedUser[],
  messageLogs: [] as WaMessageLog[],
  connection: {
    id: 'main',
    phoneNumber: '',
    status: 'disconnected' as WaConnection['status'],
    qrCode: '',
    lastConnected: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  } as WaConnection,
};

// =============================================
// Row Mappers (snake_case <-> camelCase)
// =============================================
function parseDescriptionTags(rawDesc: string): { 
  accountId: string; 
  variants: WaCampaignVariant[]; 
  followupConfig?: WaFollowupConfig;
  description: string; 
} {
  let description = rawDesc || '';
  let accountId = 'all';
  let variants: WaCampaignVariant[] = [];
  let followupConfig: WaFollowupConfig | undefined = undefined;

  // Extract [acc:...]
  if (description.includes('[acc:')) {
    const start = description.indexOf('[acc:');
    const end = description.indexOf(']', start);
    if (end !== -1) {
      accountId = description.substring(start + 5, end);
      description = (description.substring(0, start) + description.substring(end + 1)).trim();
    }
  }

  // Extract [vars:...]
  if (description.includes('[vars:')) {
    const start = description.indexOf('[vars:');
    const end = description.indexOf(']', start);
    if (end !== -1) {
      const varsRaw = description.substring(start + 6, end);
      try {
        let decoded = varsRaw;
        if (!varsRaw.startsWith('[')) {
          decoded = Buffer.from(varsRaw, 'base64').toString('utf-8');
        }
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed)) {
          variants = parsed;
        }
      } catch (e) {
        // ignore parse error
      }
      description = (description.substring(0, start) + description.substring(end + 1)).trim();
    }
  }

  // Extract [fup:...]
  if (description.includes('[fup:')) {
    const start = description.indexOf('[fup:');
    const end = description.indexOf(']', start);
    if (end !== -1) {
      const fupRaw = description.substring(start + 5, end);
      try {
        let decoded = fupRaw;
        if (!fupRaw.startsWith('{')) {
          decoded = Buffer.from(fupRaw, 'base64').toString('utf-8');
        }
        followupConfig = JSON.parse(decoded);
      } catch (e) {
        // ignore parse error
      }
      description = (description.substring(0, start) + description.substring(end + 1)).trim();
    }
  }

  return { accountId, variants, followupConfig, description };
}

function rowToCampaign(r: any): WaCampaign {
  const { accountId, variants: parsedVariants, followupConfig, description } = parseDescriptionTags(r.description || '');

  // If no variants array in description, construct default variant 1 from row data
  let variants = parsedVariants;
  if (!variants || variants.length === 0) {
    variants = [
      {
        id: 'var_1',
        name: 'Variation 1',
        isActive: true,
        welcomeMessage: r.welcome_message || '',
        imageUrl: r.image_url || '',
        audioUrl: r.audio_url || '',
        videoUrl: r.video_url || '',
        documentUrl: r.document_url || '',
        documentName: r.document_name || '',
      },
    ];
  }

  return {
    id: r.id,
    name: r.name,
    description,
    accountId,
    keywords: r.keywords || '',
    isDefault: Boolean(r.is_default),
    welcomeMessage: r.welcome_message || '',
    imageUrl: r.image_url || '',
    audioUrl: r.audio_url || '',
    videoUrl: r.video_url || '',
    documentUrl: r.document_url || '',
    documentName: r.document_name || '',
    variants,
    followupConfig: followupConfig || (r.followup_config ? (typeof r.followup_config === 'string' ? JSON.parse(r.followup_config) : r.followup_config) : undefined),
    sendOrder: r.send_order || 'message,image,video,audio,document',
    delayBetweenSends: r.delay_between_sends ?? 3,
    isActive: Boolean(r.is_active),
    chatReplyEnabled: Boolean(r.chat_reply_enabled),
    totalSent: r.total_sent ?? 0,
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
  };
}

function campaignToRow(c: Partial<WaCampaign>): any {
  const row: any = {};
  if (c.id !== undefined) row.id = c.id;
  if (c.name !== undefined) row.name = c.name;
  if (c.description !== undefined || c.accountId !== undefined || c.variants !== undefined || c.followupConfig !== undefined) {
    let desc = c.description || '';
    if (c.followupConfig) {
      const base64Fup = Buffer.from(JSON.stringify(c.followupConfig)).toString('base64');
      desc = `[fup:${base64Fup}] ${desc}`;
    }
    if (c.variants && c.variants.length > 0) {
      const base64Vars = Buffer.from(JSON.stringify(c.variants)).toString('base64');
      desc = `[vars:${base64Vars}] ${desc}`;
    }
    if (c.accountId && c.accountId !== 'all') {
      desc = `[acc:${c.accountId}] ${desc}`;
    }
    row.description = desc;
  }
  if (c.keywords !== undefined) row.keywords = c.keywords;
  if (c.isDefault !== undefined) row.is_default = c.isDefault;

  // Set top-level media fields, defaulting to first active variant if variants exist
  let welcomeMsg = c.welcomeMessage;
  let imgUrl = c.imageUrl;
  let audUrl = c.audioUrl;
  let vidUrl = c.videoUrl;
  let docUrl = c.documentUrl;
  let docName = c.documentName;

  if (c.variants && c.variants.length > 0) {
    const primary = c.variants.find((v) => v.isActive) || c.variants[0];
    if (primary) {
      if (welcomeMsg === undefined) welcomeMsg = primary.welcomeMessage;
      if (imgUrl === undefined) imgUrl = primary.imageUrl;
      if (audUrl === undefined) audUrl = primary.audioUrl;
      if (vidUrl === undefined) vidUrl = primary.videoUrl;
      if (docUrl === undefined) docUrl = primary.documentUrl;
      if (docName === undefined) docName = primary.documentName;
    }
  }

  if (welcomeMsg !== undefined) row.welcome_message = welcomeMsg;
  if (imgUrl !== undefined) row.image_url = imgUrl;
  if (audUrl !== undefined) row.audio_url = audUrl;
  if (vidUrl !== undefined) row.video_url = vidUrl;
  if (docUrl !== undefined) row.document_url = docUrl;
  if (docName !== undefined) row.document_name = docName;

  if (c.sendOrder !== undefined) row.send_order = c.sendOrder;
  if (c.delayBetweenSends !== undefined) row.delay_between_sends = c.delayBetweenSends;
  if (c.isActive !== undefined) row.is_active = c.isActive;
  if (c.chatReplyEnabled !== undefined) row.chat_reply_enabled = c.chatReplyEnabled;
  if (c.totalSent !== undefined) row.total_sent = c.totalSent;
  if (c.updatedAt !== undefined) row.updated_at = c.updatedAt;
  if (c.createdAt !== undefined) row.created_at = c.createdAt;
  return row;
}

function rowToContactedUser(r: any): WaContactedUser {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    phoneNumber: r.phone_number,
    contactName: r.contact_name || '',
    sentAt: r.sent_at || new Date().toISOString(),
    status: (r.status as any) || 'sent',
  };
}

function rowToMessageLog(r: any): WaMessageLog {
  let fileUrl = r.file_url || '';
  if (fileUrl.startsWith('data:audio')) fileUrl = 'voice_note.mp3';
  else if (fileUrl.startsWith('data:image')) fileUrl = 'photo.jpg';
  else if (fileUrl.startsWith('data:video')) fileUrl = 'video.mp4';
  else if (fileUrl.startsWith('data:')) fileUrl = 'document.bin';

  return {
    id: r.id,
    campaignId: r.campaign_id,
    phoneNumber: r.phone_number,
    contactName: r.contact_name || '',
    messageType: r.message_type as any,
    fileUrl,
    status: (r.status as any) || 'sent',
    errorMessage: r.error_message || '',
    sentAt: r.sent_at || new Date().toISOString(),
  };
}

function rowToConnection(r: any): WaConnection {
  let name = r.id === 'main' ? 'Primary WhatsApp' : `SIM ${r.id.slice(-4)}`;
  let phoneNumber = r.phone_number || '';
  if (phoneNumber.includes('|')) {
    const parts = phoneNumber.split('|');
    name = parts[0];
    phoneNumber = parts[1];
  }

  return {
    id: r.id || 'main',
    name,
    phoneNumber,
    status: (r.status as any) || 'disconnected',
    qrCode: r.qr_code || '',
    lastConnected: r.last_connected || new Date().toISOString(),
    createdAt: r.created_at || new Date().toISOString(),
  };
}

// =============================================
// CAMPAIGNS CRUD
// =============================================
export async function getAllCampaigns(): Promise<WaCampaign[]> {
  const supabase = getSupabase();
  if (!supabase) return waMemory.campaigns;
  const { data, error } = await supabase.from('wa_campaigns').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching wa_campaigns:', error.message);
    return waMemory.campaigns;
  }
  return (data || []).filter((r: any) => !r.id?.startsWith('system_')).map(rowToCampaign);
}

export async function getActiveCampaigns(): Promise<WaCampaign[]> {
  const all = await getAllCampaigns();
  return all.filter(c => c.isActive);
}

export async function getCampaignById(id: string): Promise<WaCampaign | null> {
  const supabase = getSupabase();
  if (!supabase) return waMemory.campaigns.find(c => c.id === id) || null;
  const { data, error } = await supabase.from('wa_campaigns').select('*').eq('id', id).maybeSingle();
  if (error || !data) {
    if (error) console.error('Error fetching campaign:', error.message);
    return waMemory.campaigns.find(c => c.id === id) || null;
  }
  return rowToCampaign(data);
}

export async function createCampaign(campaign: WaCampaign): Promise<WaCampaign> {
  const supabase = getSupabase();
  if (!supabase) {
    waMemory.campaigns.push(campaign);
    return campaign;
  }
  const row = campaignToRow(campaign);
  const { data, error } = await supabase.from('wa_campaigns').insert(row).select().single();
  if (error) {
    console.error('Error creating campaign:', error.message);
    waMemory.campaigns.push(campaign);
    return campaign;
  }
  return rowToCampaign(data);
}

export async function updateCampaign(id: string, updates: Partial<WaCampaign>): Promise<WaCampaign | null> {
  const supabase = getSupabase();
  const existing = await getCampaignById(id);
  const merged: WaCampaign = {
    ...(existing || ({} as WaCampaign)),
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  const rowUpdates = campaignToRow(merged);

  if (!supabase) {
    const idx = waMemory.campaigns.findIndex(c => c.id === id);
    if (idx === -1) return null;
    waMemory.campaigns[idx] = merged;
    return merged;
  }

  const { data, error } = await supabase.from('wa_campaigns').update(rowUpdates).eq('id', id).select().maybeSingle();
  if (error || !data) {
    if (error) console.error('Error updating campaign:', error.message);
    return null;
  }
  return rowToCampaign(data);
}

export async function deleteCampaign(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    const before = waMemory.campaigns.length;
    waMemory.campaigns = waMemory.campaigns.filter(c => c.id !== id);
    waMemory.contactedUsers = waMemory.contactedUsers.filter(u => u.campaignId !== id);
    waMemory.messageLogs = waMemory.messageLogs.filter(l => l.campaignId !== id);
    return waMemory.campaigns.length < before;
  }
  await supabase.from('wa_message_logs').delete().eq('campaign_id', id);
  await supabase.from('wa_contacted_users').delete().eq('campaign_id', id);
  const { error } = await supabase.from('wa_campaigns').delete().eq('id', id);
  if (error) {
    console.error('Error deleting campaign:', error.message);
    return false;
  }
  return true;
}

export async function incrementCampaignSentCount(id: string): Promise<void> {
  const campaign = await getCampaignById(id);
  if (campaign) {
    await updateCampaign(id, { totalSent: (campaign.totalSent || 0) + 1 });
  }
}

// =============================================
// CONTACTED USERS
// =============================================
export async function isAlreadyContacted(campaignId: string, phoneNumber: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    return waMemory.contactedUsers.some(u => u.campaignId === campaignId && u.phoneNumber === phoneNumber);
  }
  const { data, error } = await supabase
    .from('wa_contacted_users')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('phone_number', phoneNumber)
    .maybeSingle();
  if (error) {
    console.error('Error checking contacted user:', error.message);
    return false;
  }
  return !!data;
}

export async function markAsContacted(entry: WaContactedUser): Promise<void> {
  const supabase = getSupabase();
  waMemory.contactedUsers.push(entry);

  if (supabase) {
    const { error } = await supabase.from('wa_contacted_users').insert({
      id: entry.id,
      campaign_id: entry.campaignId,
      phone_number: entry.phoneNumber,
      contact_name: entry.contactName,
      sent_at: entry.sentAt,
      status: entry.status,
    });
    if (error) {
      console.error('Error marking contacted user:', error.message);
    }
  }
}

export async function getContactedUsers(campaignId: string, limit = 50): Promise<WaContactedUser[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return waMemory.contactedUsers.filter(u => u.campaignId === campaignId).slice(-limit);
  }
  const { data, error } = await supabase
    .from('wa_contacted_users')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('sent_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('Error fetching contacted users:', error.message);
    return [];
  }
  return (data || []).map(rowToContactedUser);
}

export async function getUniqueContactedCount(): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) {
    const uniquePhones = new Set(waMemory.contactedUsers.map(u => u.phoneNumber));
    return uniquePhones.size;
  }
  const { count, error } = await supabase
    .from('wa_contacted_users')
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.error('Error counting unique users:', error.message);
    return 0;
  }
  return count || 0;
}

// =============================================
// MESSAGE LOGS
// =============================================
export async function addMessageLog(log: WaMessageLog): Promise<void> {
  const supabase = getSupabase();
  waMemory.messageLogs.push(log);

  if (supabase) {
    let cleanUrl = log.fileUrl || '';
    if (cleanUrl.startsWith('data:audio')) cleanUrl = 'voice_note.mp3';
    else if (cleanUrl.startsWith('data:image')) cleanUrl = 'photo.jpg';
    else if (cleanUrl.startsWith('data:video')) cleanUrl = 'video.mp4';
    else if (cleanUrl.startsWith('data:')) cleanUrl = 'media.bin';

    const { error } = await supabase.from('wa_message_logs').insert({
      id: log.id,
      campaign_id: log.campaignId,
      phone_number: log.phoneNumber,
      contact_name: log.contactName,
      message_type: log.messageType,
      file_url: cleanUrl,
      status: log.status,
      error_message: log.errorMessage,
      sent_at: log.sentAt,
    });
    if (error) {
      console.error('Error adding message log:', error.message);
    }
  }
}

export async function getMessageLogs(campaignId?: string, limit = 100): Promise<WaMessageLog[]> {
  const supabase = getSupabase();
  if (!supabase) {
    let logs = waMemory.messageLogs;
    if (campaignId) logs = logs.filter(l => l.campaignId === campaignId);
    return logs.slice(-limit);
  }

  let query = supabase.from('wa_message_logs').select('*').order('sent_at', { ascending: false }).limit(limit);
  if (campaignId) query = query.eq('campaign_id', campaignId);

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching message logs:', error.message);
    return [];
  }
  return (data || []).map(rowToMessageLog);
}

// =============================================
// CONNECTION STATE
// =============================================
export async function getAllWaConnections(): Promise<WaConnection[]> {
  const supabase = getSupabase();
  if (!supabase) return waMemory.connection ? [waMemory.connection] : [];

  const { data, error } = await supabase.from('wa_connection').select('*').order('created_at', { ascending: true });
  if (error) {
    console.error('Error fetching wa_connection:', error.message);
    return [];
  }
  if (!data || data.length === 0) {
    return [];
  }
  return data
    .filter((r: any) => !r.id.startsWith('auth_') && !r.id.startsWith('test_') && !r.id.startsWith('file_'))
    .map(rowToConnection);
}

export async function getWaConnection(id = 'main'): Promise<WaConnection | null> {
  if (id.startsWith('auth_')) return null;
  const supabase = getSupabase();
  if (!supabase) return waMemory.connection;

  const { data, error } = await supabase.from('wa_connection').select('*').eq('id', id).maybeSingle();
  if (error || !data) {
    if (error) console.error('Error fetching wa_connection:', error.message);
    return id === 'main' ? waMemory.connection : null;
  }
  return rowToConnection(data);
}

export async function updateWaConnection(updates: Partial<WaConnection> & { id?: string }): Promise<WaConnection> {
  const targetId = updates.id || 'main';
  const supabase = getSupabase();

  if (targetId === 'main' && waMemory.connection) {
    waMemory.connection = { ...waMemory.connection, ...updates };
  }

  if (!supabase) return { ...(waMemory.connection || {}), ...updates, id: targetId } as WaConnection;

  // Retrieve existing to preserve phone and name if not provided
  const existing = await getWaConnection(targetId);

  const finalName = updates.name !== undefined ? updates.name : (existing?.name || (targetId === 'main' ? 'Primary WhatsApp' : `SIM ${targetId.slice(-4)}`));
  const finalPhone = (updates.phoneNumber !== undefined && updates.phoneNumber !== '') ? updates.phoneNumber : (existing?.phoneNumber || '');

  const row: any = { 
    id: targetId,
    phone_number: `${finalName}|${finalPhone}`,
  };

  if (updates.status !== undefined) row.status = updates.status;
  if (updates.qrCode !== undefined) row.qr_code = updates.qrCode;
  if (updates.lastConnected !== undefined) row.last_connected = updates.lastConnected;

  const { data, error } = await supabase
    .from('wa_connection')
    .upsert(row)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error updating wa_connection:', error.message);
    return { ...(existing || {}), ...updates, id: targetId } as WaConnection;
  }
  return data ? rowToConnection(data) : ({ ...(existing || {}), ...updates, id: targetId } as WaConnection);
}

export async function deleteWaConnection(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (id === 'main') {
    (waMemory as any).connection = null;
  }
  if (!supabase) return true;
  const { error } = await supabase.from('wa_connection').delete().eq('id', id);
  if (error) console.error('Error deleting wa_connection:', error.message);
  return !error;
}

// =============================================
// DASHBOARD STATS
// =============================================
export async function getWaDashboardStats(): Promise<WaDashboardStats> {
  // Trigger rolling 30-day cleanup check
  try {
    performRolling30DayCleanup(30);
  } catch {
    // Non-blocking
  }

  const campaigns = await getAllCampaigns();
  const connection = await getWaConnection();
  const uniqueUsers = await getUniqueContactedCount();

  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.isActive).length,
    totalSent: campaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0),
    uniqueUsers,
    connectionStatus: connection?.status || 'disconnected',
  };
}

// =============================================
// ROLLING 30-DAY CLEANUP
// Preserves exactly 30 days of data across website WhatsApp tables.
// Day 31 -> Day 1 data deleted, Day 31 added.
// Day 32 -> Day 2 data deleted, Day 32 added.
// =============================================
export async function performRolling30DayCleanup(days = 30): Promise<{ deletedLogs: number; deletedContacted: number }> {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  let deletedLogs = 0;
  let deletedContacted = 0;

  // 1. In-memory cleanup
  const prevLogsCount = waMemory.messageLogs.length;
  waMemory.messageLogs = waMemory.messageLogs.filter((l) => l.sentAt >= cutoffDate);
  deletedLogs += prevLogsCount - waMemory.messageLogs.length;

  const prevContactedCount = waMemory.contactedUsers.length;
  waMemory.contactedUsers = waMemory.contactedUsers.filter((u) => u.sentAt >= cutoffDate);
  deletedContacted += prevContactedCount - waMemory.contactedUsers.length;

  // 2. Database (Supabase) cleanup
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error: logErr } = await supabase
        .from('wa_message_logs')
        .delete()
        .lt('sent_at', cutoffDate);
      if (logErr) console.error('Error cleaning rolling wa_message_logs:', logErr.message);

      const { error: userErr } = await supabase
        .from('wa_contacted_users')
        .delete()
        .lt('sent_at', cutoffDate);
      if (userErr) console.error('Error cleaning rolling wa_contacted_users:', userErr.message);
    } catch (e: any) {
      console.error('Error in performRolling30DayCleanup:', e.message);
    }
  }

  return { deletedLogs, deletedContacted };
}


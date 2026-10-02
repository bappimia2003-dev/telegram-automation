import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { WaCampaign, WaContactedUser, WaMessageLog, WaConnection } from './types.js';
import { log, errLog } from './utils.js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  log('DB', 'Connected to Supabase successfully');
} else {
  errLog('DB', 'SUPABASE_URL or SUPABASE_KEY missing in environment!');
}

function rowToCampaign(r: any): WaCampaign {
  return {
    id: r.id,
    name: r.name,
    description: r.description || '',
    keywords: r.keywords || '',
    isDefault: Boolean(r.is_default),
    welcomeMessage: r.welcome_message || '',
    imageUrl: r.image_url || '',
    audioUrl: r.audio_url || '',
    videoUrl: r.video_url || '',
    documentUrl: r.document_url || '',
    documentName: r.document_name || '',
    sendOrder: r.send_order || 'message,image,video,audio,document',
    delayBetweenSends: r.delay_between_sends ?? 3,
    isActive: Boolean(r.is_active),
    chatReplyEnabled: Boolean(r.chat_reply_enabled),
    totalSent: r.total_sent ?? 0,
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
  };
}

export async function getActiveCampaigns(): Promise<WaCampaign[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('wa_campaigns')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      errLog('DB', 'Error getting active campaigns:', error.message);
      return [];
    }
    return (data || []).map(rowToCampaign);
  } catch (e: any) {
    errLog('DB', 'Exception getting active campaigns:', e.message);
    return [];
  }
}

export async function isAlreadyContacted(campaignId: string, phoneNumber: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase
      .from('wa_contacted_users')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (error) {
      errLog('DB', 'Error checking contacted user:', error.message);
      return false;
    }
    return Boolean(data);
  } catch (e: any) {
    errLog('DB', 'Exception checking contacted user:', e.message);
    return false;
  }
}

export async function markAsContacted(entry: WaContactedUser): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('wa_contacted_users').insert({
      id: entry.id,
      campaign_id: entry.campaignId,
      phone_number: entry.phoneNumber,
      contact_name: entry.contactName,
      sent_at: entry.sentAt,
      status: entry.status,
    });
    if (error) {
      errLog('DB', 'Error saving contacted user:', error.message);
    }
  } catch (e: any) {
    errLog('DB', 'Exception saving contacted user:', e.message);
  }
}

export async function incrementCampaignSentCount(campaignId: string): Promise<void> {
  if (!supabase) return;
  try {
    const { data } = await supabase.from('wa_campaigns').select('total_sent').eq('id', campaignId).maybeSingle();
    const currentCount = data?.total_sent || 0;
    await supabase.from('wa_campaigns').update({ total_sent: currentCount + 1 }).eq('id', campaignId);
  } catch (e: any) {
    errLog('DB', 'Exception incrementing campaign sent count:', e.message);
  }
}

export async function addMessageLog(logEntry: WaMessageLog): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('wa_message_logs').insert({
      id: logEntry.id,
      campaign_id: logEntry.campaignId,
      phone_number: logEntry.phoneNumber,
      contact_name: logEntry.contactName,
      message_type: logEntry.messageType,
      file_url: logEntry.fileUrl,
      status: logEntry.status,
      error_message: logEntry.errorMessage,
      sent_at: logEntry.sentAt,
    });
    if (error) {
      errLog('DB', 'Error saving message log:', error.message);
    }
  } catch (e: any) {
    errLog('DB', 'Exception saving message log:', e.message);
  }
}

export async function updateWaConnectionState(updates: Partial<WaConnection>): Promise<void> {
  if (!supabase) return;
  try {
    const row: any = {};
    if (updates.phoneNumber !== undefined) row.phone_number = updates.phoneNumber;
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.qrCode !== undefined) row.qr_code = updates.qrCode;
    if (updates.lastConnected !== undefined) row.last_connected = updates.lastConnected;

    await supabase.from('wa_connection').upsert({ id: 'main', ...row });
  } catch (e: any) {
    errLog('DB', 'Exception updating wa_connection state:', e.message);
  }
}

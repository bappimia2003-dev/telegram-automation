import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { WaCampaign, WaContactedUser, WaMessageLog, WaConnection } from './types.js';
import { log, errLog } from './utils.js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vqnoaodavbiyenbqqbib.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_ftsZlmW-ROg_v-d5CtmurQ_ukFS3aEF';

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
  let description = r.description || '';
  let accountId = 'all';

  if (description.startsWith('[acc:')) {
    const endIdx = description.indexOf(']');
    if (endIdx !== -1) {
      accountId = description.substring(5, endIdx);
      description = description.substring(endIdx + 1).trim();
    }
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
    const { error } = await supabase.from('wa_contacted_users').upsert({
      id: entry.id,
      campaign_id: entry.campaignId,
      phone_number: entry.phoneNumber,
      contact_name: entry.contactName,
      sent_at: entry.sentAt,
      status: entry.status,
    }, { onConflict: 'campaign_id,phone_number' });
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
    let cleanUrl = logEntry.fileUrl || '';
    if (cleanUrl.startsWith('data:audio')) cleanUrl = 'voice_note.mp3';
    else if (cleanUrl.startsWith('data:image')) cleanUrl = 'photo.jpg';
    else if (cleanUrl.startsWith('data:video')) cleanUrl = 'video.mp4';
    else if (cleanUrl.startsWith('data:')) cleanUrl = 'media.bin';

    const { error } = await supabase.from('wa_message_logs').insert({
      id: logEntry.id,
      campaign_id: logEntry.campaignId,
      phone_number: logEntry.phoneNumber,
      contact_name: logEntry.contactName,
      message_type: logEntry.messageType,
      file_url: cleanUrl,
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

export async function updateWaConnectionState(accountId: string, updates: Partial<WaConnection>): Promise<void> {
  if (!supabase) return;
  try {
    const targetId = accountId || 'main';
    const row: any = { id: targetId };

    let existingName = targetId === 'main' ? 'Primary WhatsApp' : `SIM ${targetId.slice(-4)}`;
    let existingPhone = '';

    const { data: existing } = await supabase.from('wa_connection').select('phone_number').eq('id', targetId).maybeSingle();
    if (existing?.phone_number && existing.phone_number.includes('|')) {
      const parts = existing.phone_number.split('|');
      existingName = parts[0] || existingName;
      existingPhone = parts.slice(1).join('|');
    }

    const finalName = updates.name !== undefined ? updates.name : existingName;
    const finalPhone = (updates.phoneNumber !== undefined && updates.phoneNumber !== '') ? updates.phoneNumber : existingPhone;
    row.phone_number = `${finalName}|${finalPhone}`;

    if (updates.status !== undefined) row.status = updates.status;
    if (updates.qrCode !== undefined) row.qr_code = updates.qrCode;
    if (updates.lastConnected !== undefined) row.last_connected = updates.lastConnected;

    await supabase.from('wa_connection').upsert(row);
  } catch (e: any) {
    errLog('DB', 'Exception updating wa_connection state:', e.message);
  }
}

export async function getAllDbAccounts(): Promise<WaConnection[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase.from('wa_connection').select('*').order('created_at', { ascending: true });
    return (data || [])
      .filter((r: any) => !r.id.startsWith('auth_') && !r.id.startsWith('test_'))
      .map((r: any) => {
        let name = r.id === 'main' ? 'Primary WhatsApp' : `SIM ${r.id.slice(-4)}`;
        let phoneNumber = r.phone_number || '';
        if (phoneNumber.includes('|')) {
          const parts = phoneNumber.split('|');
          name = parts[0];
          phoneNumber = parts[1];
        }
        return {
          id: r.id,
          name,
          phoneNumber,
          status: r.status,
          qrCode: r.qr_code || '',
          lastConnected: r.last_connected,
          createdAt: r.created_at,
        };
      });
  } catch (e: any) {
    return [];
  }
}

export async function deleteDbAccount(accountId: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('wa_connection').delete().eq('id', accountId);
    await supabase.from('wa_connection').delete().eq('id', `auth_${accountId}`);
  } catch (e: any) {
    errLog('DB', 'Exception deleting account from db:', e.message);
  }
}

export async function backupAuthSession(accountId: string, authDir: string): Promise<boolean> {
  if (!supabase || !fs.existsSync(authDir)) return false;
  try {
    const files = fs.readdirSync(authDir);
    const bundle: Record<string, string> = {};
    for (const file of files) {
      if (!file.startsWith('tctoken-')) {
        const fullPath = path.join(authDir, file);
        try {
          if (fs.statSync(fullPath).isFile()) {
            bundle[file] = fs.readFileSync(fullPath, 'utf-8');
          }
        } catch {}
      }
    }
    if (Object.keys(bundle).length === 0 || !bundle['creds.json']) return false;

    const json = JSON.stringify(bundle);
    const gzipped = zlib.gzipSync(Buffer.from(json, 'utf-8')).toString('base64');

    const { error } = await supabase.from('wa_connection').upsert({
      id: `auth_${accountId}`,
      status: 'synced',
      qr_code: gzipped,
      last_connected: new Date().toISOString(),
    });

    if (error) {
      errLog('AUTH_SYNC', `Failed backing up auth session ${accountId}:`, error.message);
      return false;
    }
    log('AUTH_SYNC', `✅ Backed up auth session for ${accountId} (${(gzipped.length / 1024).toFixed(1)} KB) to Cloud DB.`);
    return true;
  } catch (err: any) {
    errLog('AUTH_SYNC', `Exception backing up session ${accountId}:`, err.message);
    return false;
  }
}

export async function restoreAuthSession(accountId: string, authDir: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    // If creds.json already exists and is non-empty, do not overwrite
    const credsPath = path.join(authDir, 'creds.json');
    if (fs.existsSync(credsPath) && fs.statSync(credsPath).size > 100) {
      return true;
    }

    const { data, error } = await supabase
      .from('wa_connection')
      .select('qr_code')
      .eq('id', `auth_${accountId}`)
      .maybeSingle();

    if (error || !data || !data.qr_code) return false;

    const buffer = Buffer.from(data.qr_code, 'base64');
    const decompressed = zlib.gunzipSync(buffer).toString('utf-8');
    const bundle: Record<string, string> = JSON.parse(decompressed);

    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    for (const [file, content] of Object.entries(bundle)) {
      fs.writeFileSync(path.join(authDir, file), content, 'utf-8');
    }

    log('AUTH_SYNC', `✅ Restored ${Object.keys(bundle).length} auth files for ${accountId} from Cloud DB.`);
    return true;
  } catch (err: any) {
    errLog('AUTH_SYNC', `Exception restoring session ${accountId}:`, err.message);
    return false;
  }
}

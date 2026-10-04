import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { WaCampaign, WaContactedUser, WaMessageLog, WaConnection, WaFollowupConfig } from './types.js';
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

function parseDescriptionTags(rawDesc: string): { accountId: string; variants: any[]; followupConfig: WaFollowupConfig | undefined; description: string } {
  let description = rawDesc || '';
  let accountId = 'all';
  let variants: any[] = [];
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
    sendOrder: r.send_order || 'message,image,video,audio,document',
    delayBetweenSends: r.delay_between_sends ?? 3,
    followupConfig,
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
    return (data || []).filter((r: any) => !r.id?.startsWith('system_')).map(rowToCampaign);
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

/**
 * Persist uploaded media permanently to Supabase Cloud DB so it survives Railway restarts.
 */
export async function saveMediaBackup(filename: string, base64: string, mimeType = 'application/octet-stream'): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('wa_connection').upsert({
      id: `file_${filename}`,
      phone_number: filename,
      qr_code: base64,
      status: mimeType,
      last_connected: new Date().toISOString(),
    });
    log('MEDIA', `💾 Backed up media ${filename} to Cloud DB permanently.`);
  } catch (err: any) {
    errLog('MEDIA', `Error backing up media ${filename}:`, err.message);
  }
}

/**
 * Restore media from Supabase Cloud DB if not present on container disk.
 */
export async function restoreMediaBackup(filename: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('wa_connection')
      .select('qr_code, status')
      .eq('id', `file_${filename}`)
      .maybeSingle();

    if (error || !data || !data.qr_code) return null;

    const buffer = Buffer.from(data.qr_code, 'base64');
    return { buffer, mimeType: data.status || 'application/octet-stream' };
  } catch {
    return null;
  }
}

// ─── Intelligent Multi-Step Follow-up DB Helpers ─────────────────────────────
// No schema changes required: uses wa_message_logs with specific message_type values:
//   'incoming'       -> customer replied (stops auto follow-up / activates manual takeover)
//   'followup_step1' -> Step 1 sent (2 min soft check with AI)
//   'followup_step2' -> Step 2 sent (3-4 hours later with audio/image)
//   'followup_step3' -> Step 3 sent (next day value reminder)
//   'promise_sched'  -> Customer gave a promise date (e.g. "shukrobar nibo")
//   'promise_sent'   -> Promise reminder sent on that date

/**
 * Get active campaigns that have followupEnabled=true.
 * When a campaign has follow-up disabled, it is strictly omitted here.
 */
export async function getCampaignsWithFollowup(): Promise<WaCampaign[]> {
  const all = await getActiveCampaigns();
  return all.filter((c) => c.isActive && c.followupConfig?.followupEnabled === true);
}

/**
 * Get contacts for a campaign from the last 7 days.
 * Ancient contacts from weeks ago are ignored to prevent accidental mass-blasting.
 */
export async function getRecentContactedUsers(
  campaignId: string
): Promise<{ id: string; phoneNumber: string; contactName: string; sentAt: string }[]> {
  if (!supabase) return [];
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('wa_contacted_users')
      .select('id, phone_number, contact_name, sent_at')
      .eq('campaign_id', campaignId)
      .eq('status', 'sent')
      .gte('sent_at', sevenDaysAgo)
      .order('sent_at', { ascending: false });

    if (error) {
      errLog('DB', 'Error fetching recent contacted users:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      phoneNumber: row.phone_number,
      contactName: row.contact_name,
      sentAt: row.sent_at,
    }));
  } catch (e: any) {
    errLog('DB', 'Exception fetching recent contacted users:', e.message);
    return [];
  }
}

/**
 * Get all message logs for a specific contact on a campaign.
 */
export async function getContactLogs(
  campaignId: string,
  phoneNumber: string
): Promise<WaMessageLog[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('wa_message_logs')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('phone_number', phoneNumber)
      .order('sent_at', { ascending: true });

    if (error) return [];
    return (data || []).map((r: any) => ({
      id: r.id,
      campaignId: r.campaign_id,
      phoneNumber: r.phone_number,
      contactName: r.contact_name,
      messageType: r.message_type,
      fileUrl: r.file_url || '',
      status: r.status,
      errorMessage: r.error_message || '',
      sentAt: r.sent_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Log an incoming customer message for reply detection & manual takeover.
 */
export async function logInboundMessage(
  campaignId: string,
  phoneNumber: string,
  contactName: string,
  messageText: string
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('wa_message_logs').insert({
      id: `in_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      campaign_id: campaignId,
      phone_number: phoneNumber,
      contact_name: contactName,
      message_type: 'incoming',
      file_url: '',
      status: 'sent',
      error_message: messageText.slice(0, 500),
      sent_at: new Date().toISOString(),
    });
    log('DB', `Logged inbound message from ${phoneNumber} for campaign ${campaignId}`);
  } catch (err: any) {
    errLog('DB', 'Error logging inbound message:', err.message);
  }
}

/**
 * Clear previous inbound replies & follow-up steps when a campaign is freshly triggered.
 * This guarantees the 2-minute follow-up timer starts clean from the moment the auto-campaign is sent!
 */
export async function clearContactInboundReplies(campaignId: string, phoneNumber: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from('wa_message_logs')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('phone_number', phoneNumber)
      .in('message_type', ['incoming', 'followup_step1', 'followup_step2', 'followup_step3', 'followup']);
  } catch (err: any) {
    // non-fatal
  }
}

/**
 * Find the most recent campaign for a phone number.
 */
export async function findContactCampaign(phoneNumber: string): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('wa_contacted_users')
      .select('campaign_id')
      .eq('phone_number', phoneNumber)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.campaign_id || null;
  } catch {
    return null;
  }
}

/**
 * Record that a follow-up step was sent.
 */
export async function logFollowupStep(
  campaignId: string,
  phoneNumber: string,
  contactName: string,
  step: 1 | 2 | 3,
  messageType: 'text' | 'image' | 'audio' | 'video' | 'document',
  fileUrl = ''
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('wa_message_logs').insert({
      id: `fup${step}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      campaign_id: campaignId,
      phone_number: phoneNumber,
      contact_name: contactName,
      message_type: `followup_step${step}`,
      file_url: fileUrl,
      status: 'sent',
      error_message: '',
      sent_at: new Date().toISOString(),
    });
  } catch (err: any) {
    errLog('DB', `Error logging followup step ${step}:`, err.message);
  }
}

/**
 * Schedule a promise-date reminder (e.g. customer said "shukrobar nibo").
 * Stored in file_url as the target date string "YYYY-MM-DD".
 */
export async function schedulePromiseFollowup(
  campaignId: string,
  phoneNumber: string,
  contactName: string,
  promisedDate: string
): Promise<void> {
  if (!supabase) return;
  try {
    // Delete any previous promise_sched for this contact
    await supabase
      .from('wa_message_logs')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('phone_number', phoneNumber)
      .eq('message_type', 'promise_sched');

    await supabase.from('wa_message_logs').insert({
      id: `prm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      campaign_id: campaignId,
      phone_number: phoneNumber,
      contact_name: contactName,
      message_type: 'promise_sched',
      file_url: promisedDate,
      status: 'sent',
      error_message: '',
      sent_at: new Date().toISOString(),
    });
    log('DB', `📅 Scheduled promise reminder for ${phoneNumber} on ${promisedDate}`);
  } catch (err: any) {
    errLog('DB', 'Error scheduling promise reminder:', err.message);
  }
}

/**
 * Mark that a promise reminder has been sent.
 */
export async function markPromiseSent(
  campaignId: string,
  phoneNumber: string,
  contactName: string
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('wa_message_logs').insert({
      id: `prms_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      campaign_id: campaignId,
      phone_number: phoneNumber,
      contact_name: contactName,
      message_type: 'promise_sent',
      file_url: '',
      status: 'sent',
      error_message: '',
      sent_at: new Date().toISOString(),
    });
  } catch (err: any) {
    errLog('DB', 'Error marking promise sent:', err.message);
  }
}

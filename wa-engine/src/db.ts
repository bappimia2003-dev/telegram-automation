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

// ─── Follow-up Scheduler DB helpers ─────────────────────────────────────────

/**
 * Get all active campaigns that have followupEnabled=true in their [fup:] config.
 * The full WaCampaign objects (with followupConfig parsed) are returned.
 */
export async function getCampaignsWithFollowup(): Promise<WaCampaign[]> {
  const all = await getActiveCampaigns();
  return all.filter(
    (c) => c.followupConfig?.followupEnabled === true
  );
}

// ─── Follow-up column migration ───────────────────────────────────────────────
// Track whether the followup_sent_at column exists. We'll try once on startup.
let followupColumnExists: boolean | null = null;

// In-memory fallback: track which contacted_user IDs have already been sent follow-ups
// This is used when the DB column doesn't exist yet.
const inMemoryFollowupSent = new Set<string>();

export async function ensureFollowupColumn(): Promise<void> {
  if (!supabase) return;
  try {
    // Try a small query that uses followup_sent_at — if it errors, column doesn't exist
    const { error } = await supabase
      .from('wa_contacted_users')
      .select('followup_sent_at')
      .limit(1);
    if (!error) {
      followupColumnExists = true;
      log('DB', '✅ followup_sent_at column exists in wa_contacted_users.');
    } else {
      followupColumnExists = false;
      log('DB', '⚠️ followup_sent_at column not found. Using in-memory tracking as fallback.');
      log('DB', '👉 Run this SQL in Supabase Dashboard: ALTER TABLE wa_contacted_users ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ DEFAULT NULL;');
    }
  } catch (e: any) {
    followupColumnExists = false;
  }
}

/**
 * Get wa_contacted_users rows for a campaign that have NOT yet received a follow-up
 * (followup_sent_at IS NULL) and were contacted at least `delayMs` milliseconds ago.
 */
export async function getPendingFollowupContacts(
  campaignId: string,
  delayMs: number
): Promise<{ id: string; phoneNumber: string; contactName: string; sentAt: string }[]> {
  if (!supabase) return [];
  try {
    let data: any[] | null = null;

    if (followupColumnExists === true) {
      // Optimised query: filter by followup_sent_at IS NULL in DB
      const res = await supabase
        .from('wa_contacted_users')
        .select('id, phone_number, contact_name, sent_at, followup_sent_at')
        .eq('campaign_id', campaignId)
        .is('followup_sent_at', null)
        .eq('status', 'sent');
      if (res.error) {
        // Column may have been dropped — fall back
        followupColumnExists = false;
        data = null;
      } else {
        data = res.data;
      }
    }

    if (data === null) {
      // Fallback: select without followup_sent_at filter, filter in-memory
      const res = await supabase
        .from('wa_contacted_users')
        .select('id, phone_number, contact_name, sent_at')
        .eq('campaign_id', campaignId)
        .eq('status', 'sent');
      if (res.error) {
        errLog('DB', 'Error fetching pending followup contacts (fallback):', res.error.message);
        return [];
      }
      // Filter out already-sent in memory
      data = (res.data || []).filter((row: any) => !inMemoryFollowupSent.has(row.id));
    }

    const now = Date.now();
    return (data || [])
      .filter((row: any) => {
        const sentAt = new Date(row.sent_at).getTime();
        return (now - sentAt) >= delayMs;
      })
      .map((row: any) => ({
        id: row.id,
        phoneNumber: row.phone_number,
        contactName: row.contact_name,
        sentAt: row.sent_at,
      }));
  } catch (e: any) {
    errLog('DB', 'Exception fetching pending followup contacts:', e.message);
    return [];
  }
}

/**
 * Mark a wa_contacted_users row as having received a follow-up message.
 */
export async function markFollowupSent(contactedUserId: string): Promise<void> {
  // Always track in-memory as well (covers both cases)
  inMemoryFollowupSent.add(contactedUserId);

  if (!supabase || followupColumnExists !== true) return;
  try {
    const { error } = await supabase
      .from('wa_contacted_users')
      .update({ followup_sent_at: new Date().toISOString() })
      .eq('id', contactedUserId);
    if (error) {
      errLog('DB', 'Error marking followup sent:', error.message);
    }
  } catch (e: any) {
    errLog('DB', 'Exception marking followup sent:', e.message);
  }
}


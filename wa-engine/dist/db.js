"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveCampaigns = getActiveCampaigns;
exports.isAlreadyContacted = isAlreadyContacted;
exports.markAsContacted = markAsContacted;
exports.incrementCampaignSentCount = incrementCampaignSentCount;
exports.addMessageLog = addMessageLog;
exports.updateWaConnectionState = updateWaConnectionState;
exports.getAllDbAccounts = getAllDbAccounts;
exports.deleteDbAccount = deleteDbAccount;
exports.backupAuthSession = backupAuthSession;
exports.restoreAuthSession = restoreAuthSession;
exports.getCampaignsWithFollowup = getCampaignsWithFollowup;
exports.getRecentContactedUsers = getRecentContactedUsers;
exports.getContactLogs = getContactLogs;
exports.logInboundMessage = logInboundMessage;
exports.findContactCampaign = findContactCampaign;
exports.logFollowupStep = logFollowupStep;
exports.schedulePromiseFollowup = schedulePromiseFollowup;
exports.markPromiseSent = markPromiseSent;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const zlib_1 = __importDefault(require("zlib"));
const utils_js_1 = require("./utils.js");
dotenv_1.default.config();
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vqnoaodavbiyenbqqbib.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_ftsZlmW-ROg_v-d5CtmurQ_ukFS3aEF';
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    (0, utils_js_1.log)('DB', 'Connected to Supabase successfully');
}
else {
    (0, utils_js_1.errLog)('DB', 'SUPABASE_URL or SUPABASE_KEY missing in environment!');
}
function parseDescriptionTags(rawDesc) {
    let description = rawDesc || '';
    let accountId = 'all';
    let variants = [];
    let followupConfig = undefined;
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
            }
            catch (e) {
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
            }
            catch (e) {
                // ignore parse error
            }
            description = (description.substring(0, start) + description.substring(end + 1)).trim();
        }
    }
    return { accountId, variants, followupConfig, description };
}
function rowToCampaign(r) {
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
async function getActiveCampaigns() {
    if (!supabase)
        return [];
    try {
        const { data, error } = await supabase
            .from('wa_campaigns')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        if (error) {
            (0, utils_js_1.errLog)('DB', 'Error getting active campaigns:', error.message);
            return [];
        }
        return (data || []).filter((r) => !r.id?.startsWith('system_')).map(rowToCampaign);
    }
    catch (e) {
        (0, utils_js_1.errLog)('DB', 'Exception getting active campaigns:', e.message);
        return [];
    }
}
async function isAlreadyContacted(campaignId, phoneNumber) {
    if (!supabase)
        return false;
    try {
        const { data, error } = await supabase
            .from('wa_contacted_users')
            .select('id')
            .eq('campaign_id', campaignId)
            .eq('phone_number', phoneNumber)
            .maybeSingle();
        if (error) {
            (0, utils_js_1.errLog)('DB', 'Error checking contacted user:', error.message);
            return false;
        }
        return Boolean(data);
    }
    catch (e) {
        (0, utils_js_1.errLog)('DB', 'Exception checking contacted user:', e.message);
        return false;
    }
}
async function markAsContacted(entry) {
    if (!supabase)
        return;
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
            (0, utils_js_1.errLog)('DB', 'Error saving contacted user:', error.message);
        }
    }
    catch (e) {
        (0, utils_js_1.errLog)('DB', 'Exception saving contacted user:', e.message);
    }
}
async function incrementCampaignSentCount(campaignId) {
    if (!supabase)
        return;
    try {
        const { data } = await supabase.from('wa_campaigns').select('total_sent').eq('id', campaignId).maybeSingle();
        const currentCount = data?.total_sent || 0;
        await supabase.from('wa_campaigns').update({ total_sent: currentCount + 1 }).eq('id', campaignId);
    }
    catch (e) {
        (0, utils_js_1.errLog)('DB', 'Exception incrementing campaign sent count:', e.message);
    }
}
async function addMessageLog(logEntry) {
    if (!supabase)
        return;
    try {
        let cleanUrl = logEntry.fileUrl || '';
        if (cleanUrl.startsWith('data:audio'))
            cleanUrl = 'voice_note.mp3';
        else if (cleanUrl.startsWith('data:image'))
            cleanUrl = 'photo.jpg';
        else if (cleanUrl.startsWith('data:video'))
            cleanUrl = 'video.mp4';
        else if (cleanUrl.startsWith('data:'))
            cleanUrl = 'media.bin';
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
            (0, utils_js_1.errLog)('DB', 'Error saving message log:', error.message);
        }
    }
    catch (e) {
        (0, utils_js_1.errLog)('DB', 'Exception saving message log:', e.message);
    }
}
async function updateWaConnectionState(accountId, updates) {
    if (!supabase)
        return;
    try {
        const targetId = accountId || 'main';
        const row = { id: targetId };
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
        if (updates.status !== undefined)
            row.status = updates.status;
        if (updates.qrCode !== undefined)
            row.qr_code = updates.qrCode;
        if (updates.lastConnected !== undefined)
            row.last_connected = updates.lastConnected;
        await supabase.from('wa_connection').upsert(row);
    }
    catch (e) {
        (0, utils_js_1.errLog)('DB', 'Exception updating wa_connection state:', e.message);
    }
}
async function getAllDbAccounts() {
    if (!supabase)
        return [];
    try {
        const { data } = await supabase.from('wa_connection').select('*').order('created_at', { ascending: true });
        return (data || [])
            .filter((r) => !r.id.startsWith('auth_') && !r.id.startsWith('test_'))
            .map((r) => {
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
    }
    catch (e) {
        return [];
    }
}
async function deleteDbAccount(accountId) {
    if (!supabase)
        return;
    try {
        await supabase.from('wa_connection').delete().eq('id', accountId);
        await supabase.from('wa_connection').delete().eq('id', `auth_${accountId}`);
    }
    catch (e) {
        (0, utils_js_1.errLog)('DB', 'Exception deleting account from db:', e.message);
    }
}
async function backupAuthSession(accountId, authDir) {
    if (!supabase || !fs_1.default.existsSync(authDir))
        return false;
    try {
        const files = fs_1.default.readdirSync(authDir);
        const bundle = {};
        for (const file of files) {
            if (!file.startsWith('tctoken-')) {
                const fullPath = path_1.default.join(authDir, file);
                try {
                    if (fs_1.default.statSync(fullPath).isFile()) {
                        bundle[file] = fs_1.default.readFileSync(fullPath, 'utf-8');
                    }
                }
                catch { }
            }
        }
        if (Object.keys(bundle).length === 0 || !bundle['creds.json'])
            return false;
        const json = JSON.stringify(bundle);
        const gzipped = zlib_1.default.gzipSync(Buffer.from(json, 'utf-8')).toString('base64');
        const { error } = await supabase.from('wa_connection').upsert({
            id: `auth_${accountId}`,
            status: 'synced',
            qr_code: gzipped,
            last_connected: new Date().toISOString(),
        });
        if (error) {
            (0, utils_js_1.errLog)('AUTH_SYNC', `Failed backing up auth session ${accountId}:`, error.message);
            return false;
        }
        (0, utils_js_1.log)('AUTH_SYNC', `✅ Backed up auth session for ${accountId} (${(gzipped.length / 1024).toFixed(1)} KB) to Cloud DB.`);
        return true;
    }
    catch (err) {
        (0, utils_js_1.errLog)('AUTH_SYNC', `Exception backing up session ${accountId}:`, err.message);
        return false;
    }
}
async function restoreAuthSession(accountId, authDir) {
    if (!supabase)
        return false;
    try {
        // If creds.json already exists and is non-empty, do not overwrite
        const credsPath = path_1.default.join(authDir, 'creds.json');
        if (fs_1.default.existsSync(credsPath) && fs_1.default.statSync(credsPath).size > 100) {
            return true;
        }
        const { data, error } = await supabase
            .from('wa_connection')
            .select('qr_code')
            .eq('id', `auth_${accountId}`)
            .maybeSingle();
        if (error || !data || !data.qr_code)
            return false;
        const buffer = Buffer.from(data.qr_code, 'base64');
        const decompressed = zlib_1.default.gunzipSync(buffer).toString('utf-8');
        const bundle = JSON.parse(decompressed);
        if (!fs_1.default.existsSync(authDir)) {
            fs_1.default.mkdirSync(authDir, { recursive: true });
        }
        for (const [file, content] of Object.entries(bundle)) {
            fs_1.default.writeFileSync(path_1.default.join(authDir, file), content, 'utf-8');
        }
        (0, utils_js_1.log)('AUTH_SYNC', `✅ Restored ${Object.keys(bundle).length} auth files for ${accountId} from Cloud DB.`);
        return true;
    }
    catch (err) {
        (0, utils_js_1.errLog)('AUTH_SYNC', `Exception restoring session ${accountId}:`, err.message);
        return false;
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
async function getCampaignsWithFollowup() {
    const all = await getActiveCampaigns();
    return all.filter((c) => c.isActive && c.followupConfig?.followupEnabled === true);
}
/**
 * Get contacts for a campaign from the last 7 days.
 * Ancient contacts from weeks ago are ignored to prevent accidental mass-blasting.
 */
async function getRecentContactedUsers(campaignId) {
    if (!supabase)
        return [];
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
            (0, utils_js_1.errLog)('DB', 'Error fetching recent contacted users:', error.message);
            return [];
        }
        return (data || []).map((row) => ({
            id: row.id,
            phoneNumber: row.phone_number,
            contactName: row.contact_name,
            sentAt: row.sent_at,
        }));
    }
    catch (e) {
        (0, utils_js_1.errLog)('DB', 'Exception fetching recent contacted users:', e.message);
        return [];
    }
}
/**
 * Get all message logs for a specific contact on a campaign.
 */
async function getContactLogs(campaignId, phoneNumber) {
    if (!supabase)
        return [];
    try {
        const { data, error } = await supabase
            .from('wa_message_logs')
            .select('*')
            .eq('campaign_id', campaignId)
            .eq('phone_number', phoneNumber)
            .order('sent_at', { ascending: true });
        if (error)
            return [];
        return (data || []).map((r) => ({
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
    }
    catch {
        return [];
    }
}
/**
 * Log an incoming customer message for reply detection & manual takeover.
 */
async function logInboundMessage(campaignId, phoneNumber, contactName, messageText) {
    if (!supabase)
        return;
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
        (0, utils_js_1.log)('DB', `Logged inbound message from ${phoneNumber} for campaign ${campaignId}`);
    }
    catch (err) {
        (0, utils_js_1.errLog)('DB', 'Error logging inbound message:', err.message);
    }
}
/**
 * Find the most recent campaign for a phone number.
 */
async function findContactCampaign(phoneNumber) {
    if (!supabase)
        return null;
    try {
        const { data } = await supabase
            .from('wa_contacted_users')
            .select('campaign_id')
            .eq('phone_number', phoneNumber)
            .order('sent_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        return data?.campaign_id || null;
    }
    catch {
        return null;
    }
}
/**
 * Record that a follow-up step was sent.
 */
async function logFollowupStep(campaignId, phoneNumber, contactName, step, messageType, fileUrl = '') {
    if (!supabase)
        return;
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
    }
    catch (err) {
        (0, utils_js_1.errLog)('DB', `Error logging followup step ${step}:`, err.message);
    }
}
/**
 * Schedule a promise-date reminder (e.g. customer said "shukrobar nibo").
 * Stored in file_url as the target date string "YYYY-MM-DD".
 */
async function schedulePromiseFollowup(campaignId, phoneNumber, contactName, promisedDate) {
    if (!supabase)
        return;
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
        (0, utils_js_1.log)('DB', `📅 Scheduled promise reminder for ${phoneNumber} on ${promisedDate}`);
    }
    catch (err) {
        (0, utils_js_1.errLog)('DB', 'Error scheduling promise reminder:', err.message);
    }
}
/**
 * Mark that a promise reminder has been sent.
 */
async function markPromiseSent(campaignId, phoneNumber, contactName) {
    if (!supabase)
        return;
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
    }
    catch (err) {
        (0, utils_js_1.errLog)('DB', 'Error marking promise sent:', err.message);
    }
}

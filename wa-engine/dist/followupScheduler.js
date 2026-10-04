"use strict";
/**
 * followupScheduler.ts
 *
 * Intelligent Multi-Step WhatsApp Follow-up Scheduler:
 * 1. Checks campaigns every 30 seconds.
 * 2. Strictly obeys campaign follow-up switch:
 *    If followupEnabled is OFF, campaign is 100% ignored.
 * 3. Reply Detection (Manual Takeover):
 *    If the customer replied at any point, automated follow-up is STOPPED immediately.
 * 4. Step Timeline (Only if customer did NOT reply):
 *    - Step 1: ~2 minutes after initial message -> AI Studio optimized sweet text message.
 *    - Step 2: 3 to 4 hours later -> Image or Audio (voice note) + soft nudge.
 *    - Step 3: Next day (~20-24h later) -> Friendly courteous closing reminder.
 * 5. Promise Date Handling:
 *    If customer said e.g. "কাল নিব", "শুক্রবার", "2 din por", the reminder fires on that date!
 * 6. Historical Safety:
 *    Ancient contacts (>60 minutes old without step 1) are never retroactively blasted.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startFollowupScheduler = startFollowupScheduler;
const db_js_1 = require("./db.js");
const fileSender_js_1 = require("./fileSender.js");
const whatsapp_js_1 = require("./whatsapp.js");
const ai_js_1 = require("./ai.js");
const utils_js_1 = require("./utils.js");
/**
 * Get an active connected socket for the preferred account ID or any connected account.
 */
function getActiveSock(preferAccountId) {
    if (preferAccountId && preferAccountId !== 'all') {
        const sock = (0, whatsapp_js_1.getSocket)(preferAccountId);
        if (sock)
            return sock;
    }
    const accounts = (0, whatsapp_js_1.getAllAccountsInfo)();
    for (const acc of accounts) {
        if (acc.status === 'connected') {
            const sock = (0, whatsapp_js_1.getSocket)(acc.id);
            if (sock)
                return sock;
        }
    }
    return null;
}
/**
 * Analyze all logs for a contact to determine follow-up state.
 */
function analyzeContactFollowupState(logs, initialContactTimeMs) {
    let hasReplied = false;
    let highestStep = 0;
    let lastStepTimeMs = 0;
    let promiseTargetDate = null;
    let promiseAlreadySent = false;
    for (const l of logs) {
        const logTimeMs = new Date(l.sentAt).getTime();
        // Inbound reply from customer after initial contact
        if (l.messageType === 'incoming' && logTimeMs >= initialContactTimeMs - 5000) {
            hasReplied = true;
        }
        if (l.messageType === 'followup_step1' || l.messageType === 'followup') {
            highestStep = Math.max(highestStep, 1);
            lastStepTimeMs = Math.max(lastStepTimeMs, logTimeMs);
        }
        else if (l.messageType === 'followup_step2') {
            highestStep = Math.max(highestStep, 2);
            lastStepTimeMs = Math.max(lastStepTimeMs, logTimeMs);
        }
        else if (l.messageType === 'followup_step3') {
            highestStep = Math.max(highestStep, 3);
            lastStepTimeMs = Math.max(lastStepTimeMs, logTimeMs);
        }
        else if (l.messageType === 'promise_sched' && l.fileUrl) {
            promiseTargetDate = l.fileUrl;
        }
        else if (l.messageType === 'promise_sent') {
            promiseAlreadySent = true;
        }
    }
    return { hasReplied, highestStep, lastStepTimeMs, promiseTargetDate, promiseAlreadySent };
}
/**
 * Process follow-ups for a single campaign.
 */
async function processCampaignFollowups(campaign) {
    const fup = campaign.followupConfig;
    if (!fup || !fup.followupEnabled) {
        return; // Strict safety check
    }
    const accountId = campaign.accountId && campaign.accountId !== 'all' ? campaign.accountId : null;
    const sock = getActiveSock(accountId);
    if (!sock) {
        return; // No WhatsApp connection available
    }
    const contacts = await (0, db_js_1.getRecentContactedUsers)(campaign.id);
    if (contacts.length === 0)
        return;
    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];
    for (const contact of contacts) {
        try {
            const initialContactMs = new Date(contact.sentAt).getTime();
            const ageMinutes = (now - initialContactMs) / (60 * 1000);
            // Fetch message logs for this contact
            const logs = await (0, db_js_1.getContactLogs)(campaign.id, contact.phoneNumber);
            const state = analyzeContactFollowupState(logs, initialContactMs);
            const gender = (0, ai_js_1.ruleBasedGender)(contact.contactName, '');
            // ─────────────────────────────────────────────────────────────────────────
            // Case A: Customer gave a Promise Date (e.g. "কাল নিব", "শুক্রবার")
            // ─────────────────────────────────────────────────────────────────────────
            if (state.promiseTargetDate && !state.promiseAlreadySent) {
                if (todayStr >= state.promiseTargetDate) {
                    (0, utils_js_1.log)('FOLLOWUP', `📅 Promise date reached (${state.promiseTargetDate}) for ${contact.phoneNumber}. Sending reminder...`);
                    const msg = await (0, ai_js_1.generateFollowupText)({
                        step: 'promise',
                        contactName: contact.contactName,
                        gender,
                        campaignName: campaign.name,
                        understandingText: fup.understandingText,
                        baseTemplate: fup.followupMessage,
                        apiKeyOrId: fup.aiApiKey,
                    });
                    await (0, fileSender_js_1.sendTextMessage)(sock, contact.phoneNumber, msg);
                    await (0, db_js_1.markPromiseSent)(campaign.id, contact.phoneNumber, contact.contactName);
                    (0, utils_js_1.log)('FOLLOWUP', `✅ Promise reminder sent to ${contact.phoneNumber}`);
                    await (0, utils_js_1.sleep)(2000);
                    continue;
                }
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Case B: If customer REPLIED, manual takeover is ACTIVE -> STOP AUTO FOLLOW-UP!
            // ─────────────────────────────────────────────────────────────────────────
            if (state.hasReplied) {
                // Customer replied, human takeover is active. Do NOT send automated follow-up.
                continue;
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 1: ~2 Minutes after initial contact (AI-optimized friendly check)
            // ─────────────────────────────────────────────────────────────────────────
            if (state.highestStep === 0) {
                // Must be at least 2 minutes since initial message
                if (ageMinutes >= 2) {
                    // Safety: If contact is older than 60 minutes and step 1 was never sent (e.g. old record),
                    // skip Step 1 to avoid mass-spamming ancient contacts.
                    if (ageMinutes > 60) {
                        continue;
                    }
                    (0, utils_js_1.log)('FOLLOWUP', `⏳ [Step 1: 2-min check] Sending to ${contact.phoneNumber} (${contact.contactName}) for "${campaign.name}"...`);
                    const msg = await (0, ai_js_1.generateFollowupText)({
                        step: 1,
                        contactName: contact.contactName,
                        gender,
                        campaignName: campaign.name,
                        understandingText: fup.understandingText,
                        baseTemplate: fup.followupMessage,
                        apiKeyOrId: fup.aiApiKey,
                    });
                    try {
                        await sock.sendPresenceUpdate('composing', contact.phoneNumber);
                    }
                    catch { }
                    await (0, utils_js_1.sleep)(1500);
                    await (0, fileSender_js_1.sendTextMessage)(sock, contact.phoneNumber, msg);
                    await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 1, 'text', '');
                    (0, utils_js_1.log)('FOLLOWUP', `✅ Step 1 delivered to ${contact.phoneNumber}: "${msg.slice(0, 60)}..."`);
                    await (0, utils_js_1.sleep)(Math.floor(Math.random() * 2000) + 2000);
                    continue;
                }
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 2: 3 to 4 Hours after Step 1 (Media / Voice Note / Image nudge)
            // ─────────────────────────────────────────────────────────────────────────
            if (state.highestStep === 1) {
                const hoursSinceStep1 = (now - state.lastStepTimeMs) / (60 * 60 * 1000);
                // Trigger after 3 hours
                if (hoursSinceStep1 >= 3) {
                    (0, utils_js_1.log)('FOLLOWUP', `🕒 [Step 2: 3-4h nudge] Sending to ${contact.phoneNumber} (${contact.contactName})...`);
                    const audioUrl = fup.followupAudioUrl || campaign.audioUrl || '';
                    const imageUrl = fup.followupImageUrl || campaign.imageUrl || '';
                    const msg = await (0, ai_js_1.generateFollowupText)({
                        step: 2,
                        contactName: contact.contactName,
                        gender,
                        campaignName: campaign.name,
                        understandingText: fup.understandingText,
                        apiKeyOrId: fup.aiApiKey,
                    });
                    try {
                        await sock.sendPresenceUpdate('composing', contact.phoneNumber);
                    }
                    catch { }
                    await (0, utils_js_1.sleep)(1500);
                    if (audioUrl) {
                        // Send audio follow-up (voice note)
                        await (0, fileSender_js_1.sendAudioMessage)(sock, contact.phoneNumber, audioUrl);
                        await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 2, 'audio', audioUrl);
                        (0, utils_js_1.log)('FOLLOWUP', `✅ Step 2 audio sent to ${contact.phoneNumber}`);
                    }
                    else if (imageUrl) {
                        // Send image with caption
                        await (0, fileSender_js_1.sendImageMessage)(sock, contact.phoneNumber, imageUrl, msg);
                        await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 2, 'image', imageUrl);
                        (0, utils_js_1.log)('FOLLOWUP', `✅ Step 2 image sent to ${contact.phoneNumber}`);
                    }
                    else {
                        // Text nudge
                        await (0, fileSender_js_1.sendTextMessage)(sock, contact.phoneNumber, msg);
                        await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 2, 'text', '');
                        (0, utils_js_1.log)('FOLLOWUP', `✅ Step 2 text sent to ${contact.phoneNumber}`);
                    }
                    await (0, utils_js_1.sleep)(Math.floor(Math.random() * 2000) + 2000);
                    continue;
                }
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 3: Next Day (~20-24 Hours after Step 2)
            // ─────────────────────────────────────────────────────────────────────────
            if (state.highestStep === 2) {
                const hoursSinceStep2 = (now - state.lastStepTimeMs) / (60 * 60 * 1000);
                if (hoursSinceStep2 >= 20) {
                    (0, utils_js_1.log)('FOLLOWUP', `🌅 [Step 3: Next-day value] Sending to ${contact.phoneNumber}...`);
                    const msg = await (0, ai_js_1.generateFollowupText)({
                        step: 3,
                        contactName: contact.contactName,
                        gender,
                        campaignName: campaign.name,
                        understandingText: fup.understandingText,
                        apiKeyOrId: fup.aiApiKey,
                    });
                    try {
                        await sock.sendPresenceUpdate('composing', contact.phoneNumber);
                    }
                    catch { }
                    await (0, utils_js_1.sleep)(1500);
                    const imageUrl = fup.followupImageUrl || campaign.imageUrl || '';
                    if (imageUrl) {
                        await (0, fileSender_js_1.sendImageMessage)(sock, contact.phoneNumber, imageUrl, msg);
                        await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 3, 'image', imageUrl);
                    }
                    else {
                        await (0, fileSender_js_1.sendTextMessage)(sock, contact.phoneNumber, msg);
                        await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 3, 'text', '');
                    }
                    (0, utils_js_1.log)('FOLLOWUP', `✅ Step 3 completed for ${contact.phoneNumber}. Follow-up sequence finished.`);
                    await (0, utils_js_1.sleep)(Math.floor(Math.random() * 2000) + 2000);
                    continue;
                }
            }
        }
        catch (err) {
            (0, utils_js_1.errLog)('FOLLOWUP', `Error processing contact ${contact.phoneNumber}:`, err.message);
        }
    }
}
/**
 * Main scheduler loop: runs every 30 seconds in background.
 */
function startFollowupScheduler() {
    const INTERVAL_MS = 30 * 1000; // 30 seconds
    (0, utils_js_1.log)('FOLLOWUP', '🚀 Intelligent Multi-Step Follow-up Scheduler started (polling every 30s)...');
    const runCycle = async () => {
        try {
            const campaigns = await (0, db_js_1.getCampaignsWithFollowup)();
            // If no campaigns have follow-up enabled, do nothing
            if (campaigns.length === 0)
                return;
            for (const campaign of campaigns) {
                await processCampaignFollowups(campaign).catch((err) => {
                    (0, utils_js_1.errLog)('FOLLOWUP', `Error in campaign "${campaign.name}":`, err.message);
                });
            }
        }
        catch (err) {
            // transient network blip
        }
    };
    runCycle();
    setInterval(runCycle, INTERVAL_MS);
}

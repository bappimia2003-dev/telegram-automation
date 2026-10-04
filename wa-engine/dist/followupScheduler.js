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
        return null; // Strict account isolation: don't accidentally send follow-up from another SIM!
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
        // CRITICAL: Ignore any historical logs from previous test sessions or before the current campaign trigger!
        // This guarantees that every new trigger starts clean at Step 1.
        if (logTimeMs < initialContactTimeMs - 2000) {
            continue;
        }
        // Inbound reply from customer AFTER the auto-campaign message was delivered
        if (l.messageType === 'incoming' && logTimeMs > initialContactTimeMs + 2000) {
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
        return; // No WhatsApp connection available for this account
    }
    const contacts = await (0, db_js_1.getRecentContactedUsers)(campaign.id);
    if (contacts.length === 0)
        return;
    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];
    // CRITICAL: Strictly resolve media ONLY from the campaign's follow-up configuration!
    // NEVER fall back to campaign.imageUrl, campaign.audioUrl, etc. (those are main campaign assets)
    let audioUrl = fup.followupAudioUrl || '';
    let imageUrl = fup.followupImageUrl || '';
    let videoUrl = fup.followupVideoUrl || '';
    let documentUrl = fup.followupDocumentUrl || '';
    let documentName = fup.followupDocumentName || 'Document';
    if (Array.isArray(fup.followupFiles) && fup.followupFiles.length > 0) {
        for (const f of fup.followupFiles) {
            if (f.type === 'audio' && !audioUrl)
                audioUrl = f.url;
            if (f.type === 'image' && !imageUrl)
                imageUrl = f.url;
            if (f.type === 'video' && !videoUrl)
                videoUrl = f.url;
            if (f.type === 'document' && !documentUrl) {
                documentUrl = f.url;
                documentName = f.name;
            }
        }
    }
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
                        preferredModel: fup.aiModel,
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
                // Must be at least ~1.9 minutes (114 seconds) so with typing latency it delivers at exactly 2 minutes
                if (ageMinutes >= 1.9) {
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
                        preferredModel: fup.aiModel,
                    });
                    try {
                        await sock.sendPresenceUpdate('composing', contact.phoneNumber);
                    }
                    catch { }
                    await (0, utils_js_1.sleep)(2000); // Natural 2-second typing delay
                    // 1. Send ONLY the Gemini AI personalized text message for Step 1
                    await (0, fileSender_js_1.sendTextMessage)(sock, contact.phoneNumber, msg);
                    await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 1, 'text', '');
                    (0, utils_js_1.log)('FOLLOWUP', `✅ Step 1 delivered AI text only to ${contact.phoneNumber}: "${msg.slice(0, 60)}..."`);
                    // Always explicitly pause typing presence so "typing..." never stays stuck!
                    try {
                        await sock.sendPresenceUpdate('paused', contact.phoneNumber);
                    }
                    catch { }
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
                    const msg = await (0, ai_js_1.generateFollowupText)({
                        step: 2,
                        contactName: contact.contactName,
                        gender,
                        campaignName: campaign.name,
                        understandingText: fup.understandingText,
                        apiKeyOrId: fup.aiApiKey,
                        preferredModel: fup.aiModel,
                    });
                    try {
                        await sock.sendPresenceUpdate('composing', contact.phoneNumber);
                    }
                    catch { }
                    await (0, utils_js_1.sleep)(2000);
                    let step2Delivered = false;
                    const availableStep2Media = [];
                    if (audioUrl)
                        availableStep2Media.push({ type: 'audio', url: audioUrl });
                    if (imageUrl)
                        availableStep2Media.push({ type: 'image', url: imageUrl });
                    if (videoUrl)
                        availableStep2Media.push({ type: 'video', url: videoUrl });
                    if (availableStep2Media.length > 0) {
                        // Randomly pick from whichever media the user selected for follow-up
                        const picked = availableStep2Media[Math.floor(Math.random() * availableStep2Media.length)];
                        if (picked.type === 'audio') {
                            try {
                                await sock.sendPresenceUpdate('recording', contact.phoneNumber);
                                await (0, utils_js_1.sleep)(1500);
                                await (0, fileSender_js_1.sendAudioMessage)(sock, contact.phoneNumber, picked.url);
                                await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 2, 'audio', picked.url);
                                step2Delivered = true;
                                (0, utils_js_1.log)('FOLLOWUP', `✅ Step 2 randomly delivered voice note to ${contact.phoneNumber}`);
                            }
                            catch (e) {
                                (0, utils_js_1.errLog)('FOLLOWUP', `Step 2 audio failed: ${e.message}`);
                            }
                        }
                        else if (picked.type === 'image') {
                            try {
                                await (0, fileSender_js_1.sendImageMessage)(sock, contact.phoneNumber, picked.url, msg);
                                await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 2, 'image', picked.url);
                                step2Delivered = true;
                                (0, utils_js_1.log)('FOLLOWUP', `✅ Step 2 randomly delivered image to ${contact.phoneNumber}`);
                            }
                            catch (e) {
                                (0, utils_js_1.errLog)('FOLLOWUP', `Step 2 image failed: ${e.message}`);
                            }
                        }
                        else if (picked.type === 'video') {
                            try {
                                await (0, fileSender_js_1.sendVideoMessage)(sock, contact.phoneNumber, picked.url, msg);
                                await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 2, 'video', picked.url);
                                step2Delivered = true;
                                (0, utils_js_1.log)('FOLLOWUP', `✅ Step 2 randomly delivered video to ${contact.phoneNumber}`);
                            }
                            catch (e) {
                                (0, utils_js_1.errLog)('FOLLOWUP', `Step 2 video failed: ${e.message}`);
                            }
                        }
                    }
                    if (!step2Delivered) {
                        await (0, fileSender_js_1.sendTextMessage)(sock, contact.phoneNumber, msg);
                        await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 2, 'text', '');
                        (0, utils_js_1.log)('FOLLOWUP', `✅ Step 2 delivered AI text to ${contact.phoneNumber}`);
                    }
                    try {
                        await sock.sendPresenceUpdate('paused', contact.phoneNumber);
                    }
                    catch { }
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
                        preferredModel: fup.aiModel,
                    });
                    try {
                        await sock.sendPresenceUpdate('composing', contact.phoneNumber);
                    }
                    catch { }
                    await (0, utils_js_1.sleep)(2000);
                    let step3Delivered = false;
                    const availableStep3Media = [];
                    if (imageUrl)
                        availableStep3Media.push({ type: 'image', url: imageUrl });
                    if (audioUrl)
                        availableStep3Media.push({ type: 'audio', url: audioUrl });
                    if (videoUrl)
                        availableStep3Media.push({ type: 'video', url: videoUrl });
                    if (availableStep3Media.length > 0) {
                        const picked = availableStep3Media[Math.floor(Math.random() * availableStep3Media.length)];
                        if (picked.type === 'image') {
                            try {
                                await (0, fileSender_js_1.sendImageMessage)(sock, contact.phoneNumber, picked.url, msg);
                                await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 3, 'image', picked.url);
                                step3Delivered = true;
                                (0, utils_js_1.log)('FOLLOWUP', `✅ Step 3 delivered follow-up image to ${contact.phoneNumber}`);
                            }
                            catch (e) {
                                (0, utils_js_1.errLog)('FOLLOWUP', `Step 3 image failed: ${e.message}`);
                            }
                        }
                        else if (picked.type === 'audio') {
                            try {
                                await sock.sendPresenceUpdate('recording', contact.phoneNumber);
                                await (0, utils_js_1.sleep)(1500);
                                await (0, fileSender_js_1.sendAudioMessage)(sock, contact.phoneNumber, picked.url);
                                await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 3, 'audio', picked.url);
                                step3Delivered = true;
                                (0, utils_js_1.log)('FOLLOWUP', `✅ Step 3 delivered follow-up voice note to ${contact.phoneNumber}`);
                            }
                            catch (e) {
                                (0, utils_js_1.errLog)('FOLLOWUP', `Step 3 audio failed: ${e.message}`);
                            }
                        }
                    }
                    if (!step3Delivered) {
                        await (0, fileSender_js_1.sendTextMessage)(sock, contact.phoneNumber, msg);
                        await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 3, 'text', '');
                        (0, utils_js_1.log)('FOLLOWUP', `✅ Step 3 delivered AI text to ${contact.phoneNumber}`);
                    }
                    try {
                        await sock.sendPresenceUpdate('paused', contact.phoneNumber);
                    }
                    catch { }
                    (0, utils_js_1.log)('FOLLOWUP', `✅ Step 3 completed for ${contact.phoneNumber}. Follow-up sequence finished.`);
                    await (0, utils_js_1.sleep)(Math.floor(Math.random() * 2000) + 2000);
                    continue;
                }
            }
        }
        catch (err) {
            (0, utils_js_1.errLog)('FOLLOWUP', `Error processing contact ${contact.phoneNumber}:`, err.message);
            try {
                await sock.sendPresenceUpdate('paused', contact.phoneNumber);
            }
            catch { }
        }
    }
}
/**
 * Main scheduler loop: runs every 15 seconds in background for accurate 2-minute timing.
 */
function startFollowupScheduler() {
    const INTERVAL_MS = 15 * 1000; // 15 seconds
    (0, utils_js_1.log)('FOLLOWUP', '🚀 Intelligent Multi-Step Follow-up Scheduler started (polling every 15s)...');
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

"use strict";
/**
 * followupScheduler.ts
 *
 * Intelligent Multi-Step WhatsApp Follow-up Scheduler:
 * 1. Checks campaigns every 15 seconds.
 * 2. Strictly obeys campaign follow-up switch:
 *    If followupEnabled is OFF, campaign is 100% ignored.
 * 3. Reply Detection (Manual Takeover):
 *    If the customer replied at any point, automated follow-up is STOPPED immediately.
 * 4. Step Timeline (Only if customer did NOT reply):
 *    - Step 1: ~2 minutes after initial message -> AI Studio optimized sweet text message / exact text.
 *    - Step 2: 3 to 4 hours later (within 48h ceiling) -> Image or Audio (voice note) + soft nudge.
 *    - Step 3: Next day (~20-24h later, within 96h ceiling) -> Friendly courteous closing reminder.
 * 5. Promise Date Handling:
 *    If customer said e.g. "কাল নিব", "শুক্রবার", "2 din por", the reminder fires on that date!
 * 6. Historical Safety & Anti-Blast Protection:
 *    - Leads older than allowable window are never retroactively blasted.
 *    - Staggered randomized intervals between contacts.
 *    - If any partial message is delivered (e.g. text succeeded but audio failed), step is marked
 *      completed immediately so the text is NEVER sent repeatedly.
 *    - If all media in a step fails, after 2 attempts the step is marked to prevent infinite retry loops.
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
    const validInitialContactMs = Number.isFinite(initialContactTimeMs) ? initialContactTimeMs : 0;
    for (const l of logs) {
        const logTimeMs = new Date(l.sentAt).getTime();
        // Ignore any historical logs from older sessions before current contact
        if (validInitialContactMs > 0 && logTimeMs < validInitialContactMs - 10000) {
            continue;
        }
        // Inbound reply from customer: ANY incoming message after initial contact means manual takeover!
        if (l.messageType === 'incoming' && (validInitialContactMs === 0 || logTimeMs >= validInitialContactMs - 5000)) {
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
 * Fast variable substitution for follow-up templates:
 * {name} -> Customer name or polite Bengali greeting (ভাইয়া/আপু)
 * {product} -> Campaign / Product offer name
 * {time} -> Current time of day (সকাল, দুপুর, বিকাল, সন্ধ্যা, রাত)
 * {honorific} -> আপু / ভাইয়া
 */
function replaceVariables(template, contactName, campaignName, gender) {
    if (!template)
        return '';
    const cleanName = (contactName || '').trim();
    const hasValidName = cleanName && cleanName !== 'Customer' && !cleanName.includes('@') && cleanName.length < 25;
    let nameLabel = 'সম্মানিত কাস্টমার';
    if (hasValidName) {
        if (gender === 'apu')
            nameLabel = `${cleanName} আপু`;
        else if (gender === 'vai')
            nameLabel = `${cleanName} ভাইয়া`;
        else
            nameLabel = cleanName;
    }
    else {
        if (gender === 'apu')
            nameLabel = 'আপু';
        else if (gender === 'vai')
            nameLabel = 'ভাইয়া';
        else
            nameLabel = 'ভাইয়া/আপু';
    }
    const hour = new Date().getHours();
    let timeStr = 'দিন';
    if (hour >= 5 && hour < 12)
        timeStr = 'সকাল';
    else if (hour >= 12 && hour < 16)
        timeStr = 'দুপুর';
    else if (hour >= 16 && hour < 18)
        timeStr = 'বিকাল';
    else if (hour >= 18 && hour < 20)
        timeStr = 'সন্ধ্যা';
    else
        timeStr = 'রাত';
    return template
        .replace(/\{name\}/gi, nameLabel)
        .replace(/\{product\}/gi, campaignName || 'আমাদের অফারটি')
        .replace(/\{time\}/gi, timeStr)
        .replace(/\{honorific\}/gi, gender === 'apu' ? 'আপু' : gender === 'vai' ? 'ভাইয়া' : '');
}
/**
 * Resolve configuration for a specific step (1, 2, or 3) from fup.steps array,
 * with backwards-compatible fallback to top-level legacy fields.
 */
function getStepConfig(fup, stepNumber, campaign, recipientPhone) {
    // 1. Primary: Match explicit step in fup.steps
    const step = fup.steps?.find((s) => s.stepNumber === stepNumber);
    if (step) {
        let img = (step.imageUrl || '').trim();
        let aud = (step.audioUrl || '').trim();
        let vid = (step.videoUrl || '').trim();
        let doc = (step.documentUrl || '').trim();
        let docName = (step.documentName || 'Document').trim();
        const files = step.files || [];
        for (const f of files) {
            if (!f.url)
                continue;
            if (f.type === 'image' && !img)
                img = f.url.trim();
            if (f.type === 'audio' && !aud)
                aud = f.url.trim();
            if (f.type === 'video' && !vid)
                vid = f.url.trim();
            if (f.type === 'document' && !doc) {
                doc = f.url.trim();
                docName = (f.name || docName).trim();
            }
        }
        // ONLY for Step 1: if step 1 doesn't have an explicit image, allow legacy top-level fup fallback
        if (stepNumber === 1) {
            if (!img && fup.followupImageUrl)
                img = fup.followupImageUrl.trim();
            if (!aud && fup.followupAudioUrl)
                aud = fup.followupAudioUrl.trim();
            if (!vid && fup.followupVideoUrl)
                vid = fup.followupVideoUrl.trim();
            if (!doc && fup.followupDocumentUrl) {
                doc = fup.followupDocumentUrl.trim();
                docName = (fup.followupDocumentName || docName).trim();
            }
        }
        return {
            message: step.message !== undefined ? step.message : '',
            imageUrl: img,
            audioUrl: aud,
            videoUrl: vid,
            documentUrl: doc,
            documentName: docName,
            files,
        };
    }
    // 2. Secondary: Check explicit followupVariants stored in followupConfig (never campaign auto-reply variants!)
    const fupVariants = (fup.followupVariants || []).filter((v) => v.isActive);
    if (fupVariants.length > 0) {
        const variantIndex = (stepNumber - 1) < fupVariants.length ? (stepNumber - 1) : ((stepNumber - 1) % fupVariants.length);
        const variant = fupVariants[variantIndex] || fupVariants[0];
        return {
            message: variant.welcomeMessage || '',
            imageUrl: (variant.imageUrl || '').trim(),
            audioUrl: (variant.audioUrl || '').trim(),
            videoUrl: (variant.videoUrl || '').trim(),
            documentUrl: (variant.documentUrl || '').trim(),
            documentName: (variant.documentName || '').trim(),
            files: [],
        };
    }
    // 3. Fallback: Top-level followup fields (ONLY for Step 1)
    return {
        message: stepNumber === 1 ? (fup.followupMessage || '') : '',
        imageUrl: stepNumber === 1 ? (fup.followupImageUrl || '').trim() : '',
        audioUrl: stepNumber === 1 ? (fup.followupAudioUrl || '').trim() : '',
        videoUrl: stepNumber === 1 ? (fup.followupVideoUrl || '').trim() : '',
        documentUrl: stepNumber === 1 ? (fup.followupDocumentUrl || '').trim() : '',
        documentName: stepNumber === 1 ? (fup.followupDocumentName || 'Document').trim() : '',
        files: stepNumber === 1 ? (fup.followupFiles || []) : [],
    };
}
/**
 * Dispatches step content respecting user intent with full crash resilience:
 * - When AI is OFF or API Key is OFF: Sends 100% exact text provided by user (no AI modification)
 * - When AI is ON and API Key is active: Optimizes message with Gemini
 * - Resilient delivery: If both image/video and text exist, delivers image/video with exact text as caption
 * - CRITICAL ANTI-LOOP FIX: If text is delivered but audio/media fails, step is marked completed
 *   so the customer is NEVER repeatedly spammed with duplicate text messages!
 */
async function dispatchStepFollowup(sock, campaign, contact, stepNumber, stepConfig, gender, fup) {
    const hasText = Boolean(stepConfig.message && stepConfig.message.trim());
    const hasImage = Boolean(stepConfig.imageUrl && stepConfig.imageUrl.trim());
    const hasAudio = Boolean(stepConfig.audioUrl && stepConfig.audioUrl.trim());
    const hasVideo = Boolean(stepConfig.videoUrl && stepConfig.videoUrl.trim());
    const hasDoc = Boolean(stepConfig.documentUrl && stepConfig.documentUrl.trim());
    if (!hasText && !hasImage && !hasAudio && !hasVideo && !hasDoc) {
        (0, utils_js_1.log)('FOLLOWUP', `⚠️ Step ${stepNumber} for campaign "${campaign.name}" has no message or media configured.`);
        return false;
    }
    let msg = '';
    if (hasText) {
        let text = stepConfig.message.trim();
        if (text.includes('{name}')) {
            const cleanName = (contact.contactName || '').trim();
            const hasValidName = cleanName && cleanName !== 'Customer' && !cleanName.includes('@') && cleanName.length < 25;
            text = text.replace(/\{name\}/gi, hasValidName ? cleanName : '');
        }
        msg = text.trim();
        // AI Optimization Check
        const isAiActive = fup.aiEnabled === true &&
            Boolean(fup.aiApiKey) &&
            fup.aiApiKey !== 'none' &&
            fup.aiApiKey !== 'off' &&
            fup.aiApiKey !== 'disabled';
        if (isAiActive) {
            try {
                const optimized = await (0, ai_js_1.generateFollowupText)({
                    step: stepNumber,
                    contactName: contact.contactName,
                    gender,
                    campaignName: campaign.name,
                    understandingText: fup.understandingText,
                    baseTemplate: msg,
                    apiKeyOrId: fup.aiApiKey,
                    preferredModel: fup.aiModel || 'gemini-flash-latest',
                });
                if (optimized && optimized.trim()) {
                    msg = optimized.trim();
                    (0, utils_js_1.log)('FOLLOWUP', `✨ Step ${stepNumber} AI optimized text for ${contact.phoneNumber}: "${msg.slice(0, 50)}..."`);
                }
            }
            catch (err) {
                (0, utils_js_1.log)('FOLLOWUP', `AI optimization skipped for Step ${stepNumber} (${err.message}). Using exact text.`);
            }
        }
        else {
            (0, utils_js_1.log)('FOLLOWUP', `🔒 Step ${stepNumber} AI is OFF. Sending exact user text to ${contact.phoneNumber}.`);
        }
    }
    let deliveredAny = false;
    let loggedType = 'text';
    let loggedUrl = '';
    // 1. Deliver Image (with text caption if available)
    if (hasImage) {
        try {
            try {
                await sock.sendPresenceUpdate('composing', contact.phoneNumber);
            }
            catch { }
            await (0, utils_js_1.sleep)(1000);
            const caption = msg; // send message as caption
            await (0, fileSender_js_1.sendImageMessage)(sock, contact.phoneNumber, stepConfig.imageUrl, caption);
            deliveredAny = true;
            loggedType = 'image';
            loggedUrl = stepConfig.imageUrl;
            msg = ''; // text delivered with image
            (0, utils_js_1.log)('FOLLOWUP', `✅ Step ${stepNumber} delivered image to ${contact.phoneNumber}`);
        }
        catch (e) {
            (0, utils_js_1.errLog)('FOLLOWUP', `Step ${stepNumber} image send failed: ${e.message}`);
        }
    }
    // 2. Deliver Video (with text caption if available and not already sent with image)
    if (hasVideo) {
        try {
            try {
                await sock.sendPresenceUpdate('composing', contact.phoneNumber);
            }
            catch { }
            await (0, utils_js_1.sleep)(1000);
            const caption = msg;
            await (0, fileSender_js_1.sendVideoMessage)(sock, contact.phoneNumber, stepConfig.videoUrl, caption);
            deliveredAny = true;
            loggedType = 'video';
            loggedUrl = stepConfig.videoUrl;
            msg = ''; // text delivered with video
            (0, utils_js_1.log)('FOLLOWUP', `✅ Step ${stepNumber} delivered video to ${contact.phoneNumber}`);
        }
        catch (e) {
            (0, utils_js_1.errLog)('FOLLOWUP', `Step ${stepNumber} video send failed: ${e.message}`);
        }
    }
    // 3. Deliver Document
    if (hasDoc) {
        try {
            await (0, fileSender_js_1.sendDocumentMessage)(sock, contact.phoneNumber, stepConfig.documentUrl, stepConfig.documentName);
            deliveredAny = true;
            loggedType = 'document';
            loggedUrl = stepConfig.documentUrl;
            (0, utils_js_1.log)('FOLLOWUP', `✅ Step ${stepNumber} delivered document to ${contact.phoneNumber}`);
        }
        catch (e) {
            (0, utils_js_1.errLog)('FOLLOWUP', `Step ${stepNumber} document send failed: ${e.message}`);
        }
    }
    // 4. Deliver Text (if text has not already been sent as image/video caption)
    if (msg) {
        try {
            try {
                await sock.sendPresenceUpdate('composing', contact.phoneNumber);
            }
            catch { }
            await (0, utils_js_1.sleep)(1200);
            await (0, fileSender_js_1.sendTextMessage)(sock, contact.phoneNumber, msg);
            deliveredAny = true;
            if (!loggedUrl) {
                loggedType = 'text';
            }
            (0, utils_js_1.log)('FOLLOWUP', `✅ Step ${stepNumber} delivered text to ${contact.phoneNumber}: "${msg.slice(0, 60)}..."`);
        }
        catch (e) {
            (0, utils_js_1.errLog)('FOLLOWUP', `Step ${stepNumber} text send failed: ${e.message}`);
        }
    }
    // 5. Deliver Audio (Voice note)
    if (hasAudio) {
        try {
            try {
                await sock.sendPresenceUpdate('recording', contact.phoneNumber);
            }
            catch { }
            await (0, utils_js_1.sleep)(1200);
            await (0, fileSender_js_1.sendAudioMessage)(sock, contact.phoneNumber, stepConfig.audioUrl);
            deliveredAny = true;
            if (loggedType === 'text') {
                loggedType = 'audio';
                loggedUrl = stepConfig.audioUrl;
            }
            (0, utils_js_1.log)('FOLLOWUP', `✅ Step ${stepNumber} delivered voice note to ${contact.phoneNumber}`);
        }
        catch (e) {
            (0, utils_js_1.errLog)('FOLLOWUP', `Step ${stepNumber} audio send failed: ${e.message}`);
        }
    }
    // CRITICAL RESILIENCE: If ANY part of the step was delivered (e.g. text succeeded even if audio failed):
    // We MUST log the step as sent and return true! This prevents infinite repeat spam loops.
    if (deliveredAny) {
        await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, stepNumber, loggedType, loggedUrl);
        return true;
    }
    return false;
}
// ─────────────────────────────────────────────────────────────────────────────
// Anti-Blast Staggered Scheduler State & Concurrency Protection
// ─────────────────────────────────────────────────────────────────────────────
let isCycleRunning = false;
const inFlightKeys = new Set(); // key: `${campaignId}:${phoneNumber}`
const accountCooldownMap = new Map(); // accountId -> nextAllowedDispatchTimestamp
const accountBatchCountMap = new Map(); // accountId -> messagesSentInCurrentBatch
const stepFailCountMap = new Map(); // failKey -> failure count to prevent infinite retries
/**
 * Apply randomized cooldown after sending a follow-up:
 * - Between individual sends: random 15 to 40 seconds.
 * - When batch limit (3 to 5 people) is reached: pause for random 3 to 5 minutes.
 * - Result: No two contacts ever receive at the same time; pacing is human-like and anti-ban compliant!
 */
function applyAccountCooldown(accountId, fup) {
    const currentBatch = (accountBatchCountMap.get(accountId) || 0) + 1;
    const minBatch = Number(fup.minBatchPeople) || 3;
    const maxBatch = Number(fup.maxBatchPeople) || 5;
    const batchTarget = Math.max(2, Math.floor(Math.random() * (maxBatch - minBatch + 1)) + minBatch);
    if (currentBatch >= batchTarget) {
        // Batch limit reached: Longer human-like pause (3 to 5 minutes)
        accountBatchCountMap.set(accountId, 0);
        const batchPauseSeconds = Math.floor(Math.random() * (300 - 180 + 1)) + 180;
        const batchPauseMs = batchPauseSeconds * 1000 + Math.floor(Math.random() * 999);
        accountCooldownMap.set(accountId, Date.now() + batchPauseMs);
        (0, utils_js_1.log)('FOLLOWUP', `🛑 [Batch limit of ${batchTarget} reached on Acc: ${accountId}] Anti-ban pause for ${(batchPauseSeconds / 60).toFixed(1)} minutes before next batch.`);
    }
    else {
        // Normal interval between individual recipients: 15 to 40 seconds
        accountBatchCountMap.set(accountId, currentBatch);
        const gapSeconds = Math.floor(Math.random() * (40 - 15 + 1)) + 15;
        const gapMs = gapSeconds * 1000 + Math.floor(Math.random() * 999);
        accountCooldownMap.set(accountId, Date.now() + gapMs);
        (0, utils_js_1.log)('FOLLOWUP', `⏳ [Staggered Pacing on Acc: ${accountId}] Next follow-up allowed in ${gapSeconds}s (${(gapSeconds / 60).toFixed(2)} min). Batch progress: ${currentBatch}/${batchTarget}.`);
    }
}
/**
 * Process follow-ups for a single campaign with strictly staggered, non-overlapping timing.
 */
async function processCampaignFollowups(campaign) {
    const fup = campaign.followupConfig;
    if (!fup || !fup.followupEnabled) {
        return; // Strict safety check
    }
    const accountId = campaign.accountId && campaign.accountId !== 'all' ? campaign.accountId : (campaign.id || 'default');
    // 1. Staggered Pacing Check: If this account is in cooldown, skip this tick
    const now = Date.now();
    const nextAllowed = accountCooldownMap.get(accountId) || 0;
    if (now < nextAllowed) {
        return; // Still waiting randomized interval between contacts
    }
    const sock = getActiveSock(campaign.accountId && campaign.accountId !== 'all' ? campaign.accountId : null);
    if (!sock) {
        return; // No WhatsApp connection available for this account
    }
    const minAgeDays = Number(fup.minContactAgeDays) || 0;
    const maxDaysBack = Number(fup.totalDurationDays) || 30;
    const contacts = await (0, db_js_1.getRecentContactedUsers)(campaign.id, minAgeDays, maxDaysBack);
    if (contacts.length === 0)
        return;
    const todayStr = new Date().toISOString().split('T')[0];
    for (const contact of contacts) {
        const flightKey = `${campaign.id}:${contact.phoneNumber}`;
        if (inFlightKeys.has(flightKey)) {
            continue; // Never process the same contact concurrently
        }
        try {
            const initialContactMs = new Date(contact.sentAt).getTime();
            const ageMs = now - initialContactMs;
            const ageMinutes = ageMs / (60 * 1000);
            const ageDays = ageMs / (24 * 60 * 60 * 1000);
            // If minContactAgeDays is explicitly set (> 0), enforce that age requirement
            if (minAgeDays > 0 && ageDays < minAgeDays) {
                continue;
            }
            // Campaign duration limit check (e.g. max 30/60/90 days)
            if (maxDaysBack > 0 && ageDays > maxDaysBack) {
                continue;
            }
            // Fetch message logs for this contact (including incoming replies across campaigns)
            const logs = await (0, db_js_1.getContactLogs)(campaign.id, contact.phoneNumber);
            const state = analyzeContactFollowupState(logs, initialContactMs);
            const gender = (0, ai_js_1.ruleBasedGender)(contact.contactName, '');
            // ─────────────────────────────────────────────────────────────────────────
            // Case A: Customer gave a Promise Date (e.g. "কাল নিব", "শুক্রবার")
            // ─────────────────────────────────────────────────────────────────────────
            if (state.promiseTargetDate && !state.promiseAlreadySent) {
                if (todayStr >= state.promiseTargetDate) {
                    inFlightKeys.add(flightKey);
                    try {
                        (0, utils_js_1.log)('FOLLOWUP', `📅 Promise date reached (${state.promiseTargetDate}) for ${contact.phoneNumber}. Sending reminder...`);
                        const step1Config = getStepConfig(fup, 1, campaign, contact.phoneNumber);
                        const msg = step1Config.message || 'আসসালামু আলাইকুম {name}! আপনার আগ্রহের অফারটির বিষয়ে জানাতে পারেন।';
                        let promiseSent = false;
                        try {
                            await (0, fileSender_js_1.sendTextMessage)(sock, contact.phoneNumber, msg);
                            promiseSent = true;
                        }
                        catch (pErr) {
                            (0, utils_js_1.errLog)('FOLLOWUP', `Failed sending promise reminder to ${contact.phoneNumber}: ${pErr.message}`);
                        }
                        if (promiseSent) {
                            await (0, db_js_1.markPromiseSent)(campaign.id, contact.phoneNumber, contact.contactName);
                            (0, utils_js_1.log)('FOLLOWUP', `✅ Promise reminder sent to ${contact.phoneNumber}`);
                        }
                        else {
                            const pFailKey = `prm:${campaign.id}:${contact.phoneNumber}`;
                            const pFails = (stepFailCountMap.get(pFailKey) || 0) + 1;
                            stepFailCountMap.set(pFailKey, pFails);
                            if (pFails >= 2) {
                                await (0, db_js_1.markPromiseSent)(campaign.id, contact.phoneNumber, contact.contactName);
                                stepFailCountMap.delete(pFailKey);
                            }
                        }
                        applyAccountCooldown(accountId, fup);
                        break; // Stop after 1 send to maintain strictly staggered pacing
                    }
                    finally {
                        inFlightKeys.delete(flightKey);
                    }
                }
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Case B: If customer REPLIED, manual takeover is ACTIVE -> STOP AUTO FOLLOW-UP!
            // ─────────────────────────────────────────────────────────────────────────
            if (state.hasReplied) {
                continue;
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 1: Deliver to eligible contact after configured delay (e.g. 2-5 min)
            // ─────────────────────────────────────────────────────────────────────────
            if (state.highestStep === 0) {
                let minDelay = Number(fup.minDelayMinutes);
                if (!minDelay || minDelay <= 0) {
                    if (fup.followupDelayUnit === 'hours') {
                        minDelay = (Number(fup.followupDelayValue) || 1) * 60;
                    }
                    else if (fup.followupDelayUnit === 'days') {
                        minDelay = (Number(fup.followupDelayValue) || 1) * 1440;
                    }
                    else {
                        minDelay = Number(fup.followupDelayValue) || 2;
                    }
                }
                if (minDelay <= 0)
                    minDelay = 2;
                const phoneDigits = contact.phoneNumber.replace(/\D/g, '');
                const seed = phoneDigits.length >= 4 ? parseInt(phoneDigits.slice(-4), 10) : 1234;
                const jitterMinutes = ((seed % 120) / 60) + ((seed % 10) * 0.05); // 0.2 to 2.2 min jitter
                const targetMinutes = minDelay + (fup.antiBanJitter !== false ? jitterMinutes : 0);
                // When running real-time campaign follow-up (minAgeDays == 0):
                if (minAgeDays === 0) {
                    if (ageMinutes < targetMinutes) {
                        continue;
                    }
                    // Safety: Don't blast contacts older than 24 hours without Step 1
                    if (ageMinutes > 1440) {
                        continue;
                    }
                }
                inFlightKeys.add(flightKey);
                try {
                    const timingLabel = minAgeDays > 0
                        ? `${ageDays.toFixed(1)} days ago`
                        : `${targetMinutes.toFixed(2)}-min target`;
                    (0, utils_js_1.log)('FOLLOWUP', `⏳ [Step 1: ${timingLabel}] Sending to ${contact.phoneNumber} (${contact.contactName}) for "${campaign.name}"...`);
                    const step1Config = getStepConfig(fup, 1, campaign, contact.phoneNumber);
                    const failKey = `${campaign.id}:${contact.phoneNumber}:1`;
                    const success = await dispatchStepFollowup(sock, campaign, contact, 1, step1Config, gender, fup);
                    try {
                        await sock.sendPresenceUpdate('paused', contact.phoneNumber);
                    }
                    catch { }
                    if (success) {
                        stepFailCountMap.delete(failKey);
                        applyAccountCooldown(accountId, fup);
                        break;
                    }
                    else {
                        const fails = (stepFailCountMap.get(failKey) || 0) + 1;
                        stepFailCountMap.set(failKey, fails);
                        if (fails >= 2) {
                            (0, utils_js_1.log)('FOLLOWUP', `⚠️ [Safety Skip] Step 1 for ${contact.phoneNumber} failed ${fails} times (broken file/network). Recording step as failed.`);
                            await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 1, 'text', 'failed: max_retries_exceeded');
                            stepFailCountMap.delete(failKey);
                        }
                        applyAccountCooldown(accountId, fup);
                        break;
                    }
                }
                finally {
                    inFlightKeys.delete(flightKey);
                }
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 2: 3 to 4 Hours after Step 1 (Safety Ceiling: 48 Hours)
            // ─────────────────────────────────────────────────────────────────────────
            if (state.highestStep === 1) {
                const hoursSinceStep1 = (now - state.lastStepTimeMs) / (60 * 60 * 1000);
                if (hoursSinceStep1 > 48) {
                    // Lapsed lead: older than 48 hours since Step 1 without Step 2. Safely skip to prevent ancient nudges.
                    continue;
                }
                if (hoursSinceStep1 >= 3) {
                    inFlightKeys.add(flightKey);
                    try {
                        (0, utils_js_1.log)('FOLLOWUP', `🕒 [Step 2: 3-4h nudge] Sending to ${contact.phoneNumber} (${contact.contactName})...`);
                        const step2Config = getStepConfig(fup, 2, campaign, contact.phoneNumber);
                        const failKey = `${campaign.id}:${contact.phoneNumber}:2`;
                        const success = await dispatchStepFollowup(sock, campaign, contact, 2, step2Config, gender, fup);
                        try {
                            await sock.sendPresenceUpdate('paused', contact.phoneNumber);
                        }
                        catch { }
                        if (success) {
                            stepFailCountMap.delete(failKey);
                            applyAccountCooldown(accountId, fup);
                            break;
                        }
                        else {
                            const fails = (stepFailCountMap.get(failKey) || 0) + 1;
                            stepFailCountMap.set(failKey, fails);
                            if (fails >= 2) {
                                (0, utils_js_1.log)('FOLLOWUP', `⚠️ [Safety Skip] Step 2 for ${contact.phoneNumber} failed ${fails} times. Recording step as failed.`);
                                await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 2, 'text', 'failed: max_retries_exceeded');
                                stepFailCountMap.delete(failKey);
                            }
                            applyAccountCooldown(accountId, fup);
                            break;
                        }
                    }
                    finally {
                        inFlightKeys.delete(flightKey);
                    }
                }
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 3: Next Day (~20-24 Hours after Step 2, Safety Ceiling: 96 Hours)
            // ─────────────────────────────────────────────────────────────────────────
            if (state.highestStep === 2) {
                const hoursSinceStep2 = (now - state.lastStepTimeMs) / (60 * 60 * 1000);
                if (hoursSinceStep2 > 96) {
                    // Lapsed lead: older than 4 days since Step 2 without Step 3. Safely skip.
                    continue;
                }
                if (hoursSinceStep2 >= 20) {
                    inFlightKeys.add(flightKey);
                    try {
                        (0, utils_js_1.log)('FOLLOWUP', `🌅 [Step 3: Next-day value] Sending to ${contact.phoneNumber}...`);
                        const step3Config = getStepConfig(fup, 3, campaign, contact.phoneNumber);
                        const failKey = `${campaign.id}:${contact.phoneNumber}:3`;
                        const success = await dispatchStepFollowup(sock, campaign, contact, 3, step3Config, gender, fup);
                        try {
                            await sock.sendPresenceUpdate('paused', contact.phoneNumber);
                        }
                        catch { }
                        if (success) {
                            stepFailCountMap.delete(failKey);
                            (0, utils_js_1.log)('FOLLOWUP', `✅ Step 3 completed for ${contact.phoneNumber}. Follow-up sequence finished.`);
                            applyAccountCooldown(accountId, fup);
                            break;
                        }
                        else {
                            const fails = (stepFailCountMap.get(failKey) || 0) + 1;
                            stepFailCountMap.set(failKey, fails);
                            if (fails >= 2) {
                                (0, utils_js_1.log)('FOLLOWUP', `⚠️ [Safety Skip] Step 3 for ${contact.phoneNumber} failed ${fails} times. Recording step as failed.`);
                                await (0, db_js_1.logFollowupStep)(campaign.id, contact.phoneNumber, contact.contactName, 3, 'text', 'failed: max_retries_exceeded');
                                stepFailCountMap.delete(failKey);
                            }
                            applyAccountCooldown(accountId, fup);
                            break;
                        }
                    }
                    finally {
                        inFlightKeys.delete(flightKey);
                    }
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
 * Main scheduler loop: runs every 15 seconds in background with strict mutex lock.
 */
function startFollowupScheduler() {
    const INTERVAL_MS = 15 * 1000; // 15 seconds
    (0, utils_js_1.log)('FOLLOWUP', '🚀 Intelligent Multi-Step Follow-up Scheduler started (polling every 15s with staggered anti-blast pacing)...');
    const runCycle = async () => {
        if (isCycleRunning)
            return; // Prevent concurrent cycle execution
        isCycleRunning = true;
        try {
            const campaigns = await (0, db_js_1.getCampaignsWithFollowup)();
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
        finally {
            isCycleRunning = false;
        }
    };
    runCycle();
    setInterval(runCycle, INTERVAL_MS);
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCurrentlyQuietHours = isCurrentlyQuietHours;
exports.normalizePhoneNumber = normalizePhoneNumber;
exports.startTargetedFollowupScheduler = startTargetedFollowupScheduler;
exports.startNewTargetedJob = startNewTargetedJob;
exports.pauseTargetedJob = pauseTargetedJob;
exports.resumeTargetedJob = resumeTargetedJob;
exports.stopTargetedJob = stopTargetedJob;
exports.getTargetedJobStatus = getTargetedJobStatus;
const fileSender_js_1 = require("./fileSender.js");
const whatsapp_js_1 = require("./whatsapp.js");
const utils_js_1 = require("./utils.js");
// In-memory active job state
let activeJob = null;
let schedulerInterval = null;
let isLoopRunning = false;
let roundRobinIndex = 0;
/**
 * Checks if current time in Bangladesh (GMT+6) falls within quiet hours (e.g. 00:00 to 08:00)
 */
function isCurrentlyQuietHours(startHourStr = '00:00', endHourStr = '08:00') {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const bdTime = new Date(utcMs + (6 * 3600000));
    const currentMinutesFromMidnight = bdTime.getHours() * 60 + bdTime.getMinutes();
    const [startH, startM] = startHourStr.split(':').map(Number);
    const [endH, endM] = endHourStr.split(':').map(Number);
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);
    if (startMinutes <= endMinutes) {
        return currentMinutesFromMidnight >= startMinutes && currentMinutesFromMidnight < endMinutes;
    }
    else {
        return currentMinutesFromMidnight >= startMinutes || currentMinutesFromMidnight < endMinutes;
    }
}
/**
 * Normalizes phone numbers to standard international format without '+' or spaces.
 * E.g., 01830086837 -> 8801830086837
 */
function normalizePhoneNumber(raw) {
    if (!raw)
        return '';
    let cleaned = raw.toString().replace(/[^0-9]/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('01')) {
        cleaned = '88' + cleaned;
    }
    return cleaned;
}
/**
 * Pick an active socket based on assignedAccountId (or round-robin across all connected SIMs)
 */
function getTargetSocket(preferredAccountId) {
    const accounts = (0, whatsapp_js_1.getAllAccountsInfo)().filter((a) => a.status === 'connected');
    if (accounts.length === 0)
        return null;
    if (preferredAccountId && preferredAccountId !== 'all') {
        const matched = accounts.find((a) => a.id === preferredAccountId);
        if (matched) {
            const sock = (0, whatsapp_js_1.getSocket)(matched.id);
            if (sock)
                return { sock, accountId: matched.id, accountName: matched.name };
        }
        return null;
    }
    // Round-robin across connected accounts
    const chosen = accounts[roundRobinIndex % accounts.length];
    roundRobinIndex++;
    const sock = (0, whatsapp_js_1.getSocket)(chosen.id);
    if (sock) {
        return { sock, accountId: chosen.id, accountName: chosen.name };
    }
    return null;
}
/**
 * Calculate delay in seconds for next send based on ratePerHour with anti-ban jitter
 */
function calculateNextDelaySeconds(ratePerHour) {
    const safeRate = Math.max(1, Math.min(120, ratePerHour || 20));
    const baseSeconds = Math.round(3600 / safeRate);
    // Add random ±10% jitter (minimum ±5s, maximum ±30s)
    const maxJitter = Math.min(30, Math.max(5, Math.round(baseSeconds * 0.1)));
    const jitter = Math.floor(Math.random() * (maxJitter * 2 + 1)) - maxJitter;
    return Math.max(15, baseSeconds + jitter);
}
/**
 * Dispatch message and all attached media to a single recipient
 */
async function sendTargetedMessage(sock, phone, name, job) {
    const jid = `${phone}@s.whatsapp.net`;
    const contactName = name ? name.trim() : '';
    // 1. Prepare personalized text
    let personalized = job.messageText || '';
    if (personalized.includes('{name}')) {
        personalized = personalized.replace(/{name}/g, contactName || 'সম্মানিত গ্রাহক');
    }
    if (personalized.includes('{time}')) {
        personalized = personalized.replace(/{time}/g, new Date().toLocaleTimeString('bn-BD'));
    }
    // Show typing indicator
    try {
        await sock.sendPresenceUpdate('composing', jid);
        await (0, utils_js_1.sleep)(1500);
    }
    catch { }
    // Parse send order (e.g. 'text,image,video,audio,document')
    const orderParts = (job.sendOrder || 'text,image,video,audio,document')
        .split(',')
        .map((s) => s.trim().toLowerCase());
    const gapMs = Math.max(1000, (job.delayBetweenSends || 3) * 1000);
    for (let i = 0; i < orderParts.length; i++) {
        const item = orderParts[i];
        if (item === 'text' || item === 'message') {
            if (personalized.trim()) {
                await (0, fileSender_js_1.sendTextMessage)(sock, jid, personalized);
                if (i < orderParts.length - 1)
                    await (0, utils_js_1.sleep)(gapMs);
            }
        }
        else if (item === 'image' && job.imageUrl) {
            await (0, fileSender_js_1.sendImageMessage)(sock, jid, job.imageUrl);
            if (i < orderParts.length - 1)
                await (0, utils_js_1.sleep)(gapMs);
        }
        else if (item === 'video' && job.videoUrl) {
            await (0, fileSender_js_1.sendVideoMessage)(sock, jid, job.videoUrl);
            if (i < orderParts.length - 1)
                await (0, utils_js_1.sleep)(gapMs);
        }
        else if (item === 'audio' && job.audioUrl) {
            await (0, fileSender_js_1.sendAudioMessage)(sock, jid, job.audioUrl);
            if (i < orderParts.length - 1)
                await (0, utils_js_1.sleep)(gapMs);
        }
        else if (item === 'document' && job.documentUrl) {
            await (0, fileSender_js_1.sendDocumentMessage)(sock, jid, job.documentUrl, job.documentName || 'Document.pdf');
            if (i < orderParts.length - 1)
                await (0, utils_js_1.sleep)(gapMs);
        }
    }
    try {
        await sock.sendPresenceUpdate('paused', jid);
    }
    catch { }
}
/**
 * Main background tick loop for targeted followup execution
 */
async function tickTargetedFollowup() {
    if (!activeJob || activeJob.status !== 'running')
        return;
    if (isLoopRunning)
        return;
    isLoopRunning = true;
    try {
        // 1. Check Quiet Hours (12 AM - 8 AM Bangladesh Time)
        if (activeJob.quietHoursEnabled) {
            if (isCurrentlyQuietHours(activeJob.quietHoursStart, activeJob.quietHoursEnd)) {
                (0, utils_js_1.log)('TARGETED_FUP', `🌙 Night Quiet Hours active (${activeJob.quietHoursStart} - ${activeJob.quietHoursEnd} BD Time). Delivery paused until morning.`);
                return;
            }
        }
        // 2. Check scheduled send timestamp
        const now = Date.now();
        if (activeJob.nextScheduledSendAt) {
            const scheduledMs = new Date(activeJob.nextScheduledSendAt).getTime();
            if (now < scheduledMs) {
                // Not yet time for next message
                return;
            }
        }
        // 3. Find next pending recipient
        const nextRecipient = activeJob.recipients.find((r) => r.status === 'pending');
        if (!nextRecipient) {
            activeJob.status = 'completed';
            activeJob.completedAt = new Date().toISOString();
            activeJob.updatedAt = new Date().toISOString();
            (0, utils_js_1.log)('TARGETED_FUP', `🎉 Targeted Follow-up Job "${activeJob.title}" completed! Sent: ${activeJob.sentCount}, Failed: ${activeJob.failedCount}`);
            return;
        }
        // 4. Check socket availability
        const target = getTargetSocket(activeJob.assignedAccountId);
        if (!target) {
            (0, utils_js_1.log)('TARGETED_FUP', '⏳ No connected WhatsApp account available to send message. Waiting for account...');
            return;
        }
        // 5. Send message
        nextRecipient.status = 'sending';
        activeJob.updatedAt = new Date().toISOString();
        (0, utils_js_1.log)('TARGETED_FUP', `🚀 Sending targeted message to ${nextRecipient.phone} using [${target.accountName}]...`);
        try {
            await sendTargetedMessage(target.sock, nextRecipient.phone, nextRecipient.name, activeJob);
            nextRecipient.status = 'sent';
            nextRecipient.sentAt = new Date().toISOString();
            nextRecipient.sentFromAccountId = target.accountId;
            activeJob.sentCount++;
            activeJob.lastSentAt = new Date().toISOString();
            (0, utils_js_1.log)('TARGETED_FUP', `✅ Successfully delivered to ${nextRecipient.phone} (${activeJob.sentCount}/${activeJob.totalNumbers})`);
        }
        catch (sendErr) {
            nextRecipient.status = 'failed';
            nextRecipient.error = sendErr.message || 'Delivery error';
            activeJob.failedCount++;
            (0, utils_js_1.errLog)('TARGETED_FUP', `❌ Failed delivery to ${nextRecipient.phone}:`, sendErr.message);
        }
        // 6. Schedule next send with anti-ban rate pacing
        const delaySec = calculateNextDelaySeconds(activeJob.ratePerHour);
        activeJob.nextScheduledSendAt = new Date(Date.now() + delaySec * 1000).toISOString();
        activeJob.updatedAt = new Date().toISOString();
        (0, utils_js_1.log)('TARGETED_FUP', `⏱️ Next message scheduled in ${delaySec}s at ${new Date(activeJob.nextScheduledSendAt).toLocaleTimeString()}`);
    }
    catch (err) {
        (0, utils_js_1.errLog)('TARGETED_FUP', 'Exception in targeted followup loop:', err.message);
    }
    finally {
        isLoopRunning = false;
    }
}
/**
 * Start or initialize the targeted followup scheduler
 */
function startTargetedFollowupScheduler() {
    if (schedulerInterval)
        return;
    (0, utils_js_1.log)('TARGETED_FUP', '⚡ Targeted Follow-up Background Scheduler initialized (checking every 10s)...');
    schedulerInterval = setInterval(tickTargetedFollowup, 10000);
}
/**
 * Configure and start a new targeted follow-up campaign
 */
function startNewTargetedJob(config) {
    // 1. Process and deduplicate numbers (max 300)
    const lines = (config.rawNumbers || '')
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    const seen = new Set();
    const recipients = [];
    for (const line of lines) {
        // Support "01830086837" or "Name: 01830086837" or "01830086837, Name"
        let phoneRaw = line;
        let nameRaw = '';
        if (line.includes(':')) {
            const parts = line.split(':');
            nameRaw = parts[0].trim();
            phoneRaw = parts[1].trim();
        }
        else if (line.includes('|')) {
            const parts = line.split('|');
            nameRaw = parts[0].trim();
            phoneRaw = parts[1].trim();
        }
        const normalized = normalizePhoneNumber(phoneRaw);
        if (normalized.length >= 10 && !seen.has(normalized)) {
            seen.add(normalized);
            recipients.push({
                phone: normalized,
                name: nameRaw || undefined,
                status: 'pending',
            });
            if (recipients.length >= 300)
                break; // Maximum 300 limit
        }
    }
    const ratePerHour = Math.max(1, Math.min(120, Number(config.ratePerHour) || 20));
    const baseSeconds = Math.round(3600 / ratePerHour);
    activeJob = {
        id: config.id || `tfup_${Date.now()}`,
        title: config.title || `Targeted Broadcast ${new Date().toLocaleDateString('bn-BD')}`,
        status: 'running',
        assignedAccountId: config.assignedAccountId || 'all',
        ratePerHour,
        targetDurationHours: config.targetDurationHours || Math.ceil(recipients.length / ratePerHour),
        minDelaySeconds: Math.round(baseSeconds * 0.9),
        maxDelaySeconds: Math.round(baseSeconds * 1.1),
        quietHoursEnabled: config.quietHoursEnabled !== false, // default: true
        quietHoursStart: config.quietHoursStart || '00:00',
        quietHoursEnd: config.quietHoursEnd || '08:00',
        deduplicateAgainstHistory: config.deduplicateAgainstHistory !== false,
        messageText: config.messageText || '',
        imageUrl: config.imageUrl || '',
        audioUrl: config.audioUrl || '',
        videoUrl: config.videoUrl || '',
        documentUrl: config.documentUrl || '',
        documentName: config.documentName || '',
        sendOrder: config.sendOrder || 'text,image,video,audio,document',
        delayBetweenSends: config.delayBetweenSends || 3,
        recipients,
        totalNumbers: recipients.length,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        startedAt: new Date().toISOString(),
        nextScheduledSendAt: new Date(Date.now() + 3000).toISOString(), // Send first message after 3s
        updatedAt: new Date().toISOString(),
    };
    (0, utils_js_1.log)('TARGETED_FUP', `🎬 Started new targeted follow-up job "${activeJob.title}" with ${recipients.length} numbers (Rate: ${ratePerHour}/hr)`);
    return activeJob;
}
function pauseTargetedJob() {
    if (!activeJob)
        return null;
    activeJob.status = 'paused';
    activeJob.updatedAt = new Date().toISOString();
    (0, utils_js_1.log)('TARGETED_FUP', `⏸️ Paused targeted follow-up job "${activeJob.title}"`);
    return activeJob;
}
function resumeTargetedJob() {
    if (!activeJob)
        return null;
    activeJob.status = 'running';
    activeJob.nextScheduledSendAt = new Date(Date.now() + 3000).toISOString();
    activeJob.updatedAt = new Date().toISOString();
    (0, utils_js_1.log)('TARGETED_FUP', `▶️ Resumed targeted follow-up job "${activeJob.title}"`);
    return activeJob;
}
function stopTargetedJob() {
    if (!activeJob)
        return null;
    activeJob.status = 'stopped';
    activeJob.updatedAt = new Date().toISOString();
    (0, utils_js_1.log)('TARGETED_FUP', `⏹️ Stopped targeted follow-up job "${activeJob.title}"`);
    const stopped = { ...activeJob };
    activeJob = null;
    return stopped;
}
function getTargetedJobStatus() {
    return activeJob;
}

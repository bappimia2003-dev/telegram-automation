"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateOrganicDelay = calculateOrganicDelay;
exports.isCurrentlyQuietHours = isCurrentlyQuietHours;
exports.normalizePhoneNumber = normalizePhoneNumber;
exports.startTargetedFollowupScheduler = startTargetedFollowupScheduler;
exports.startNewTargetedJob = startNewTargetedJob;
exports.pauseTargetedJob = pauseTargetedJob;
exports.resumeTargetedJob = resumeTargetedJob;
exports.stopTargetedJob = stopTargetedJob;
exports.getTargetedJobStatus = getTargetedJobStatus;
exports.getAllActiveJobs = getAllActiveJobs;
const uuid_1 = require("uuid");
const crypto_1 = __importDefault(require("crypto"));
const fileSender_js_1 = require("./fileSender.js");
const whatsapp_js_1 = require("./whatsapp.js");
const utils_js_1 = require("./utils.js");
const db_js_1 = require("./db.js");
// In-memory active jobs map keyed by ownerId ('admin' or clientId)
const activeJobs = new Map();
let schedulerInterval = null;
let isLoopRunning = false;
let roundRobinIndex = 0;
/**
 * Box-Muller transform for Gaussian (normal) distribution
 * Generates natural human-like variation centered at mean with standard deviation
 */
function gaussianRandom(mean, stdDev) {
    let u = 0;
    let v = 0;
    while (u === 0)
        u = Math.random();
    while (v === 0)
        v = Math.random();
    const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + num * stdDev;
}
/**
 * Calculates organic anti-ban delay with high-resolution Nanosecond Hardware Entropy.
 * Incorporates Gaussian bell curve distribution and cognitive human breaks.
 */
function calculateOrganicDelay(ratePerHour, consecutiveCount) {
    const safeRate = Math.max(1, Math.min(120, ratePerHour || 20));
    const baseSeconds = 3600 / safeRate;
    // 1. Natural cognitive pause: every 8 to 14 messages, a human pauses naturally
    const breakCycle = 8 + crypto_1.default.randomInt(0, 7);
    const isBreak = consecutiveCount > 0 && consecutiveCount % breakCycle === 0;
    let breakMs = 0;
    if (isBreak) {
        // 35s to 70s organic pause + nanosecond noise
        breakMs = (35 + crypto_1.default.randomInt(0, 35)) * 1000 + crypto_1.default.randomInt(100, 999);
    }
    // 2. Base delay with Gaussian distribution (±16% standard deviation)
    const stdDevSec = baseSeconds * 0.16;
    let delaySec = gaussianRandom(baseSeconds, stdDevSec);
    // Safe bounds: between 0.72x base and 1.35x base, minimum 15 seconds
    delaySec = Math.max(15, Math.max(baseSeconds * 0.72, Math.min(baseSeconds * 1.35, delaySec)));
    // 3. True Nanosecond Hardware Entropy via process.hrtime.bigint()
    const hrNano = Number(process.hrtime.bigint() % 1000000000n);
    const microMs = (hrNano % 1_000_000) / 1_000_000; // Fractional millisecond (nanosecond scale)
    const randMs = crypto_1.default.randomInt(50, 950);
    const totalMs = Math.round(delaySec * 1000) + randMs + microMs + breakMs;
    return {
        delayMs: totalMs,
        delaySec: Math.round(totalMs / 1000),
        isBreak,
    };
}
/**
 * Checks if current time in Bangladesh (GMT+6) falls within permanent quiet hours (00:00 to 08:00)
 */
function isCurrentlyQuietHours(startHourStr = '00:00', endHourStr = '08:00') {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const bdTime = new Date(utcMs + 6 * 3600000);
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
 * Normalizes phone numbers to standard international format (e.g. 01830086837 -> 8801830086837)
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
 * Injects invisible zero-width unicode characters to create a 100% cryptographically
 * unique byte sequence for WhatsApp server heuristics while remaining completely invisible
 * to the human recipient.
 */
function injectAntiFingerprintEntropy(text) {
    if (!text)
        return '';
    const zeroChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
    const hr = process.hrtime.bigint();
    const count = 2 + Number(hr % 3n);
    let entropyStr = '';
    for (let i = 0; i < count; i++) {
        const idx = Number((hr + BigInt(i * 19)) % BigInt(zeroChars.length));
        entropyStr += zeroChars[idx];
    }
    if (text.includes('\n')) {
        const parts = text.split('\n');
        parts[0] = parts[0] + entropyStr;
        return parts.join('\n');
    }
    else if (text.includes(' ')) {
        const spaceIdx = text.indexOf(' ');
        return text.substring(0, spaceIdx) + entropyStr + text.substring(spaceIdx);
    }
    return text + entropyStr;
}
/**
 * Simulates human typing behavior and presence states before sending messages.
 * Simulates typing speed, thinking pauses, and presence updates.
 */
async function simulateHumanTyping(sock, jid, text) {
    try {
        // 1. Set presence to available
        await sock.sendPresenceUpdate('available');
        // 2. Hesitation / reading pause (1.2s - 2.5s with nanosecond noise)
        const nanoRead = Number(process.hrtime.bigint() % 1000000n) / 1_000_000;
        const readPauseMs = 1200 + crypto_1.default.randomInt(100, 1300) + nanoRead;
        await (0, utils_js_1.sleep)(readPauseMs);
        // 3. Set composing indicator
        await sock.sendPresenceUpdate('composing', jid);
        // 4. Calculate realistic typing duration based on character count (35-55ms/char)
        const charCount = text ? text.length : 25;
        const speedPerChar = 35 + crypto_1.default.randomInt(0, 18);
        let typingDurationMs = Math.min(8000, Math.max(1600, charCount * speedPerChar));
        typingDurationMs += crypto_1.default.randomInt(50, 400);
        // If message is lengthy, simulate human pausing mid-sentence
        if (charCount > 65 && typingDurationMs > 3500) {
            const part1 = Math.round(typingDurationMs * 0.55);
            const thinkBreak = 600 + crypto_1.default.randomInt(100, 450);
            const part2 = typingDurationMs - part1;
            await (0, utils_js_1.sleep)(part1);
            await sock.sendPresenceUpdate('paused', jid);
            await (0, utils_js_1.sleep)(thinkBreak);
            await sock.sendPresenceUpdate('composing', jid);
            await (0, utils_js_1.sleep)(part2);
        }
        else {
            await (0, utils_js_1.sleep)(typingDurationMs);
        }
    }
    catch (err) {
        // Presence failures should never block message dispatch
    }
}
/**
 * Pick an active socket based on assignedAccountId and ownerId (Admin or Client)
 */
async function getTargetSocket(preferredAccountId, ownerId) {
    const connectedAccounts = (0, whatsapp_js_1.getAllAccountsInfo)().filter((a) => a.status === 'connected');
    if (connectedAccounts.length === 0)
        return null;
    let eligible = connectedAccounts;
    // If owned by a client, strictly limit to SIMs assigned to that client
    if (ownerId && ownerId !== 'admin') {
        try {
            const dbAccounts = await (0, db_js_1.getAllDbAccounts)();
            const clientAccountIds = new Set(dbAccounts.filter((a) => a.clientId === ownerId).map((a) => a.id));
            eligible = connectedAccounts.filter((a) => clientAccountIds.has(a.id));
        }
        catch (e) {
            (0, utils_js_1.log)('TARGETED_FUP', `⚠️ Could not verify DB accounts for client ${ownerId}, using available`);
        }
    }
    if (eligible.length === 0)
        return null;
    // If specific account selected
    if (preferredAccountId && preferredAccountId !== 'all') {
        const matched = eligible.find((a) => a.id === preferredAccountId);
        if (matched) {
            const sock = (0, whatsapp_js_1.getSocket)(matched.id);
            if (sock)
                return { sock, accountId: matched.id, accountName: matched.name };
        }
        return null;
    }
    // Round-robin across eligible connected accounts
    const chosen = eligible[roundRobinIndex % eligible.length];
    roundRobinIndex++;
    const sock = (0, whatsapp_js_1.getSocket)(chosen.id);
    if (sock) {
        return { sock, accountId: chosen.id, accountName: chosen.name };
    }
    return null;
}
/**
 * Dispatch message and attached media to a single recipient with anti-bot simulation
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
    // Inject zero-width anti-fingerprint bytes for WhatsApp ML spam resistance
    const securedText = injectAntiFingerprintEntropy(personalized);
    // 2. Simulate human presence and typing
    await simulateHumanTyping(sock, jid, securedText);
    // 3. Parse send order
    const orderParts = (job.sendOrder || 'text,image,video,audio,document')
        .split(',')
        .map((s) => s.trim().toLowerCase());
    // Dynamic media gap with organic nanosecond jitter
    const getOrganicGap = () => {
        const baseGap = Math.max(1500, (job.delayBetweenSends || 3) * 1000);
        const jitter = crypto_1.default.randomInt(-500, 1000) + (Number(process.hrtime.bigint() % 1000000n) / 1_000_000);
        return Math.max(1200, Math.round(baseGap + jitter));
    };
    for (let i = 0; i < orderParts.length; i++) {
        const item = orderParts[i];
        if (item === 'text' || item === 'message') {
            if (securedText.trim()) {
                await (0, fileSender_js_1.sendTextMessage)(sock, jid, securedText);
                if (i < orderParts.length - 1)
                    await (0, utils_js_1.sleep)(getOrganicGap());
            }
        }
        else if (item === 'image' && job.imageUrl) {
            await (0, fileSender_js_1.sendImageMessage)(sock, jid, job.imageUrl);
            if (i < orderParts.length - 1)
                await (0, utils_js_1.sleep)(getOrganicGap());
        }
        else if (item === 'video' && job.videoUrl) {
            await (0, fileSender_js_1.sendVideoMessage)(sock, jid, job.videoUrl);
            if (i < orderParts.length - 1)
                await (0, utils_js_1.sleep)(getOrganicGap());
        }
        else if (item === 'audio' && job.audioUrl) {
            await (0, fileSender_js_1.sendAudioMessage)(sock, jid, job.audioUrl);
            if (i < orderParts.length - 1)
                await (0, utils_js_1.sleep)(getOrganicGap());
        }
        else if (item === 'document' && job.documentUrl) {
            await (0, fileSender_js_1.sendDocumentMessage)(sock, jid, job.documentUrl, job.documentName || 'Document.pdf');
            if (i < orderParts.length - 1)
                await (0, utils_js_1.sleep)(getOrganicGap());
        }
    }
    try {
        await sock.sendPresenceUpdate('paused', jid);
    }
    catch { }
}
/**
 * Tick a single active targeted followup job
 */
async function tickSingleJob(job) {
    if (job.status !== 'running')
        return;
    // 1. Permanent Quiet Hours Check (00:00 - 08:00 Bangladesh Time GMT+6)
    if (isCurrentlyQuietHours(job.quietHoursStart, job.quietHoursEnd)) {
        (0, utils_js_1.log)('TARGETED_FUP', `🌙 [${job.ownerId}] Night Quiet Hours active (00:00 - 08:00 BD Time). Delivery permanently paused until morning.`);
        return;
    }
    // 2. Check scheduled send timestamp
    const now = Date.now();
    if (job.nextScheduledSendAt) {
        const scheduledMs = new Date(job.nextScheduledSendAt).getTime();
        if (now < scheduledMs) {
            return;
        }
    }
    // 3. Find next pending recipient
    const nextRecipient = job.recipients.find((r) => r.status === 'pending');
    if (!nextRecipient) {
        job.status = 'completed';
        job.completedAt = new Date().toISOString();
        job.updatedAt = new Date().toISOString();
        (0, utils_js_1.log)('TARGETED_FUP', `🎉 [${job.ownerId}] Targeted Follow-up Job "${job.title}" completed! Sent: ${job.sentCount}, Failed: ${job.failedCount}, Skipped: ${job.skippedCount}`);
        return;
    }
    // 4. Permanent Strict Deduplication against historical contacted database
    try {
        const alreadySent = await (0, db_js_1.isAlreadyContacted)(job.id, nextRecipient.phone);
        if (alreadySent) {
            nextRecipient.status = 'skipped';
            nextRecipient.error = 'পূর্বে মেসেজ পাঠানো হয়েছে (Strict Deduplication)';
            job.skippedCount++;
            job.updatedAt = new Date().toISOString();
            (0, utils_js_1.log)('TARGETED_FUP', `🛡️ [${job.ownerId}] Skipped ${nextRecipient.phone} (Already contacted previously).`);
            return;
        }
    }
    catch (err) {
        // If db check fails, proceed safely
    }
    // 5. Check socket availability for this owner
    const target = await getTargetSocket(job.assignedAccountId, job.ownerId);
    if (!target) {
        (0, utils_js_1.log)('TARGETED_FUP', `⏳ [${job.ownerId}] No connected WhatsApp account available for owner "${job.ownerId}". Waiting...`);
        return;
    }
    // 6. Send message
    nextRecipient.status = 'sending';
    job.updatedAt = new Date().toISOString();
    (0, utils_js_1.log)('TARGETED_FUP', `🚀 [${job.ownerId}] Sending targeted message to ${nextRecipient.phone} via [${target.accountName}]...`);
    try {
        await sendTargetedMessage(target.sock, nextRecipient.phone, nextRecipient.name, job);
        nextRecipient.status = 'sent';
        nextRecipient.sentAt = new Date().toISOString();
        nextRecipient.sentFromAccountId = target.accountId;
        job.sentCount++;
        job.consecutiveSends++;
        job.lastSentAt = new Date().toISOString();
        // Mark recipient as contacted in DB to ensure permanent future deduplication
        try {
            await (0, db_js_1.markAsContacted)({
                id: (0, uuid_1.v4)(),
                campaignId: job.id,
                phoneNumber: nextRecipient.phone,
                contactName: nextRecipient.name || '',
                sentAt: new Date().toISOString(),
                status: 'sent',
            });
        }
        catch { }
        (0, utils_js_1.log)('TARGETED_FUP', `✅ [${job.ownerId}] Successfully delivered to ${nextRecipient.phone} (${job.sentCount}/${job.totalNumbers})`);
    }
    catch (sendErr) {
        nextRecipient.status = 'failed';
        nextRecipient.error = sendErr.message || 'Delivery error';
        job.failedCount++;
        (0, utils_js_1.errLog)('TARGETED_FUP', `❌ [${job.ownerId}] Failed delivery to ${nextRecipient.phone}:`, sendErr.message);
    }
    // 7. Schedule next send with high-resolution nanosecond anti-ban pacing
    const { delayMs, delaySec, isBreak } = calculateOrganicDelay(job.ratePerHour, job.consecutiveSends);
    job.nextScheduledSendAt = new Date(Date.now() + delayMs).toISOString();
    job.updatedAt = new Date().toISOString();
    if (isBreak) {
        (0, utils_js_1.log)('TARGETED_FUP', `☕ [${job.ownerId}] Anti-Bot Cognitive Human Break active! Next message in ${delaySec}s (${(delayMs / 1000).toFixed(3)}s)`);
    }
    else {
        (0, utils_js_1.log)('TARGETED_FUP', `⏱️ [${job.ownerId}] Next message scheduled in ${delaySec}s (${(delayMs / 1000).toFixed(3)}s) with nano-jitter`);
    }
}
/**
 * Main background tick loop across all active jobs
 */
async function tickTargetedFollowup() {
    if (activeJobs.size === 0)
        return;
    if (isLoopRunning)
        return;
    isLoopRunning = true;
    try {
        for (const job of activeJobs.values()) {
            if (job.status === 'running') {
                await tickSingleJob(job);
            }
        }
    }
    catch (err) {
        (0, utils_js_1.errLog)('TARGETED_FUP', 'Exception in targeted followup scheduler loop:', err.message);
    }
    finally {
        isLoopRunning = false;
    }
}
/**
 * Initialize background scheduler (ticks every 5 seconds)
 */
function startTargetedFollowupScheduler() {
    if (schedulerInterval)
        return;
    (0, utils_js_1.log)('TARGETED_FUP', '⚡ Targeted Follow-up High-Precision Scheduler initialized (checking every 5s)...');
    schedulerInterval = setInterval(tickTargetedFollowup, 5000);
}
/**
 * Configure and start a new targeted follow-up job (Admin or Client)
 */
function startNewTargetedJob(config) {
    const ownerId = (config.ownerId || config.clientId || 'admin').trim();
    // 1. Process and deduplicate numbers (max 300)
    const lines = (config.rawNumbers || '')
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    const seen = new Set();
    const recipients = [];
    for (const line of lines) {
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
                break; // Strict maximum 300 limit
        }
    }
    const ratePerHour = Math.max(1, Math.min(120, Number(config.ratePerHour) || 20));
    const baseSeconds = Math.round(3600 / ratePerHour);
    const job = {
        id: config.id || `tfup_${ownerId}_${Date.now()}`,
        ownerId,
        clientName: config.clientName,
        title: config.title || `Targeted Broadcast ${new Date().toLocaleDateString('bn-BD')}`,
        status: 'running',
        assignedAccountId: config.assignedAccountId || 'all',
        ratePerHour,
        targetDurationHours: config.targetDurationHours || Math.ceil(recipients.length / ratePerHour),
        minDelaySeconds: Math.round(baseSeconds * 0.72),
        maxDelaySeconds: Math.round(baseSeconds * 1.35),
        quietHoursEnabled: true, // Permanent hardcoded rule: 00:00 to 08:00 BD Time
        quietHoursStart: '00:00',
        quietHoursEnd: '08:00',
        deduplicateAgainstHistory: true, // Permanent hardcoded rule
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
        consecutiveSends: 0,
        startedAt: new Date().toISOString(),
        nextScheduledSendAt: new Date(Date.now() + 2500).toISOString(),
        updatedAt: new Date().toISOString(),
    };
    activeJobs.set(ownerId, job);
    (0, utils_js_1.log)('TARGETED_FUP', `🎬 Started Targeted Follow-up job for [${ownerId}] "${job.title}" with ${recipients.length} numbers (Rate: ${ratePerHour}/hr)`);
    return job;
}
function pauseTargetedJob(ownerId = 'admin') {
    const job = activeJobs.get(ownerId);
    if (!job)
        return null;
    job.status = 'paused';
    job.updatedAt = new Date().toISOString();
    (0, utils_js_1.log)('TARGETED_FUP', `⏸️ Paused targeted job for [${ownerId}]`);
    return job;
}
function resumeTargetedJob(ownerId = 'admin') {
    const job = activeJobs.get(ownerId);
    if (!job)
        return null;
    job.status = 'running';
    job.nextScheduledSendAt = new Date(Date.now() + 2500).toISOString();
    job.updatedAt = new Date().toISOString();
    (0, utils_js_1.log)('TARGETED_FUP', `▶️ Resumed targeted job for [${ownerId}]`);
    return job;
}
function stopTargetedJob(ownerId = 'admin') {
    const job = activeJobs.get(ownerId);
    if (!job)
        return null;
    job.status = 'stopped';
    job.updatedAt = new Date().toISOString();
    const stopped = { ...job };
    activeJobs.delete(ownerId);
    (0, utils_js_1.log)('TARGETED_FUP', `⏹️ Stopped targeted job for [${ownerId}]`);
    return stopped;
}
function getTargetedJobStatus(ownerId = 'admin') {
    if (activeJobs.has(ownerId)) {
        return activeJobs.get(ownerId);
    }
    // If admin requests and no exact 'admin' job exists, return any running job
    if (ownerId === 'admin' && activeJobs.size > 0) {
        return activeJobs.values().next().value || null;
    }
    return null;
}
function getAllActiveJobs() {
    return Array.from(activeJobs.values());
}

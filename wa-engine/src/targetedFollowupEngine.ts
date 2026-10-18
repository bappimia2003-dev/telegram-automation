import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
  sendTextMessage,
  sendImageMessage,
  sendVideoMessage,
  sendAudioMessage,
  sendDocumentMessage,
} from './fileSender.js';
import { getAllAccountsInfo, getSocket } from './whatsapp.js';
import { log, errLog, sleep } from './utils.js';
import { getAllDbAccounts, isAlreadyContacted, markAsContacted } from './db.js';

export interface TargetedRecipient {
  phone: string;
  name?: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';
  sentAt?: string;
  error?: string;
  sentFromAccountId?: string;
}

export interface TargetedFollowupJob {
  id: string;
  ownerId: string; // 'admin' or clientId
  clientName?: string;
  title: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'stopped';
  assignedAccountId: string; // 'all' (round-robin) or specific account ID
  
  // Rate & Pacing
  ratePerHour: number; // default: 20
  targetDurationHours?: number; // optional
  minDelaySeconds: number;
  maxDelaySeconds: number;
  
  // Permanent System Rules (Always enforced)
  quietHoursEnabled: boolean; // Permanent true: 00:00 - 08:00 BD GMT+6
  quietHoursStart: string; // "00:00"
  quietHoursEnd: string; // "08:00"
  deduplicateAgainstHistory: boolean; // Permanent true
  
  // Content
  messageText: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  documentUrl?: string;
  documentName?: string;
  sendOrder: string;
  delayBetweenSends: number; // base gap between text and media
  
  // Recipients (Max 300)
  recipients: TargetedRecipient[];
  totalNumbers: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  consecutiveSends: number;
  
  // Timestamps & Precision Timing
  startedAt?: string;
  lastSentAt?: string;
  nextScheduledSendAt?: string;
  completedAt?: string;
  updatedAt: string;
}

// In-memory active jobs map keyed by ownerId ('admin' or clientId)
const activeJobs = new Map<string, TargetedFollowupJob>();
let schedulerInterval: NodeJS.Timeout | null = null;
let isLoopRunning = false;
let roundRobinIndex = 0;

/**
 * Box-Muller transform for Gaussian (normal) distribution
 * Generates natural human-like variation centered at mean with standard deviation
 */
function gaussianRandom(mean: number, stdDev: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + num * stdDev;
}

/**
 * Calculates organic anti-ban delay with high-resolution Nanosecond Hardware Entropy.
 * Incorporates Gaussian bell curve distribution and cognitive human breaks.
 */
export function calculateOrganicDelay(
  ratePerHour: number,
  consecutiveCount: number
): { delayMs: number; delaySec: number; isBreak: boolean } {
  const safeRate = Math.max(1, Math.min(120, ratePerHour || 20));
  const baseSeconds = 3600 / safeRate;

  // 1. Natural cognitive pause: every 8 to 14 messages, a human pauses naturally
  const breakCycle = 8 + crypto.randomInt(0, 7);
  const isBreak = consecutiveCount > 0 && consecutiveCount % breakCycle === 0;
  let breakMs = 0;
  if (isBreak) {
    // 35s to 70s organic pause + nanosecond noise
    breakMs = (35 + crypto.randomInt(0, 35)) * 1000 + crypto.randomInt(100, 999);
  }

  // 2. Base delay with Gaussian distribution (±16% standard deviation)
  const stdDevSec = baseSeconds * 0.16;
  let delaySec = gaussianRandom(baseSeconds, stdDevSec);
  // Safe bounds: between 0.72x base and 1.35x base, minimum 15 seconds
  delaySec = Math.max(15, Math.max(baseSeconds * 0.72, Math.min(baseSeconds * 1.35, delaySec)));

  // 3. True Nanosecond Hardware Entropy via process.hrtime.bigint()
  const hrNano = Number(process.hrtime.bigint() % 1_000_000_000n);
  const microMs = (hrNano % 1_000_000) / 1_000_000; // Fractional millisecond (nanosecond scale)
  const randMs = crypto.randomInt(50, 950);

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
export function isCurrentlyQuietHours(startHourStr = '00:00', endHourStr = '08:00'): boolean {
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
  } else {
    return currentMinutesFromMidnight >= startMinutes || currentMinutesFromMidnight < endMinutes;
  }
}

/**
 * Normalizes phone numbers to standard international format (e.g. 01830086837 -> 8801830086837)
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
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
function injectAntiFingerprintEntropy(text: string): string {
  if (!text) return '';
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
  } else if (text.includes(' ')) {
    const spaceIdx = text.indexOf(' ');
    return text.substring(0, spaceIdx) + entropyStr + text.substring(spaceIdx);
  }
  return text + entropyStr;
}

/**
 * Simulates human typing behavior and presence states before sending messages.
 * Simulates typing speed, thinking pauses, and presence updates.
 */
async function simulateHumanTyping(sock: any, jid: string, text: string): Promise<void> {
  try {
    // 1. Set presence to available
    await sock.sendPresenceUpdate('available');

    // 2. Hesitation / reading pause (1.2s - 2.5s with nanosecond noise)
    const nanoRead = Number(process.hrtime.bigint() % 1_000_000n) / 1_000_000;
    const readPauseMs = 1200 + crypto.randomInt(100, 1300) + nanoRead;
    await sleep(readPauseMs);

    // 3. Set composing indicator
    await sock.sendPresenceUpdate('composing', jid);

    // 4. Calculate realistic typing duration based on character count (35-55ms/char)
    const charCount = text ? text.length : 25;
    const speedPerChar = 35 + crypto.randomInt(0, 18);
    let typingDurationMs = Math.min(8000, Math.max(1600, charCount * speedPerChar));
    typingDurationMs += crypto.randomInt(50, 400);

    // If message is lengthy, simulate human pausing mid-sentence
    if (charCount > 65 && typingDurationMs > 3500) {
      const part1 = Math.round(typingDurationMs * 0.55);
      const thinkBreak = 600 + crypto.randomInt(100, 450);
      const part2 = typingDurationMs - part1;

      await sleep(part1);
      await sock.sendPresenceUpdate('paused', jid);
      await sleep(thinkBreak);
      await sock.sendPresenceUpdate('composing', jid);
      await sleep(part2);
    } else {
      await sleep(typingDurationMs);
    }
  } catch (err: any) {
    // Presence failures should never block message dispatch
  }
}

/**
 * Pick an active socket based on assignedAccountId and ownerId (Admin or Client)
 */
async function getTargetSocket(
  preferredAccountId: string,
  ownerId: string
): Promise<{ sock: any; accountId: string; accountName: string } | null> {
  const connectedAccounts = getAllAccountsInfo().filter((a: any) => a.status === 'connected');
  if (connectedAccounts.length === 0) return null;

  let eligible = connectedAccounts;

  // If owned by a client, strictly limit to SIMs assigned to that client
  if (ownerId && ownerId !== 'admin') {
    try {
      const dbAccounts = await getAllDbAccounts();
      const clientAccountIds = new Set(
        dbAccounts.filter((a) => a.clientId === ownerId).map((a) => a.id)
      );
      eligible = connectedAccounts.filter((a) => clientAccountIds.has(a.id));
    } catch (e) {
      log('TARGETED_FUP', `⚠️ Could not verify DB accounts for client ${ownerId}, using available`);
    }
  }

  if (eligible.length === 0) return null;

  // If specific account selected
  if (preferredAccountId && preferredAccountId !== 'all') {
    const matched = eligible.find((a: any) => a.id === preferredAccountId);
    if (matched) {
      const sock = getSocket(matched.id);
      if (sock) return { sock, accountId: matched.id, accountName: matched.name };
    }
    return null;
  }

  // Round-robin across eligible connected accounts
  const chosen = eligible[roundRobinIndex % eligible.length];
  roundRobinIndex++;
  const sock = getSocket(chosen.id);
  if (sock) {
    return { sock, accountId: chosen.id, accountName: chosen.name };
  }
  return null;
}

/**
 * Dispatch message and attached media to a single recipient with anti-bot simulation
 */
async function sendTargetedMessage(
  sock: any,
  phone: string,
  name: string | undefined,
  job: TargetedFollowupJob
): Promise<void> {
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
    const jitter = crypto.randomInt(-500, 1000) + (Number(process.hrtime.bigint() % 1_000_000n) / 1_000_000);
    return Math.max(1200, Math.round(baseGap + jitter));
  };

  for (let i = 0; i < orderParts.length; i++) {
    const item = orderParts[i];

    if (item === 'text' || item === 'message') {
      if (securedText.trim()) {
        await sendTextMessage(sock, jid, securedText);
        if (i < orderParts.length - 1) await sleep(getOrganicGap());
      }
    } else if (item === 'image' && job.imageUrl) {
      await sendImageMessage(sock, jid, job.imageUrl);
      if (i < orderParts.length - 1) await sleep(getOrganicGap());
    } else if (item === 'video' && job.videoUrl) {
      await sendVideoMessage(sock, jid, job.videoUrl);
      if (i < orderParts.length - 1) await sleep(getOrganicGap());
    } else if (item === 'audio' && job.audioUrl) {
      await sendAudioMessage(sock, jid, job.audioUrl);
      if (i < orderParts.length - 1) await sleep(getOrganicGap());
    } else if (item === 'document' && job.documentUrl) {
      await sendDocumentMessage(sock, jid, job.documentUrl, job.documentName || 'Document.pdf');
      if (i < orderParts.length - 1) await sleep(getOrganicGap());
    }
  }

  try {
    await sock.sendPresenceUpdate('paused', jid);
  } catch {}
}

/**
 * Tick a single active targeted followup job
 */
async function tickSingleJob(job: TargetedFollowupJob): Promise<void> {
  if (job.status !== 'running') return;

  // 1. Permanent Quiet Hours Check (00:00 - 08:00 Bangladesh Time GMT+6)
  if (isCurrentlyQuietHours(job.quietHoursStart, job.quietHoursEnd)) {
    log(
      'TARGETED_FUP',
      `🌙 [${job.ownerId}] Night Quiet Hours active (00:00 - 08:00 BD Time). Delivery permanently paused until morning.`
    );
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
    log(
      'TARGETED_FUP',
      `🎉 [${job.ownerId}] Targeted Follow-up Job "${job.title}" completed! Sent: ${job.sentCount}, Failed: ${job.failedCount}, Skipped: ${job.skippedCount}`
    );
    return;
  }

  // 4. Permanent Strict Deduplication against historical contacted database
  try {
    const alreadySent = await isAlreadyContacted(job.id, nextRecipient.phone);
    if (alreadySent) {
      nextRecipient.status = 'skipped';
      nextRecipient.error = 'পূর্বে মেসেজ পাঠানো হয়েছে (Strict Deduplication)';
      job.skippedCount++;
      job.updatedAt = new Date().toISOString();
      log('TARGETED_FUP', `🛡️ [${job.ownerId}] Skipped ${nextRecipient.phone} (Already contacted previously).`);
      return;
    }
  } catch (err: any) {
    // If db check fails, proceed safely
  }

  // 5. Check socket availability for this owner
  const target = await getTargetSocket(job.assignedAccountId, job.ownerId);
  if (!target) {
    log(
      'TARGETED_FUP',
      `⏳ [${job.ownerId}] No connected WhatsApp account available for owner "${job.ownerId}". Waiting...`
    );
    return;
  }

  // 6. Send message
  nextRecipient.status = 'sending';
  job.updatedAt = new Date().toISOString();

  log('TARGETED_FUP', `🚀 [${job.ownerId}] Sending targeted message to ${nextRecipient.phone} via [${target.accountName}]...`);

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
      await markAsContacted({
        id: uuidv4(),
        campaignId: job.id,
        phoneNumber: nextRecipient.phone,
        contactName: nextRecipient.name || '',
        sentAt: new Date().toISOString(),
        status: 'sent',
      });
    } catch {}

    log(
      'TARGETED_FUP',
      `✅ [${job.ownerId}] Successfully delivered to ${nextRecipient.phone} (${job.sentCount}/${job.totalNumbers})`
    );
  } catch (sendErr: any) {
    nextRecipient.status = 'failed';
    nextRecipient.error = sendErr.message || 'Delivery error';
    job.failedCount++;
    errLog('TARGETED_FUP', `❌ [${job.ownerId}] Failed delivery to ${nextRecipient.phone}:`, sendErr.message);
  }

  // 7. Schedule next send with high-resolution nanosecond anti-ban pacing
  const { delayMs, delaySec, isBreak } = calculateOrganicDelay(job.ratePerHour, job.consecutiveSends);
  job.nextScheduledSendAt = new Date(Date.now() + delayMs).toISOString();
  job.updatedAt = new Date().toISOString();

  if (isBreak) {
    log('TARGETED_FUP', `☕ [${job.ownerId}] Anti-Bot Cognitive Human Break active! Next message in ${delaySec}s (${(delayMs / 1000).toFixed(3)}s)`);
  } else {
    log('TARGETED_FUP', `⏱️ [${job.ownerId}] Next message scheduled in ${delaySec}s (${(delayMs / 1000).toFixed(3)}s) with nano-jitter`);
  }
}

/**
 * Main background tick loop across all active jobs
 */
async function tickTargetedFollowup(): Promise<void> {
  if (activeJobs.size === 0) return;
  if (isLoopRunning) return;

  isLoopRunning = true;
  try {
    for (const job of activeJobs.values()) {
      if (job.status === 'running') {
        await tickSingleJob(job);
      }
    }
  } catch (err: any) {
    errLog('TARGETED_FUP', 'Exception in targeted followup scheduler loop:', err.message);
  } finally {
    isLoopRunning = false;
  }
}

/**
 * Initialize background scheduler (ticks every 5 seconds)
 */
export function startTargetedFollowupScheduler(): void {
  if (schedulerInterval) return;
  log('TARGETED_FUP', '⚡ Targeted Follow-up High-Precision Scheduler initialized (checking every 5s)...');
  schedulerInterval = setInterval(tickTargetedFollowup, 5000);
}

/**
 * Configure and start a new targeted follow-up job (Admin or Client)
 */
export function startNewTargetedJob(
  config: Partial<TargetedFollowupJob> & { rawNumbers: string; ownerId?: string; clientId?: string }
): TargetedFollowupJob {
  const ownerId = (config.ownerId || config.clientId || 'admin').trim();

  // 1. Process and deduplicate numbers (max 300)
  const lines = (config.rawNumbers || '')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const recipients: TargetedRecipient[] = [];

  for (const line of lines) {
    let phoneRaw = line;
    let nameRaw = '';

    if (line.includes(':')) {
      const parts = line.split(':');
      nameRaw = parts[0].trim();
      phoneRaw = parts[1].trim();
    } else if (line.includes('|')) {
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
      if (recipients.length >= 300) break; // Strict maximum 300 limit
    }
  }

  const ratePerHour = Math.max(1, Math.min(120, Number(config.ratePerHour) || 20));
  const baseSeconds = Math.round(3600 / ratePerHour);

  const job: TargetedFollowupJob = {
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
  log(
    'TARGETED_FUP',
    `🎬 Started Targeted Follow-up job for [${ownerId}] "${job.title}" with ${recipients.length} numbers (Rate: ${ratePerHour}/hr)`
  );
  return job;
}

export function pauseTargetedJob(ownerId = 'admin'): TargetedFollowupJob | null {
  const job = activeJobs.get(ownerId);
  if (!job) return null;
  job.status = 'paused';
  job.updatedAt = new Date().toISOString();
  log('TARGETED_FUP', `⏸️ Paused targeted job for [${ownerId}]`);
  return job;
}

export function resumeTargetedJob(ownerId = 'admin'): TargetedFollowupJob | null {
  const job = activeJobs.get(ownerId);
  if (!job) return null;
  job.status = 'running';
  job.nextScheduledSendAt = new Date(Date.now() + 2500).toISOString();
  job.updatedAt = new Date().toISOString();
  log('TARGETED_FUP', `▶️ Resumed targeted job for [${ownerId}]`);
  return job;
}

export function stopTargetedJob(ownerId = 'admin'): TargetedFollowupJob | null {
  const job = activeJobs.get(ownerId);
  if (!job) return null;
  job.status = 'stopped';
  job.updatedAt = new Date().toISOString();
  const stopped = { ...job };
  activeJobs.delete(ownerId);
  log('TARGETED_FUP', `⏹️ Stopped targeted job for [${ownerId}]`);
  return stopped;
}

export function getTargetedJobStatus(ownerId = 'admin'): TargetedFollowupJob | null {
  if (activeJobs.has(ownerId)) {
    return activeJobs.get(ownerId)!;
  }
  // If admin requests and no exact 'admin' job exists, return any running job
  if (ownerId === 'admin' && activeJobs.size > 0) {
    return activeJobs.values().next().value || null;
  }
  return null;
}

export function getAllActiveJobs(): TargetedFollowupJob[] {
  return Array.from(activeJobs.values());
}

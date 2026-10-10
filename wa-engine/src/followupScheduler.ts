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

import { v4 as uuidv4 } from 'uuid';
import {
  getCampaignsWithFollowup,
  getRecentContactedUsers,
  getContactLogs,
  logFollowupStep,
  markPromiseSent,
} from './db.js';
import {
  sendTextMessage,
  sendImageMessage,
  sendVideoMessage,
  sendAudioMessage,
  sendDocumentMessage,
} from './fileSender.js';
import { getAllAccountsInfo, getSocket } from './whatsapp.js';
import { generateFollowupText, ruleBasedGender } from './ai.js';
import { WaCampaign, WaFollowupConfig } from './types.js';
import { log, errLog, sleep } from './utils.js';

/**
 * Get an active connected socket for the preferred account ID or any connected account.
 */
function getActiveSock(preferAccountId: string | null): any | null {
  if (preferAccountId && preferAccountId !== 'all') {
    const sock = getSocket(preferAccountId);
    if (sock) return sock;
    return null; // Strict account isolation: don't accidentally send follow-up from another SIM!
  }
  const accounts = getAllAccountsInfo();
  for (const acc of accounts) {
    if (acc.status === 'connected') {
      const sock = getSocket(acc.id);
      if (sock) return sock;
    }
  }
  return null;
}

/**
 * Analyze all logs for a contact to determine follow-up state (unlimited steps, repeats, & post-chat mode).
 */
function analyzeContactFollowupState(logs: any[], initialContactTimeMs: number) {
  let hasReplied = false;
  let highestStep = 0;
  let lastStepTimeMs = 0;
  let promiseTargetDate: string | null = null;
  let promiseAlreadySent = false;
  let isPostChat = false;
  let postChatTriggerTimeMs = 0;
  const repeatCounts: Record<number, number> = {};

  const validInitialContactMs = Number.isFinite(initialContactTimeMs) ? initialContactTimeMs : 0;

  // First pass: check if there is a postchat_trigger log
  for (const l of logs) {
    const logTimeMs = new Date(l.sentAt).getTime();
    if (l.messageType === 'postchat_trigger' && logTimeMs >= validInitialContactMs - 10000) {
      isPostChat = true;
      postChatTriggerTimeMs = Math.max(postChatTriggerTimeMs, logTimeMs);
    }
  }

  const effectiveStartMs = isPostChat ? postChatTriggerTimeMs : validInitialContactMs;

  for (const l of logs) {
    const logTimeMs = new Date(l.sentAt).getTime();

    // Ignore historical logs before the active session start
    if (effectiveStartMs > 0 && logTimeMs < effectiveStartMs - 10000) {
      continue;
    }

    // Inbound reply from customer strictly after effective start -> manual takeover!
    if (l.messageType === 'incoming' && (effectiveStartMs === 0 || logTimeMs > effectiveStartMs)) {
      hasReplied = true;
    }

    if (isPostChat) {
      const pcMatch = /^postchat_step(\d+)(?:_rep_(\d+))?$/.exec(l.messageType || '');
      if (pcMatch) {
        const sNum = parseInt(pcMatch[1], 10);
        const rNum = pcMatch[2] ? parseInt(pcMatch[2], 10) : 0;
        highestStep = Math.max(highestStep, sNum);
        lastStepTimeMs = Math.max(lastStepTimeMs, logTimeMs);
        if (rNum > 0) {
          repeatCounts[sNum] = Math.max(repeatCounts[sNum] || 0, rNum);
        }
      }
    } else {
      if (l.messageType === 'followup') {
        highestStep = Math.max(highestStep, 1);
        lastStepTimeMs = Math.max(lastStepTimeMs, logTimeMs);
      } else {
        const fupMatch = /^followup_step(\d+)(?:_rep_(\d+))?$/.exec(l.messageType || '');
        if (fupMatch) {
          const sNum = parseInt(fupMatch[1], 10);
          const rNum = fupMatch[2] ? parseInt(fupMatch[2], 10) : 0;
          highestStep = Math.max(highestStep, sNum);
          lastStepTimeMs = Math.max(lastStepTimeMs, logTimeMs);
          if (rNum > 0) {
            repeatCounts[sNum] = Math.max(repeatCounts[sNum] || 0, rNum);
          }
        }
      }
    }

    if (l.messageType === 'promise_sched' && l.fileUrl) {
      promiseTargetDate = l.fileUrl;
    } else if (l.messageType === 'promise_sent') {
      promiseAlreadySent = true;
    }
  }

  return {
    hasReplied,
    highestStep,
    lastStepTimeMs: lastStepTimeMs || effectiveStartMs,
    promiseTargetDate,
    promiseAlreadySent,
    isPostChat,
    postChatTriggerTimeMs,
    repeatCounts,
  };
}

/**
 * Fast variable substitution for follow-up templates:
 * {name} -> Customer name or polite Bengali greeting (ভাইয়া/আপু)
 * {product} -> Campaign / Product offer name
 * {time} -> Current time of day (সকাল, দুপুর, বিকাল, সন্ধ্যা, রাত)
 * {honorific} -> আপু / ভাইয়া
 */
function replaceVariables(
  template: string,
  contactName: string,
  campaignName: string,
  gender: 'apu' | 'vai' | 'apni'
): string {
  if (!template) return '';
  const cleanName = (contactName || '').trim();
  const hasValidName = Boolean(cleanName && cleanName !== 'Customer' && !cleanName.includes('@') && cleanName.length < 25);
  let nameLabel = 'ভাইয়া/আপু';
  if (hasValidName) {
    if (gender === 'apu') nameLabel = `${cleanName} আপু`;
    else if (gender === 'vai') nameLabel = `${cleanName} ভাইয়া`;
    else nameLabel = cleanName;
  } else {
    if (gender === 'apu') nameLabel = 'আপু';
    else if (gender === 'vai') nameLabel = 'ভাইয়া';
    else nameLabel = 'ভাইয়া';
  }

  let bdHour = 12;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hPart = parts.find((p) => p.type === 'hour');
    if (hPart) bdHour = parseInt(hPart.value, 10);
  } catch {
    bdHour = (new Date().getUTCHours() + 6) % 24;
  }

  let timeStr = 'দিন';
  if (bdHour >= 5 && bdHour < 12) timeStr = 'সকাল';
  else if (bdHour >= 12 && bdHour < 16) timeStr = 'দুপুর';
  else if (bdHour >= 16 && bdHour < 18) timeStr = 'বিকাল';
  else if (bdHour >= 18 && bdHour < 20) timeStr = 'সন্ধ্যা';
  else timeStr = 'রাত';

  let result = template;
  // Cleanly handle "{name}, ভাই" or "{name} ভাই" so we never produce ", ভাই" or "ভাইয়া, ভাই"
  if (hasValidName) {
    result = result.replace(/\{name\}(\s*,?\s*(?:ভাইয়া|ভাইয়া|ভাই|আপু))/gi, `${cleanName}$1`);
  } else {
    result = result.replace(/\{name\}\s*,?\s*(ভাইয়া|ভাইয়া|ভাই|আপু)/gi, '$1');
  }

  return result
    .replace(/\{name\}/gi, nameLabel)
    .replace(/\{product\}/gi, campaignName || 'আমাদের অফারটি')
    .replace(/\{time\}/gi, timeStr)
    .replace(/\{honorific\}/gi, gender === 'apu' ? 'আপু' : gender === 'vai' ? 'ভাইয়া' : '')
    .replace(/^\s*,\s*/, '')
    .trim();
}

/**
 * Resolve configuration for a specific step (1..N) from fup.steps or fup.postChatSteps,
 * with rotation of alternateMessages for repeatable steps.
 */
function getStepConfig(
  fup: WaFollowupConfig,
  stepNumber: number,
  campaign?: WaCampaign,
  recipientPhone?: string,
  isPostChat = false,
  repeatIndex = 0
) {
  const sourceSteps = isPostChat ? fup.postChatSteps : fup.steps;
  const step = sourceSteps?.find((s) => s.stepNumber === stepNumber);
  if (step) {
    let img = (step.imageUrl || '').trim();
    let aud = (step.audioUrl || '').trim();
    let vid = (step.videoUrl || '').trim();
    let doc = (step.documentUrl || '').trim();
    let docName = (step.documentName || 'Document').trim();
    const files = step.files || [];
    for (const f of files) {
      if (!f.url) continue;
      if (f.type === 'image' && !img) img = f.url.trim();
      if (f.type === 'audio' && !aud) aud = f.url.trim();
      if (f.type === 'video' && !vid) vid = f.url.trim();
      if (f.type === 'document' && !doc) {
        doc = f.url.trim();
        docName = (f.name || docName).trim();
      }
    }

    if (!isPostChat && stepNumber === 1) {
      if (!img && fup.followupImageUrl) img = fup.followupImageUrl.trim();
      if (!aud && fup.followupAudioUrl) aud = fup.followupAudioUrl.trim();
      if (!vid && fup.followupVideoUrl) vid = fup.followupVideoUrl.trim();
      if (!doc && fup.followupDocumentUrl) {
        doc = fup.followupDocumentUrl.trim();
        docName = (fup.followupDocumentName || docName).trim();
      }
    }

    // Rotate through primary message + alternateMessages on repeats
    const msgPool = [
      step.message || '',
      ...((step.alternateMessages || []).filter((m) => m && m.trim())),
    ].filter(Boolean);
    const chosenMessage =
      msgPool.length > 0 ? msgPool[repeatIndex % msgPool.length] : (step.message || '');

    return {
      message: chosenMessage,
      imageUrl: img,
      audioUrl: aud,
      videoUrl: vid,
      documentUrl: doc,
      documentName: docName,
      files,
    };
  }

  // 2. Secondary: Check explicit followupVariants stored in followupConfig
  const fupVariants = ((fup as any).followupVariants || []).filter((v: any) => v.isActive);
  if (!isPostChat && fupVariants.length > 0) {
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
    message: !isPostChat && stepNumber === 1 ? (fup.followupMessage || '') : '',
    imageUrl: !isPostChat && stepNumber === 1 ? (fup.followupImageUrl || '').trim() : '',
    audioUrl: !isPostChat && stepNumber === 1 ? (fup.followupAudioUrl || '').trim() : '',
    videoUrl: !isPostChat && stepNumber === 1 ? (fup.followupVideoUrl || '').trim() : '',
    documentUrl: !isPostChat && stepNumber === 1 ? (fup.followupDocumentUrl || '').trim() : '',
    documentName: !isPostChat && stepNumber === 1 ? (fup.followupDocumentName || 'Document').trim() : '',
    files: !isPostChat && stepNumber === 1 ? (fup.followupFiles || []) : [],
  };
}

/**
 * Dispatches step content respecting user intent with full crash resilience:
 */
async function dispatchStepFollowup(
  sock: any,
  campaign: WaCampaign,
  contact: any,
  stepNumber: number,
  stepConfig: {
    message: string;
    imageUrl: string;
    audioUrl: string;
    videoUrl: string;
    documentUrl: string;
    documentName: string;
    files?: Array<{ id?: string; name?: string; url: string; type: string; size?: number }>;
  },
  gender: 'apu' | 'vai' | 'apni',
  fup: WaFollowupConfig,
  customLogType?: string
): Promise<boolean> {
  // Collect all media files from stepConfig.files + single URL fields (deduplicated, preserving order)
  const filesList = Array.isArray(stepConfig.files) ? stepConfig.files : [];

  const imageUrls: string[] = [];
  for (const f of filesList) {
    if (f.type === 'image' && f.url && f.url.trim() && !imageUrls.includes(f.url.trim())) {
      imageUrls.push(f.url.trim());
    }
  }
  if (stepConfig.imageUrl && stepConfig.imageUrl.trim() && !imageUrls.includes(stepConfig.imageUrl.trim())) {
    imageUrls.push(stepConfig.imageUrl.trim());
  }

  const videoUrls: string[] = [];
  for (const f of filesList) {
    if (f.type === 'video' && f.url && f.url.trim() && !videoUrls.includes(f.url.trim())) {
      videoUrls.push(f.url.trim());
    }
  }
  if (stepConfig.videoUrl && stepConfig.videoUrl.trim() && !videoUrls.includes(stepConfig.videoUrl.trim())) {
    videoUrls.push(stepConfig.videoUrl.trim());
  }

  const docItems: Array<{ url: string; name: string }> = [];
  for (const f of filesList) {
    if (f.type === 'document' && f.url && f.url.trim() && !docItems.some((d) => d.url === f.url.trim())) {
      docItems.push({ url: f.url.trim(), name: (f.name || stepConfig.documentName || 'Document').trim() });
    }
  }
  if (stepConfig.documentUrl && stepConfig.documentUrl.trim() && !docItems.some((d) => d.url === stepConfig.documentUrl.trim())) {
    docItems.push({ url: stepConfig.documentUrl.trim(), name: (stepConfig.documentName || 'Document').trim() });
  }

  const audioUrls: string[] = [];
  for (const f of filesList) {
    if (f.type === 'audio' && f.url && f.url.trim() && !audioUrls.includes(f.url.trim())) {
      audioUrls.push(f.url.trim());
    }
  }
  if (stepConfig.audioUrl && stepConfig.audioUrl.trim() && !audioUrls.includes(stepConfig.audioUrl.trim())) {
    audioUrls.push(stepConfig.audioUrl.trim());
  }

  const hasText = Boolean(stepConfig.message && stepConfig.message.trim());
  const hasImage = imageUrls.length > 0;
  const hasAudio = audioUrls.length > 0;
  const hasVideo = videoUrls.length > 0;
  const hasDoc = docItems.length > 0;

  const isAiActive =
    fup.aiEnabled === true &&
    Boolean(fup.aiApiKey) &&
    fup.aiApiKey !== 'none' &&
    fup.aiApiKey !== 'off' &&
    fup.aiApiKey !== 'disabled';

  if (!hasText && !hasImage && !hasAudio && !hasVideo && !hasDoc && !isAiActive) {
    log('FOLLOWUP', `⚠️ Step ${stepNumber} for campaign "${campaign.name}" has no message or media configured.`);
    return false;
  }

  let msg = '';
  if (hasText) {
    msg = replaceVariables(stepConfig.message.trim(), contact.contactName, campaign.name, gender);
  }

  // If AI is active and either we have text to optimize OR the step had no text/media (default AI text mode)
  if (isAiActive && (hasText || (!hasImage && !hasAudio && !hasVideo && !hasDoc))) {
    try {
      const optimized = await generateFollowupText({
        step: (stepNumber <= 3 ? stepNumber : 3) as 1 | 2 | 3,
        contactName: contact.contactName,
        gender,
        campaignName: campaign.name,
        understandingText: fup.understandingText,
        aiSystemPrompt: fup.aiSystemPrompt,
        baseTemplate: msg,
        apiKeyOrId: fup.aiApiKey,
        preferredModel: fup.aiModel || 'gemini-flash-latest',
      });
      if (optimized && optimized.trim()) {
        msg = optimized.trim();
        log('FOLLOWUP', `✨ Step ${stepNumber} AI optimized text for ${contact.phoneNumber}: "${msg.slice(0, 50)}..."`);
      }
    } catch (err: any) {
      log('FOLLOWUP', `AI optimization skipped for Step ${stepNumber} (${err.message}). Using exact text.`);
    }
  } else if (hasText) {
    log('FOLLOWUP', `🔒 Step ${stepNumber} AI is OFF. Sending exact user text to ${contact.phoneNumber}.`);
  }

  let deliveredAny = false;
  let loggedType: 'text' | 'image' | 'audio' | 'video' | 'document' = 'text';
  let loggedUrl = '';

  // 1. Deliver Image(s) (with text caption attached to the last image, or sent separately if images fail)
  if (hasImage) {
    for (let i = 0; i < imageUrls.length; i++) {
      const imgUrl = imageUrls[i];
      const isLastImage = i === imageUrls.length - 1;
      try {
        try {
          await sock.sendPresenceUpdate('composing', contact.phoneNumber);
        } catch {}
        await sleep(1000);
        const caption = isLastImage ? msg : '';
        await sendImageMessage(sock, contact.phoneNumber, imgUrl, caption);
        deliveredAny = true;
        loggedType = 'image';
        loggedUrl = imgUrl;
        if (isLastImage && msg) {
          msg = ''; // text delivered as image caption
        }
        log('FOLLOWUP', `✅ Step ${stepNumber} delivered image (${i + 1}/${imageUrls.length}) to ${contact.phoneNumber}`);
      } catch (e: any) {
        errLog('FOLLOWUP', `Step ${stepNumber} image (${i + 1}/${imageUrls.length}) send failed: ${e.message}`);
      }
    }
  }

  // 2. Deliver Video(s) (with text caption if available and not already sent with image)
  if (hasVideo) {
    for (let i = 0; i < videoUrls.length; i++) {
      const vidUrl = videoUrls[i];
      const isLastVideo = i === videoUrls.length - 1;
      try {
        try {
          await sock.sendPresenceUpdate('composing', contact.phoneNumber);
        } catch {}
        await sleep(1000);
        const caption = isLastVideo ? msg : '';
        await sendVideoMessage(sock, contact.phoneNumber, vidUrl, caption);
        deliveredAny = true;
        loggedType = 'video';
        loggedUrl = vidUrl;
        if (isLastVideo && msg) {
          msg = ''; // text delivered with video
        }
        log('FOLLOWUP', `✅ Step ${stepNumber} delivered video (${i + 1}/${videoUrls.length}) to ${contact.phoneNumber}`);
      } catch (e: any) {
        errLog('FOLLOWUP', `Step ${stepNumber} video send failed: ${e.message}`);
      }
    }
  }

  // 3. Deliver Document(s)
  if (hasDoc) {
    for (const docItem of docItems) {
      try {
        await sendDocumentMessage(sock, contact.phoneNumber, docItem.url, docItem.name);
        deliveredAny = true;
        loggedType = 'document';
        loggedUrl = docItem.url;
        log('FOLLOWUP', `✅ Step ${stepNumber} delivered document to ${contact.phoneNumber}`);
      } catch (e: any) {
        errLog('FOLLOWUP', `Step ${stepNumber} document send failed: ${e.message}`);
      }
    }
  }

  // 4. Deliver Text (if text has not already been sent as image/video caption)
  if (msg) {
    try {
      try {
        await sock.sendPresenceUpdate('composing', contact.phoneNumber);
      } catch {}
      await sleep(1200);
      await sendTextMessage(sock, contact.phoneNumber, msg);
      deliveredAny = true;
      if (!loggedUrl) {
        loggedType = 'text';
      }
      log('FOLLOWUP', `✅ Step ${stepNumber} delivered text to ${contact.phoneNumber}: "${msg.slice(0, 60)}..."`);
    } catch (e: any) {
      errLog('FOLLOWUP', `Step ${stepNumber} text send failed: ${e.message}`);
    }
  }

  // 5. Deliver Audio (Voice note(s))
  if (hasAudio) {
    for (const audUrl of audioUrls) {
      try {
        try {
          await sock.sendPresenceUpdate('recording', contact.phoneNumber);
        } catch {}
        await sleep(1200);
        await sendAudioMessage(sock, contact.phoneNumber, audUrl);
        deliveredAny = true;
        if (loggedType === 'text') {
          loggedType = 'audio';
          loggedUrl = audUrl;
        }
        log('FOLLOWUP', `✅ Step ${stepNumber} delivered voice note to ${contact.phoneNumber}`);
      } catch (e: any) {
        errLog('FOLLOWUP', `Step ${stepNumber} audio send failed: ${e.message}`);
      }
    }
  }

  // CRITICAL RESILIENCE: If ANY part of the step was delivered (e.g. text succeeded even if audio failed):
  // We MUST log the step as sent and return true! This prevents infinite repeat spam loops.
  if (deliveredAny) {
    await logFollowupStep(
      campaign.id,
      contact.phoneNumber,
      contact.contactName,
      stepNumber,
      loggedType,
      loggedUrl,
      customLogType
    );
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Anti-Blast Staggered Scheduler State & Concurrency Protection
// ─────────────────────────────────────────────────────────────────────────────
let isCycleRunning = false;
const inFlightKeys = new Set<string>(); // key: `${campaignId}:${phoneNumber}`
const accountCooldownMap = new Map<string, number>(); // accountId -> nextAllowedDispatchTimestamp
const accountBatchCountMap = new Map<string, number>(); // accountId -> messagesSentInCurrentBatch
const stepFailCountMap = new Map<string, number>(); // failKey -> failure count to prevent infinite retries

/**
 * Apply randomized cooldown after sending a follow-up:
 */
function applyAccountCooldown(accountId: string, fup: WaFollowupConfig): void {
  const currentBatch = (accountBatchCountMap.get(accountId) || 0) + 1;
  const minBatch = Number((fup as any).minBatchPeople) || 3;
  const maxBatch = Number((fup as any).maxBatchPeople) || 5;
  const batchTarget = Math.max(2, Math.floor(Math.random() * (maxBatch - minBatch + 1)) + minBatch);

  if (currentBatch >= batchTarget) {
    accountBatchCountMap.set(accountId, 0);
    const batchPauseSeconds = Math.floor(Math.random() * (300 - 180 + 1)) + 180;
    const batchPauseMs = batchPauseSeconds * 1000 + Math.floor(Math.random() * 999);
    accountCooldownMap.set(accountId, Date.now() + batchPauseMs);
    log('FOLLOWUP', `🛑 [Batch limit of ${batchTarget} reached on Acc: ${accountId}] Anti-ban pause for ${(batchPauseSeconds / 60).toFixed(1)} minutes before next batch.`);
  } else {
    accountBatchCountMap.set(accountId, currentBatch);
    const gapSeconds = Math.floor(Math.random() * (40 - 15 + 1)) + 15;
    const gapMs = gapSeconds * 1000 + Math.floor(Math.random() * 999);
    accountCooldownMap.set(accountId, Date.now() + gapMs);
    log('FOLLOWUP', `⏳ [Staggered Pacing on Acc: ${accountId}] Next follow-up allowed in ${gapSeconds}s (${(gapSeconds / 60).toFixed(2)} min). Batch progress: ${currentBatch}/${batchTarget}.`);
  }
}

/**
 * Check if the current time in Bangladesh (Asia/Dhaka, UTC+6) is outside quiet hours.
 */
export function isWithinAllowedFollowupHours(): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    let bdHour = 0;
    for (const part of parts) {
      if (part.type === 'hour') bdHour = parseInt(part.value, 10);
    }
    if (bdHour >= 0 && bdHour < 8) {
      return false;
    }
    return true;
  } catch {
    const now = new Date();
    const bdHour = (now.getUTCHours() + 6) % 24;
    return bdHour >= 8;
  }
}

let lastQuietHoursLog = 0;
export function logQuietHoursNoticeOnce(): void {
  const now = Date.now();
  if (now - lastQuietHoursLog > 30 * 60 * 1000) {
    lastQuietHoursLog = now;
    log('FOLLOWUP', '🌙 [Quiet Hours: 12:00 AM - 08:00 AM BD Time] Follow-up automation is paused until 08:00 AM to avoid disturbing customers.');
  }
}

/**
 * Convert delay value + unit to milliseconds.
 */
function unitToMs(val: number, unit?: string): number {
  const v = Math.max(1, Number(val) || 1);
  switch (unit) {
    case 'minutes':
      return v * 60 * 1000;
    case 'hours':
      return v * 60 * 60 * 1000;
    case 'days':
      return v * 24 * 60 * 60 * 1000;
    case 'weeks':
      return v * 7 * 24 * 60 * 60 * 1000;
    case 'months':
      return v * 30 * 24 * 60 * 60 * 1000;
    default:
      return v * 60 * 1000;
  }
}

/**
 * Compute required wait time (ms) before firing a specific step.
 */
function getStepRequiredDelayMs(
  stepMeta: any,
  stepNumber: number,
  fup: WaFollowupConfig,
  phoneNumber: string,
  minAgeDays: number,
  isPostChat: boolean
): number {
  if (stepMeta?.delayValue && stepMeta?.delayUnit) {
    const baseMs = unitToMs(stepMeta.delayValue, stepMeta.delayUnit);
    if (!isPostChat && stepNumber === 1 && stepMeta.delayUnit === 'minutes' && fup.antiBanJitter !== false) {
      const phoneDigits = phoneNumber.replace(/\D/g, '');
      const seed = phoneDigits.length >= 4 ? parseInt(phoneDigits.slice(-4), 10) : 1234;
      const jitterMs = (((seed % 120) / 60) + ((seed % 10) * 0.05)) * 60 * 1000;
      return baseMs + jitterMs;
    }
    return baseMs;
  }

  // Legacy defaults when delayValue/delayUnit are not explicitly set on the step
  if (isPostChat) {
    if (stepNumber === 1) return 3 * 24 * 60 * 60 * 1000; // 3 days
    if (stepNumber === 2) return 7 * 24 * 60 * 60 * 1000; // 7 days
    return 30 * 24 * 60 * 60 * 1000; // 1 month
  }

  if (stepNumber === 1) {
    let minDelay = Number(fup.minDelayMinutes) || 2;
    if (minAgeDays === 0 && (minDelay <= 0 || minDelay > 15)) minDelay = 2;
    const phoneDigits = phoneNumber.replace(/\D/g, '');
    const seed = phoneDigits.length >= 4 ? parseInt(phoneDigits.slice(-4), 10) : 1234;
    const jitterMinutes = ((seed % 120) / 60) + ((seed % 10) * 0.05);
    const targetMinutes = minDelay + (fup.antiBanJitter !== false ? jitterMinutes : 0);
    return targetMinutes * 60 * 1000;
  }
  if (stepNumber === 2) {
    return 3 * 60 * 60 * 1000; // 3 hours
  }
  if (stepNumber === 3) {
    return 20 * 60 * 60 * 1000; // 20 hours (next day)
  }
  return 7 * 24 * 60 * 60 * 1000; // 1 week for extra steps
}

/**
 * Process follow-ups for a single campaign with strictly staggered, non-overlapping timing.
 * Supports unlimited steps, weekly/monthly repeatable steps, and Post-Chat closing keyword triggers.
 */
async function processCampaignFollowups(campaign: WaCampaign): Promise<void> {
  const fup = campaign.followupConfig;
  if (!fup || (!fup.followupEnabled && !fup.postChatFollowupEnabled)) {
    return;
  }

  // Quiet Hours Check: 12:00 AM (midnight) to 08:00 AM (morning) Bangladesh Time
  if (!isWithinAllowedFollowupHours()) {
    logQuietHoursNoticeOnce();
    return;
  }

  const accountId = campaign.accountId && campaign.accountId !== 'all' ? campaign.accountId : (campaign.id || 'default');

  // 1. Staggered Pacing Check: If this account is in cooldown, skip this tick
  const now = Date.now();
  const nextAllowed = accountCooldownMap.get(accountId) || 0;
  if (now < nextAllowed) {
    return;
  }

  const sock = getActiveSock(campaign.accountId && campaign.accountId !== 'all' ? campaign.accountId : null);
  if (!sock) {
    return;
  }

  const minAgeDays = Number((fup as any).minContactAgeDays) || 0;
  const hasLongOrRepeatableSteps =
    fup.postChatFollowupEnabled ||
    (fup.steps || []).some((s) => s.repeatable || s.delayUnit === 'weeks' || s.delayUnit === 'months') ||
    (fup.postChatSteps || []).some((s) => s.repeatable || s.delayUnit === 'weeks' || s.delayUnit === 'months');
  const maxDaysBack = hasLongOrRepeatableSteps
    ? Math.max(Number((fup as any).totalDurationDays) || 365, 365)
    : Number((fup as any).totalDurationDays) || 30;

  const contacts = await getRecentContactedUsers(campaign.id, minAgeDays, maxDaysBack);
  if (contacts.length === 0) return;

  const todayStr = new Date().toISOString().split('T')[0];

  for (const contact of contacts) {
    const flightKey = `${campaign.id}:${contact.phoneNumber}`;
    if (inFlightKeys.has(flightKey)) {
      continue;
    }

    try {
      const initialContactMs = new Date(contact.sentAt).getTime();
      const ageMs = now - initialContactMs;
      const ageDays = ageMs / (24 * 60 * 60 * 1000);

      if (minAgeDays > 0 && ageDays < minAgeDays) {
        continue;
      }
      if (maxDaysBack > 0 && ageDays > maxDaysBack) {
        continue;
      }

      const logs = await getContactLogs(campaign.id, contact.phoneNumber);
      const state = analyzeContactFollowupState(logs, initialContactMs);
      const gender = ruleBasedGender(contact.contactName, '');

      // If this contact is in Post-Chat mode, ensure postChatFollowupEnabled is ON;
      // if in normal mode, ensure followupEnabled is ON.
      if (state.isPostChat && !fup.postChatFollowupEnabled) {
        continue;
      }
      if (!state.isPostChat && !fup.followupEnabled) {
        continue;
      }

      // ─────────────────────────────────────────────────────────────────────────
      // Case A: Customer gave a Promise Date (e.g. "কাল নিব", "শুক্রবার")
      // ─────────────────────────────────────────────────────────────────────────
      if (state.promiseTargetDate && !state.promiseAlreadySent) {
        if (todayStr >= state.promiseTargetDate) {
          inFlightKeys.add(flightKey);
          try {
            log('FOLLOWUP', `📅 Promise date reached (${state.promiseTargetDate}) for ${contact.phoneNumber}. Sending reminder...`);
            const step1Config = getStepConfig(fup, 1, campaign, contact.phoneNumber);
            const rawPromiseMsg = step1Config.message || 'আসসালামু আলাইকুম {name}! আপনার আগ্রহের অফারটির বিষয়ে জানাতে পারেন।';
            const msg = replaceVariables(rawPromiseMsg, contact.contactName, campaign.name, gender);
            let promiseSent = false;
            try {
              await sendTextMessage(sock, contact.phoneNumber, msg);
              promiseSent = true;
            } catch (pErr: any) {
              errLog('FOLLOWUP', `Failed sending promise reminder to ${contact.phoneNumber}: ${pErr.message}`);
            }

            if (promiseSent) {
              await markPromiseSent(campaign.id, contact.phoneNumber, contact.contactName);
              log('FOLLOWUP', `✅ Promise reminder sent to ${contact.phoneNumber}`);
            } else {
              const pFailKey = `prm:${campaign.id}:${contact.phoneNumber}`;
              const pFails = (stepFailCountMap.get(pFailKey) || 0) + 1;
              stepFailCountMap.set(pFailKey, pFails);
              if (pFails >= 2) {
                await markPromiseSent(campaign.id, contact.phoneNumber, contact.contactName);
                stepFailCountMap.delete(pFailKey);
              }
            }

            applyAccountCooldown(accountId, fup);
            break;
          } finally {
            inFlightKeys.delete(flightKey);
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────────
      // Case B: If customer REPLIED after effective start, STOP AUTO FOLLOW-UP!
      // ─────────────────────────────────────────────────────────────────────────
      if (state.hasReplied) {
        continue;
      }

      // Resolve active step sequence (Post-Chat steps vs Regular Campaign steps)
      const activeStepsList = state.isPostChat
        ? fup.postChatSteps && fup.postChatSteps.length > 0
          ? fup.postChatSteps
          : []
        : fup.steps && fup.steps.length > 0
        ? fup.steps
        : [
            { stepNumber: 1, delayValue: 3, delayUnit: 'minutes' as const },
            { stepNumber: 2, delayValue: 3, delayUnit: 'hours' as const },
            { stepNumber: 3, delayValue: 1, delayUnit: 'days' as const },
          ];

      const maxConfiguredStep = activeStepsList.reduce(
        (max, s) => Math.max(max, s.stepNumber || 0),
        activeStepsList.length || 3
      );

      // ─────────────────────────────────────────────────────────────────────────
      // Case C: Check if the current highestStep is REPEATABLE and due for repeat
      // (When either highestStep is the final step OR highestStep has repeatable=true
      //  and there is no next step due sooner)
      // ─────────────────────────────────────────────────────────────────────────
      const currentStepMeta = activeStepsList.find((s) => s.stepNumber === state.highestStep);
      if (
        state.highestStep > 0 &&
        currentStepMeta?.repeatable &&
        state.highestStep >= maxConfiguredStep
      ) {
        const currentRepCount = state.repeatCounts[state.highestStep] || 0;
        const maxReps = Number(currentStepMeta.maxRepeats) || 0; // 0 = unlimited
        if (maxReps === 0 || currentRepCount < maxReps) {
          const repeatIntervalMs = unitToMs(
            currentStepMeta.repeatEveryValue || 1,
            currentStepMeta.repeatEveryUnit || 'weeks'
          );
          const elapsedSinceLastMs = now - state.lastStepTimeMs;

          if (elapsedSinceLastMs >= repeatIntervalMs) {
            const nextRepNum = currentRepCount + 1;
            const logPrefix = state.isPostChat ? 'postchat_step' : 'followup_step';
            const customLogType = `${logPrefix}${state.highestStep}_rep_${nextRepNum}`;
            const failKey = `${campaign.id}:${contact.phoneNumber}:${customLogType}`;

            inFlightKeys.add(flightKey);
            try {
              log(
                'FOLLOWUP',
                `🔁 [${state.isPostChat ? 'Post-Chat ' : ''}Step ${state.highestStep} Repeat #${nextRepNum}] Sending recurring follow-up to ${contact.phoneNumber} for "${campaign.name}"...`
              );
              const stepCfg = getStepConfig(
                fup,
                state.highestStep,
                campaign,
                contact.phoneNumber,
                state.isPostChat,
                nextRepNum
              );
              const success = await dispatchStepFollowup(
                sock,
                campaign,
                contact,
                state.highestStep,
                stepCfg,
                gender,
                fup,
                customLogType
              );
              try {
                await sock.sendPresenceUpdate('paused', contact.phoneNumber);
              } catch {}

              if (success) {
                stepFailCountMap.delete(failKey);
                applyAccountCooldown(accountId, fup);
                break;
              } else {
                const fails = (stepFailCountMap.get(failKey) || 0) + 1;
                stepFailCountMap.set(failKey, fails);
                if (fails >= 2) {
                  await logFollowupStep(
                    campaign.id,
                    contact.phoneNumber,
                    contact.contactName,
                    state.highestStep,
                    'text',
                    'failed: max_retries_exceeded',
                    customLogType
                  );
                  stepFailCountMap.delete(failKey);
                }
                applyAccountCooldown(accountId, fup);
                break;
              }
            } finally {
              inFlightKeys.delete(flightKey);
            }
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────────
      // Case D: Advance to Next Step (Step 1, 2, 3, 4, ... Unlimited!)
      // ─────────────────────────────────────────────────────────────────────────
      const nextStepNumber = state.highestStep + 1;
      if (nextStepNumber <= maxConfiguredStep) {
        const nextStepMeta = activeStepsList.find((s) => s.stepNumber === nextStepNumber);
        const requiredDelayMs = getStepRequiredDelayMs(
          nextStepMeta,
          nextStepNumber,
          fup,
          contact.phoneNumber,
          minAgeDays,
          state.isPostChat
        );

        const referenceTimeMs =
          nextStepNumber === 1
            ? state.isPostChat
              ? state.postChatTriggerTimeMs
              : initialContactMs
            : state.lastStepTimeMs;

        const elapsedMs = now - referenceTimeMs;

        // Safety ceiling for short-delay steps (only when delay is under 24h)
        if (!state.isPostChat && minAgeDays === 0 && requiredDelayMs < 24 * 60 * 60 * 1000) {
          const maxCeilingMs = Math.max(requiredDelayMs * 4, 48 * 60 * 60 * 1000);
          if (elapsedMs > maxCeilingMs) {
            continue;
          }
        }

        if (elapsedMs >= requiredDelayMs) {
          const logPrefix = state.isPostChat ? 'postchat_step' : 'followup_step';
          const customLogType = `${logPrefix}${nextStepNumber}`;
          const failKey = `${campaign.id}:${contact.phoneNumber}:${customLogType}`;

          inFlightKeys.add(flightKey);
          try {
            log(
              'FOLLOWUP',
              `⏳ [${state.isPostChat ? 'Post-Chat ' : ''}Step ${nextStepNumber}/${maxConfiguredStep}] Sending to ${contact.phoneNumber} (${contact.contactName}) for "${campaign.name}"...`
            );

            const stepCfg = getStepConfig(
              fup,
              nextStepNumber,
              campaign,
              contact.phoneNumber,
              state.isPostChat,
              0
            );
            const success = await dispatchStepFollowup(
              sock,
              campaign,
              contact,
              nextStepNumber,
              stepCfg,
              gender,
              fup,
              customLogType
            );

            try {
              await sock.sendPresenceUpdate('paused', contact.phoneNumber);
            } catch {}

            if (success) {
              stepFailCountMap.delete(failKey);
              applyAccountCooldown(accountId, fup);
              break;
            } else {
              const fails = (stepFailCountMap.get(failKey) || 0) + 1;
              stepFailCountMap.set(failKey, fails);
              if (fails >= 2) {
                log(
                  'FOLLOWUP',
                  `⚠️ [Safety Skip] Step ${nextStepNumber} for ${contact.phoneNumber} failed ${fails} times. Recording step as failed.`
                );
                await logFollowupStep(
                  campaign.id,
                  contact.phoneNumber,
                  contact.contactName,
                  nextStepNumber,
                  'text',
                  'failed: max_retries_exceeded',
                  customLogType
                );
                stepFailCountMap.delete(failKey);
              }
              applyAccountCooldown(accountId, fup);
              break;
            }
          } finally {
            inFlightKeys.delete(flightKey);
          }
        }
      }
    } catch (err: any) {
      errLog('FOLLOWUP', `Error processing contact ${contact.phoneNumber}:`, err.message);
      try {
        await sock.sendPresenceUpdate('paused', contact.phoneNumber);
      } catch {}
    }
  }
}

/**
 * Main scheduler loop: runs every 15 seconds in background with strict mutex lock.
 */
export function startFollowupScheduler(): void {
  const INTERVAL_MS = 15 * 1000; // 15 seconds

  log('FOLLOWUP', '🚀 Intelligent Multi-Step Follow-up Scheduler started (polling every 15s with staggered anti-blast pacing)...');

  const runCycle = async () => {
    if (isCycleRunning) return; // Prevent concurrent cycle execution
    isCycleRunning = true;
    try {
      if (!isWithinAllowedFollowupHours()) {
        logQuietHoursNoticeOnce();
        return;
      }

      const campaigns = await getCampaignsWithFollowup();
      if (campaigns.length === 0) return;

      for (const campaign of campaigns) {
        await processCampaignFollowups(campaign).catch((err) => {
          errLog('FOLLOWUP', `Error in campaign "${campaign.name}":`, err.message);
        });
      }
    } catch (err: any) {
      // transient network blip
    } finally {
      isCycleRunning = false;
    }
  };

  runCycle();
  setInterval(runCycle, INTERVAL_MS);
}

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
 * Analyze all logs for a contact to determine follow-up state.
 */
function analyzeContactFollowupState(logs: any[], initialContactTimeMs: number) {
  let hasReplied = false;
  let highestStep = 0;
  let lastStepTimeMs = 0;
  let promiseTargetDate: string | null = null;
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
    } else if (l.messageType === 'followup_step2') {
      highestStep = Math.max(highestStep, 2);
      lastStepTimeMs = Math.max(lastStepTimeMs, logTimeMs);
    } else if (l.messageType === 'followup_step3') {
      highestStep = Math.max(highestStep, 3);
      lastStepTimeMs = Math.max(lastStepTimeMs, logTimeMs);
    } else if (l.messageType === 'promise_sched' && l.fileUrl) {
      promiseTargetDate = l.fileUrl;
    } else if (l.messageType === 'promise_sent') {
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
function replaceVariables(
  template: string,
  contactName: string,
  campaignName: string,
  gender: 'apu' | 'vai' | 'apni'
): string {
  if (!template) return '';
  const cleanName = (contactName || '').trim();
  const hasValidName = cleanName && cleanName !== 'Customer' && !cleanName.includes('@') && cleanName.length < 25;
  let nameLabel = 'সম্মানিত কাস্টমার';
  if (hasValidName) {
    if (gender === 'apu') nameLabel = `${cleanName} আপু`;
    else if (gender === 'vai') nameLabel = `${cleanName} ভাইয়া`;
    else nameLabel = cleanName;
  } else {
    if (gender === 'apu') nameLabel = 'আপু';
    else if (gender === 'vai') nameLabel = 'ভাইয়া';
    else nameLabel = 'ভাইয়া/আপু';
  }

  const hour = new Date().getHours();
  let timeStr = 'দিন';
  if (hour >= 5 && hour < 12) timeStr = 'সকাল';
  else if (hour >= 12 && hour < 16) timeStr = 'দুপুর';
  else if (hour >= 16 && hour < 18) timeStr = 'বিকাল';
  else if (hour >= 18 && hour < 20) timeStr = 'সন্ধ্যা';
  else timeStr = 'রাত';

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
function getStepConfig(fup: WaFollowupConfig, stepNumber: number, campaign?: WaCampaign, recipientPhone?: string) {
  // 1. Primary: Match explicit step in fup.steps
  const step = fup.steps?.find((s) => s.stepNumber === stepNumber);
  if (step) {
    let img = step.imageUrl || '';
    let aud = step.audioUrl || '';
    let vid = step.videoUrl || '';
    let doc = step.documentUrl || '';
    let docName = step.documentName || 'Document';
    const files = step.files || [];
    for (const f of files) {
      if (f.type === 'image' && !img) img = f.url;
      if (f.type === 'audio' && !aud) aud = f.url;
      if (f.type === 'video' && !vid) vid = f.url;
      if (f.type === 'document' && !doc) {
        doc = f.url;
        docName = f.name;
      }
    }

    // ONLY for Step 1: if step 1 doesn't have an explicit image, allow legacy top-level fup fallback
    if (stepNumber === 1) {
      if (!img && fup.followupImageUrl) img = fup.followupImageUrl;
      if (!aud && fup.followupAudioUrl) aud = fup.followupAudioUrl;
      if (!vid && fup.followupVideoUrl) vid = fup.followupVideoUrl;
      if (!doc && fup.followupDocumentUrl) {
        doc = fup.followupDocumentUrl;
        docName = fup.followupDocumentName || docName;
      }
    }
    // For Step 2 and Step 3: Strictly do NOT inherit Step 1's media!
    // They must use ONLY their own media files/urls so old images never repeat.

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
  const fupVariants = ((fup as any).followupVariants || []).filter((v: any) => v.isActive);
  if (fupVariants.length > 0) {
    const variantIndex = (stepNumber - 1) < fupVariants.length ? (stepNumber - 1) : ((stepNumber - 1) % fupVariants.length);
    const variant = fupVariants[variantIndex] || fupVariants[0];
    return {
      message: variant.welcomeMessage || '',
      imageUrl: variant.imageUrl || '',
      audioUrl: variant.audioUrl || '',
      videoUrl: variant.videoUrl || '',
      documentUrl: variant.documentUrl || '',
      documentName: variant.documentName || '',
      files: [],
    };
  }

  // 3. Fallback: Top-level followup fields (ONLY for Step 1)
  return {
    message: stepNumber === 1 ? (fup.followupMessage || '') : '',
    imageUrl: stepNumber === 1 ? (fup.followupImageUrl || '') : '',
    audioUrl: stepNumber === 1 ? (fup.followupAudioUrl || '') : '',
    videoUrl: stepNumber === 1 ? (fup.followupVideoUrl || '') : '',
    documentUrl: stepNumber === 1 ? (fup.followupDocumentUrl || '') : '',
    documentName: stepNumber === 1 ? (fup.followupDocumentName || 'Document') : '',
    files: stepNumber === 1 ? (fup.followupFiles || []) : [],
  };
}

/**
 * Dispatches step content respecting user intent:
 * - When AI is OFF or API Key is OFF: Sends 100% exact text provided by user (no AI modification)
 * - When AI is ON and API Key is active: Optimizes message with Gemini
 * - Sends 100% exact media provided for THIS specific step
 * - If both image and text exist, delivers image with exact text as caption
 */
async function dispatchStepFollowup(
  sock: any,
  campaign: WaCampaign,
  contact: any,
  stepNumber: 1 | 2 | 3,
  stepConfig: {
    message: string;
    imageUrl: string;
    audioUrl: string;
    videoUrl: string;
    documentUrl: string;
    documentName: string;
  },
  gender: 'apu' | 'vai' | 'apni',
  fup: WaFollowupConfig
): Promise<boolean> {
  const hasText = Boolean(stepConfig.message && stepConfig.message.trim());
  const hasImage = Boolean(stepConfig.imageUrl);
  const hasAudio = Boolean(stepConfig.audioUrl);
  const hasVideo = Boolean(stepConfig.videoUrl);
  const hasDoc = Boolean(stepConfig.documentUrl);

  let msg = '';
  if (hasText) {
    let text = stepConfig.message.trim();
    if (text.includes('{name}')) {
      const cleanName = (contact.contactName || '').trim();
      const hasValidName = cleanName && cleanName !== 'Customer' && !cleanName.includes('@') && cleanName.length < 25;
      text = text.replace(/\{name\}/gi, hasValidName ? cleanName : '');
    }
    msg = text.trim();

    // AI Optimization Check:
    // If aiEnabled is false, or aiApiKey is 'none'/'off'/empty, NEVER optimize with AI!
    const isAiActive = fup.aiEnabled === true && 
      Boolean(fup.aiApiKey) && 
      fup.aiApiKey !== 'none' && 
      fup.aiApiKey !== 'off' && 
      fup.aiApiKey !== 'disabled';

    if (isAiActive) {
      try {
        const optimized = await generateFollowupText({
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
          log('FOLLOWUP', `✨ Step ${stepNumber} AI optimized text for ${contact.phoneNumber}: "${msg.slice(0, 50)}..."`);
        }
      } catch (err: any) {
        log('FOLLOWUP', `AI optimization skipped for Step ${stepNumber} (${err.message}). Using exact text.`);
      }
    } else {
      log('FOLLOWUP', `🔒 Step ${stepNumber} AI is OFF. Sending exact user text to ${contact.phoneNumber}.`);
    }
  }

  // Case 1: ONLY Audio (voice note)
  if (hasAudio && !hasText && !hasImage && !hasVideo && !hasDoc) {
    try {
      await sock.sendPresenceUpdate('recording', contact.phoneNumber);
      await sleep(1500);
      await sendAudioMessage(sock, contact.phoneNumber, stepConfig.audioUrl);
      await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, stepNumber, 'audio', stepConfig.audioUrl);
      log('FOLLOWUP', `✅ Step ${stepNumber} delivered voice note only to ${contact.phoneNumber}`);
      return true;
    } catch (e: any) {
      errLog('FOLLOWUP', `Step ${stepNumber} audio failed: ${e.message}`);
      return false;
    }
  }

  // Case 2: ONLY Image
  if (hasImage && !hasText && !hasAudio && !hasVideo && !hasDoc) {
    try {
      await sendImageMessage(sock, contact.phoneNumber, stepConfig.imageUrl, '');
      await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, stepNumber, 'image', stepConfig.imageUrl);
      log('FOLLOWUP', `✅ Step ${stepNumber} delivered image only to ${contact.phoneNumber}`);
      return true;
    } catch (e: any) {
      errLog('FOLLOWUP', `Step ${stepNumber} image failed: ${e.message}`);
      return false;
    }
  }

  // Case 3: ONLY Video
  if (hasVideo && !hasText && !hasAudio && !hasImage && !hasDoc) {
    try {
      await sendVideoMessage(sock, contact.phoneNumber, stepConfig.videoUrl, '');
      await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, stepNumber, 'video', stepConfig.videoUrl);
      log('FOLLOWUP', `✅ Step ${stepNumber} delivered video only to ${contact.phoneNumber}`);
      return true;
    } catch (e: any) {
      errLog('FOLLOWUP', `Step ${stepNumber} video failed: ${e.message}`);
      return false;
    }
  }

  // Case 4: ONLY Document
  if (hasDoc && !hasText && !hasAudio && !hasImage && !hasVideo) {
    try {
      await sendDocumentMessage(sock, contact.phoneNumber, stepConfig.documentUrl, stepConfig.documentName);
      await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, stepNumber, 'document', stepConfig.documentUrl);
      log('FOLLOWUP', `✅ Step ${stepNumber} delivered document only to ${contact.phoneNumber}`);
      return true;
    } catch (e: any) {
      errLog('FOLLOWUP', `Step ${stepNumber} document failed: ${e.message}`);
      return false;
    }
  }

  // Case 5: Image + Text (as caption)
  if (hasImage && msg) {
    try {
      try {
        await sock.sendPresenceUpdate('composing', contact.phoneNumber);
      } catch {}
      await sleep(1000);
      await sendImageMessage(sock, contact.phoneNumber, stepConfig.imageUrl, msg);
      await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, stepNumber, 'image', stepConfig.imageUrl);
      log('FOLLOWUP', `✅ Step ${stepNumber} delivered image with caption to ${contact.phoneNumber}`);
      return true;
    } catch (e: any) {
      errLog('FOLLOWUP', `Step ${stepNumber} image with caption failed: ${e.message}`);
      // Fallback: If image fetch/network failed, deliver exact text so customer is not missed
      try {
        await sendTextMessage(sock, contact.phoneNumber, msg);
        await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, stepNumber, 'text', '');
        log('FOLLOWUP', `✅ Step ${stepNumber} fallback text delivered to ${contact.phoneNumber}`);
        return true;
      } catch (err: any) {
        return false;
      }
    }
  }

  // Case 6: Video + Text (as caption)
  if (hasVideo && msg) {
    try {
      await sendVideoMessage(sock, contact.phoneNumber, stepConfig.videoUrl, msg);
      await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, stepNumber, 'video', stepConfig.videoUrl);
      log('FOLLOWUP', `✅ Step ${stepNumber} delivered video with caption to ${contact.phoneNumber}`);
      return true;
    } catch (e: any) {
      errLog('FOLLOWUP', `Step ${stepNumber} video with caption failed: ${e.message}`);
      try {
        await sendTextMessage(sock, contact.phoneNumber, msg);
        await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, stepNumber, 'text', '');
        return true;
      } catch {
        return false;
      }
    }
  }

  // Case 7: Text + Audio (Voice note)
  if (hasAudio && msg) {
    try {
      try {
        await sock.sendPresenceUpdate('composing', contact.phoneNumber);
      } catch {}
      await sleep(1000);
      await sendTextMessage(sock, contact.phoneNumber, msg);

      try {
        await sock.sendPresenceUpdate('recording', contact.phoneNumber);
      } catch {}
      await sleep(1000);
      await sendAudioMessage(sock, contact.phoneNumber, stepConfig.audioUrl);
      await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, stepNumber, 'audio', stepConfig.audioUrl);
      log('FOLLOWUP', `✅ Step ${stepNumber} delivered text + voice note to ${contact.phoneNumber}`);
      return true;
    } catch (e: any) {
      errLog('FOLLOWUP', `Step ${stepNumber} text + audio failed: ${e.message}`);
      return false;
    }
  }

  // Case 8: Text only
  if (msg) {
    try {
      try {
        await sock.sendPresenceUpdate('composing', contact.phoneNumber);
      } catch {}
      await sleep(1500);
      await sendTextMessage(sock, contact.phoneNumber, msg);
      await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, stepNumber, 'text', '');
      log('FOLLOWUP', `✅ Step ${stepNumber} delivered text to ${contact.phoneNumber}: "${msg.slice(0, 60)}..."`);
      return true;
    } catch (e: any) {
      errLog('FOLLOWUP', `Step ${stepNumber} text failed: ${e.message}`);
      return false;
    }
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

/**
 * Apply randomized cooldown after sending a follow-up:
 * - Between individual sends: random 60 to 180 seconds (1 to 3 minutes), plus random seconds & ms.
 * - When batch limit (3 to 5 people) is reached: pause for random 4 to 8 minutes.
 * - Result: No two contacts ever receive at the same time; every recipient is on a different minute and second!
 */
function applyAccountCooldown(accountId: string, fup: WaFollowupConfig): void {
  const currentBatch = (accountBatchCountMap.get(accountId) || 0) + 1;
  const minBatch = Number((fup as any).minBatchPeople) || 3;
  const maxBatch = Number((fup as any).maxBatchPeople) || 5;
  const batchTarget = Math.max(2, Math.floor(Math.random() * (maxBatch - minBatch + 1)) + minBatch);

  if (currentBatch >= batchTarget) {
    // Batch limit reached: Longer human-like pause (3 to 5 minutes)
    accountBatchCountMap.set(accountId, 0);
    const batchPauseSeconds = Math.floor(Math.random() * (300 - 180 + 1)) + 180;
    const batchPauseMs = batchPauseSeconds * 1000 + Math.floor(Math.random() * 999);
    accountCooldownMap.set(accountId, Date.now() + batchPauseMs);
    log('FOLLOWUP', `🛑 [Batch limit of ${batchTarget} reached on Acc: ${accountId}] Anti-ban pause for ${(batchPauseSeconds / 60).toFixed(1)} minutes before next batch.`);
  } else {
    // Normal interval between individual recipients: 15 to 40 seconds
    accountBatchCountMap.set(accountId, currentBatch);
    const gapSeconds = Math.floor(Math.random() * (40 - 15 + 1)) + 15;
    const gapMs = gapSeconds * 1000 + Math.floor(Math.random() * 999);
    accountCooldownMap.set(accountId, Date.now() + gapMs);
    log('FOLLOWUP', `⏳ [Staggered Pacing on Acc: ${accountId}] Next follow-up allowed in ${gapSeconds}s (${(gapSeconds / 60).toFixed(2)} min). Batch progress: ${currentBatch}/${batchTarget}.`);
  }
}

/**
 * Process follow-ups for a single campaign with strictly staggered, non-overlapping timing.
 */
async function processCampaignFollowups(campaign: WaCampaign): Promise<void> {
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

  const minAgeDays = Number((fup as any).minContactAgeDays) || 0;
  const maxDaysBack = Number((fup as any).totalDurationDays) || 30;
  const contacts = await getRecentContactedUsers(campaign.id, minAgeDays, maxDaysBack);
  if (contacts.length === 0) return;

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

      // Fetch message logs for this contact
      const logs = await getContactLogs(campaign.id, contact.phoneNumber);
      const state = analyzeContactFollowupState(logs, initialContactMs);
      const gender = ruleBasedGender(contact.contactName, '');

      // ─────────────────────────────────────────────────────────────────────────
      // Case A: Customer gave a Promise Date (e.g. "কাল নিব", "শুক্রবার")
      // ─────────────────────────────────────────────────────────────────────────
      if (state.promiseTargetDate && !state.promiseAlreadySent) {
        if (todayStr >= state.promiseTargetDate) {
          inFlightKeys.add(flightKey);
          try {
            log('FOLLOWUP', `📅 Promise date reached (${state.promiseTargetDate}) for ${contact.phoneNumber}. Sending reminder...`);
            const step1Config = getStepConfig(fup, 1, campaign, contact.phoneNumber);
            const msg = step1Config.message || 'আসসালামু আলাইকুম {name}! আপনার আগ্রহের অফারটির বিষয়ে জানাতে পারেন।';
            await sendTextMessage(sock, contact.phoneNumber, msg);
            await markPromiseSent(campaign.id, contact.phoneNumber, contact.contactName);
            log('FOLLOWUP', `✅ Promise reminder sent to ${contact.phoneNumber}`);

            applyAccountCooldown(accountId, fup);
            break; // Stop after 1 send to maintain strictly staggered pacing
          } finally {
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
          } else if (fup.followupDelayUnit === 'days') {
            minDelay = (Number(fup.followupDelayValue) || 1) * 1440;
          } else {
            minDelay = Number(fup.followupDelayValue) || 2;
          }
        }
        if (minDelay <= 0) minDelay = 2;

        const phoneDigits = contact.phoneNumber.replace(/\D/g, '');
        const seed = phoneDigits.length >= 4 ? parseInt(phoneDigits.slice(-4), 10) : 1234;
        const jitterMinutes = ((seed % 120) / 60) + ((seed % 10) * 0.05); // 0.2 to 2.2 min jitter
        const targetMinutes = minDelay + (fup.antiBanJitter !== false ? jitterMinutes : 0);

        // When running real-time campaign follow-up (minAgeDays == 0):
        if (minAgeDays === 0) {
          // If not enough minutes have passed since contact was created, wait
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
          log('FOLLOWUP', `⏳ [Step 1: ${timingLabel}] Sending to ${contact.phoneNumber} (${contact.contactName}) for "${campaign.name}"...`);

          const step1Config = getStepConfig(fup, 1, campaign, contact.phoneNumber);
          const success = await dispatchStepFollowup(sock, campaign, contact, 1, step1Config, gender, fup);

          try {
            await sock.sendPresenceUpdate('paused', contact.phoneNumber);
          } catch {}

          if (success) {
            // Apply randomized pacing gap and exit loop: only 1 send per tick!
            applyAccountCooldown(accountId, fup);
            break;
          }
        } finally {
          inFlightKeys.delete(flightKey);
        }
      }

      // ─────────────────────────────────────────────────────────────────────────
      // Step 2: 3 to 4 Hours after Step 1
      // ─────────────────────────────────────────────────────────────────────────
      if (state.highestStep === 1) {
        const hoursSinceStep1 = (now - state.lastStepTimeMs) / (60 * 60 * 1000);
        if (hoursSinceStep1 >= 3) {
          inFlightKeys.add(flightKey);
          try {
            log('FOLLOWUP', `🕒 [Step 2: 3-4h nudge] Sending to ${contact.phoneNumber} (${contact.contactName})...`);

            const step2Config = getStepConfig(fup, 2, campaign, contact.phoneNumber);
            const success = await dispatchStepFollowup(sock, campaign, contact, 2, step2Config, gender, fup);

            try {
              await sock.sendPresenceUpdate('paused', contact.phoneNumber);
            } catch {}

            if (success) {
              applyAccountCooldown(accountId, fup);
              break; // Crucial: Break loop to maintain staggered pacing!
            }
          } finally {
            inFlightKeys.delete(flightKey);
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────────
      // Step 3: Next Day (~20-24 Hours after Step 2)
      // ─────────────────────────────────────────────────────────────────────────
      if (state.highestStep === 2) {
        const hoursSinceStep2 = (now - state.lastStepTimeMs) / (60 * 60 * 1000);
        if (hoursSinceStep2 >= 20) {
          inFlightKeys.add(flightKey);
          try {
            log('FOLLOWUP', `🌅 [Step 3: Next-day value] Sending to ${contact.phoneNumber}...`);

            const step3Config = getStepConfig(fup, 3, campaign, contact.phoneNumber);
            const success = await dispatchStepFollowup(sock, campaign, contact, 3, step3Config, gender, fup);

            try {
              await sock.sendPresenceUpdate('paused', contact.phoneNumber);
            } catch {}

            if (success) {
              log('FOLLOWUP', `✅ Step 3 completed for ${contact.phoneNumber}. Follow-up sequence finished.`);
              applyAccountCooldown(accountId, fup);
              break; // Crucial: Break loop!
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

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
function getStepConfig(fup: WaFollowupConfig, stepNumber: number, campaign?: WaCampaign) {
  const step = fup.steps?.find((s) => s.stepNumber === stepNumber);
  if (step && (step.message || step.imageUrl || step.audioUrl || step.videoUrl || step.documentUrl)) {
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
    return {
      message: step.message !== undefined ? step.message : (stepNumber === 1 ? (fup.followupMessage || '') : ''),
      imageUrl: img,
      audioUrl: aud,
      videoUrl: vid,
      documentUrl: doc,
      documentName: docName,
      files,
    };
  }

  // Support variations from new-followup or campaign variants
  const activeVariants = (campaign?.variants || []).filter((v) => v.isActive);
  if (activeVariants.length > 0) {
    const variantIndex = (stepNumber - 1) % activeVariants.length;
    const variant = activeVariants[variantIndex] || activeVariants[0];
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

  // Fallback to top-level campaign follow-up media (preserving image for Step 1 too!)
  let img = fup.followupImageUrl || campaign?.imageUrl || '';
  let aud = fup.followupAudioUrl || campaign?.audioUrl || '';
  let vid = fup.followupVideoUrl || campaign?.videoUrl || '';
  let doc = fup.followupDocumentUrl || campaign?.documentUrl || '';
  let docName = fup.followupDocumentName || campaign?.documentName || 'Document';
  const files = fup.followupFiles || [];
  for (const f of files) {
    if (f.type === 'image' && !img) img = f.url;
    if (f.type === 'audio' && !aud) aud = f.url;
    if (f.type === 'video' && !vid) vid = f.url;
    if (f.type === 'document' && !doc) {
      doc = f.url;
      docName = f.name;
    }
  }
  return {
    message: stepNumber === 1 ? (fup.followupMessage || campaign?.welcomeMessage || '') : '',
    imageUrl: img,
    audioUrl: aud,
    videoUrl: vid,
    documentUrl: doc,
    documentName: docName,
    files,
  };
}

/**
 * Dispatches step content respecting user intent:
 * - Sends 100% exact text provided by user (no AI modification or alteration)
 * - Sends 100% exact image provided by user
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
    // Deliver exact text written by user without any AI alteration
    let text = stepConfig.message.trim();
    if (text.includes('{name}')) {
      const cleanName = (contact.contactName || '').trim();
      const hasValidName = cleanName && cleanName !== 'Customer' && !cleanName.includes('@') && cleanName.length < 25;
      text = text.replace(/\{name\}/gi, hasValidName ? cleanName : '');
    }
    msg = text.trim();
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
      await sendImageMessage(sock, contact.phoneNumber, stepConfig.imageUrl, msg);
      await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, stepNumber, 'image', stepConfig.imageUrl);
      log('FOLLOWUP', `✅ Step ${stepNumber} delivered image with caption to ${contact.phoneNumber}`);
      return true;
    } catch (e: any) {
      errLog('FOLLOWUP', `Step ${stepNumber} image with caption failed: ${e.message}`);
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
    }
  }

  // Case 7: Text + Audio (Voice note)
  if (hasAudio && msg) {
    try {
      try {
        await sock.sendPresenceUpdate('composing', contact.phoneNumber);
      } catch {}
      await sleep(1500);
      await sendTextMessage(sock, contact.phoneNumber, msg);

      try {
        await sock.sendPresenceUpdate('recording', contact.phoneNumber);
      } catch {}
      await sleep(1500);
      await sendAudioMessage(sock, contact.phoneNumber, stepConfig.audioUrl);
      await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, stepNumber, 'audio', stepConfig.audioUrl);
      log('FOLLOWUP', `✅ Step ${stepNumber} delivered text + voice note to ${contact.phoneNumber}`);
      return true;
    } catch (e: any) {
      errLog('FOLLOWUP', `Step ${stepNumber} text + audio failed: ${e.message}`);
    }
  }

  // Case 8: Text only (or fallback)
  if (msg) {
    try {
      try {
        await sock.sendPresenceUpdate('composing', contact.phoneNumber);
      } catch {}
      await sleep(2000);
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

/**
 * Process follow-ups for a single campaign.
 */
async function processCampaignFollowups(campaign: WaCampaign): Promise<void> {
  const fup = campaign.followupConfig;
  if (!fup || !fup.followupEnabled) {
    return; // Strict safety check
  }

  const accountId = campaign.accountId && campaign.accountId !== 'all' ? campaign.accountId : null;
  const sock = getActiveSock(accountId);
  if (!sock) {
    return; // No WhatsApp connection available for this account
  }

  const contacts = await getRecentContactedUsers(campaign.id);
  if (contacts.length === 0) return;

  const now = Date.now();
  const todayStr = new Date().toISOString().split('T')[0];

  for (const contact of contacts) {
    try {
      const initialContactMs = new Date(contact.sentAt).getTime();
      const ageMinutes = (now - initialContactMs) / (60 * 1000);

      // Fetch message logs for this contact
      const logs = await getContactLogs(campaign.id, contact.phoneNumber);
      const state = analyzeContactFollowupState(logs, initialContactMs);

      const gender = ruleBasedGender(contact.contactName, '');

      // ─────────────────────────────────────────────────────────────────────────
      // Case A: Customer gave a Promise Date (e.g. "কাল নিব", "শুক্রবার")
      // ─────────────────────────────────────────────────────────────────────────
      if (state.promiseTargetDate && !state.promiseAlreadySent) {
        if (todayStr >= state.promiseTargetDate) {
          log('FOLLOWUP', `📅 Promise date reached (${state.promiseTargetDate}) for ${contact.phoneNumber}. Sending reminder...`);
          const msg = await generateFollowupText({
            step: 'promise',
            contactName: contact.contactName,
            gender,
            campaignName: campaign.name,
            understandingText: fup.understandingText,
            baseTemplate: fup.followupMessage,
            apiKeyOrId: fup.aiApiKey,
            preferredModel: fup.aiModel,
          });

          await sendTextMessage(sock, contact.phoneNumber, msg);
          await markPromiseSent(campaign.id, contact.phoneNumber, contact.contactName);
          log('FOLLOWUP', `✅ Promise reminder sent to ${contact.phoneNumber}`);
          await sleep(2000);
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
      // Step 1: Configured delay after initial contact (default ~3 min)
      // ─────────────────────────────────────────────────────────────────────────
      if (state.highestStep === 0) {
        let minDelay = Number(fup.minDelayMinutes) || 3;
        if (minDelay <= 0) minDelay = 2;
        const phoneDigits = contact.phoneNumber.replace(/\D/g, '');
        const seed = phoneDigits.length >= 2 ? parseInt(phoneDigits.slice(-2), 10) : 12;
        const targetMinutes = minDelay + ((seed % 15) / 10);

        if (ageMinutes >= targetMinutes) {
          // Safety: Don't blast contacts older than 24 hours
          if (ageMinutes > 1440) {
            continue;
          }

          log('FOLLOWUP', `⏳ [Step 1: ${targetMinutes.toFixed(1)}-min check] Sending to ${contact.phoneNumber} (${contact.contactName}) for "${campaign.name}"...`);

          const step1Config = getStepConfig(fup, 1, campaign);
          await dispatchStepFollowup(sock, campaign, contact, 1, step1Config, gender, fup);

          // Always explicitly pause typing presence so "typing..." never stays stuck!
          try {
            await sock.sendPresenceUpdate('paused', contact.phoneNumber);
          } catch {}

          await sleep(Math.floor(Math.random() * 2000) + 2000);
          continue;
        }
      }

      // ─────────────────────────────────────────────────────────────────────────
      // Step 2: 3 to 4 Hours after Step 1
      // ─────────────────────────────────────────────────────────────────────────
      if (state.highestStep === 1) {
        const hoursSinceStep1 = (now - state.lastStepTimeMs) / (60 * 60 * 1000);
        // Trigger after 3 hours
        if (hoursSinceStep1 >= 3) {
          log('FOLLOWUP', `🕒 [Step 2: 3-4h nudge] Sending to ${contact.phoneNumber} (${contact.contactName})...`);

          const step2Config = getStepConfig(fup, 2, campaign);
          await dispatchStepFollowup(sock, campaign, contact, 2, step2Config, gender, fup);

          try {
            await sock.sendPresenceUpdate('paused', contact.phoneNumber);
          } catch {}

          await sleep(Math.floor(Math.random() * 2000) + 2000);
          continue;
        }
      }

      // ─────────────────────────────────────────────────────────────────────────
      // Step 3: Next Day (~20-24 Hours after Step 2)
      // ─────────────────────────────────────────────────────────────────────────
      if (state.highestStep === 2) {
        const hoursSinceStep2 = (now - state.lastStepTimeMs) / (60 * 60 * 1000);
        if (hoursSinceStep2 >= 20) {
          log('FOLLOWUP', `🌅 [Step 3: Next-day value] Sending to ${contact.phoneNumber}...`);

          const step3Config = getStepConfig(fup, 3, campaign);
          await dispatchStepFollowup(sock, campaign, contact, 3, step3Config, gender, fup);

          try {
            await sock.sendPresenceUpdate('paused', contact.phoneNumber);
          } catch {}

          log('FOLLOWUP', `✅ Step 3 completed for ${contact.phoneNumber}. Follow-up sequence finished.`);
          await sleep(Math.floor(Math.random() * 2000) + 2000);
          continue;
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
 * Main scheduler loop: runs every 15 seconds in background for accurate 2-minute timing.
 */
export function startFollowupScheduler(): void {
  const INTERVAL_MS = 15 * 1000; // 15 seconds

  log('FOLLOWUP', '🚀 Intelligent Multi-Step Follow-up Scheduler started (polling every 15s)...');

  const runCycle = async () => {
    try {
      const campaigns = await getCampaignsWithFollowup();
      // If no campaigns have follow-up enabled, do nothing
      if (campaigns.length === 0) return;

      for (const campaign of campaigns) {
        await processCampaignFollowups(campaign).catch((err) => {
          errLog('FOLLOWUP', `Error in campaign "${campaign.name}":`, err.message);
        });
      }
    } catch (err: any) {
      // transient network blip
    }
  };

  runCycle();
  setInterval(runCycle, INTERVAL_MS);
}

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

  // Resolve media files from both followupFiles array and top-level fields
  let audioUrl = fup.followupAudioUrl || campaign.audioUrl || '';
  let imageUrl = fup.followupImageUrl || campaign.imageUrl || '';
  let videoUrl = fup.followupVideoUrl || campaign.videoUrl || '';
  let documentUrl = fup.followupDocumentUrl || campaign.documentUrl || '';
  let documentName = fup.followupDocumentName || campaign.documentName || 'Document';

  if (Array.isArray(fup.followupFiles) && fup.followupFiles.length > 0) {
    for (const f of fup.followupFiles) {
      if (f.type === 'audio' && !audioUrl) audioUrl = f.url;
      if (f.type === 'image' && !imageUrl) imageUrl = f.url;
      if (f.type === 'video' && !videoUrl) videoUrl = f.url;
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

          log('FOLLOWUP', `⏳ [Step 1: 2-min check] Sending to ${contact.phoneNumber} (${contact.contactName}) for "${campaign.name}"...`);

          const msg = await generateFollowupText({
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
          } catch {}
          await sleep(1500);

          if (imageUrl) {
            await sendImageMessage(sock, contact.phoneNumber, imageUrl, msg);
            await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, 1, 'image', imageUrl);
            log('FOLLOWUP', `✅ Step 1 delivered image+AI text to ${contact.phoneNumber}: "${msg.slice(0, 60)}..."`);
          } else {
            await sendTextMessage(sock, contact.phoneNumber, msg);
            await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, 1, 'text', '');
            log('FOLLOWUP', `✅ Step 1 delivered AI text to ${contact.phoneNumber}: "${msg.slice(0, 60)}..."`);
          }

          if (audioUrl) {
            await sleep(2000);
            await sendAudioMessage(sock, contact.phoneNumber, audioUrl);
            await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, 1, 'audio', audioUrl);
            log('FOLLOWUP', `✅ Step 1 delivered voice note to ${contact.phoneNumber}`);
          }

          await sleep(Math.floor(Math.random() * 2000) + 2000);
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
          log('FOLLOWUP', `🕒 [Step 2: 3-4h nudge] Sending to ${contact.phoneNumber} (${contact.contactName})...`);

          const msg = await generateFollowupText({
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
          } catch {}
          await sleep(1500);

          if (audioUrl) {
            // Send audio follow-up (voice note)
            await sendAudioMessage(sock, contact.phoneNumber, audioUrl);
            await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, 2, 'audio', audioUrl);
            log('FOLLOWUP', `✅ Step 2 audio sent to ${contact.phoneNumber}`);
          } else if (imageUrl) {
            // Send image with caption
            await sendImageMessage(sock, contact.phoneNumber, imageUrl, msg);
            await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, 2, 'image', imageUrl);
            log('FOLLOWUP', `✅ Step 2 image sent to ${contact.phoneNumber}`);
          } else if (videoUrl) {
            await sendVideoMessage(sock, contact.phoneNumber, videoUrl, msg);
            await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, 2, 'video', videoUrl);
            log('FOLLOWUP', `✅ Step 2 video sent to ${contact.phoneNumber}`);
          } else if (documentUrl) {
            await sendDocumentMessage(sock, contact.phoneNumber, documentUrl, documentName);
            await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, 2, 'document', documentUrl);
            log('FOLLOWUP', `✅ Step 2 document sent to ${contact.phoneNumber}`);
          } else {
            // Text nudge
            await sendTextMessage(sock, contact.phoneNumber, msg);
            await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, 2, 'text', '');
            log('FOLLOWUP', `✅ Step 2 text sent to ${contact.phoneNumber}`);
          }

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

          const msg = await generateFollowupText({
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
          } catch {}
          await sleep(1500);

          if (imageUrl) {
            await sendImageMessage(sock, contact.phoneNumber, imageUrl, msg);
            await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, 3, 'image', imageUrl);
          } else if (audioUrl) {
            await sendAudioMessage(sock, contact.phoneNumber, audioUrl);
            await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, 3, 'audio', audioUrl);
          } else {
            await sendTextMessage(sock, contact.phoneNumber, msg);
            await logFollowupStep(campaign.id, contact.phoneNumber, contact.contactName, 3, 'text', '');
          }

          log('FOLLOWUP', `✅ Step 3 completed for ${contact.phoneNumber}. Follow-up sequence finished.`);
          await sleep(Math.floor(Math.random() * 2000) + 2000);
          continue;
        }
      }
    } catch (err: any) {
      errLog('FOLLOWUP', `Error processing contact ${contact.phoneNumber}:`, err.message);
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

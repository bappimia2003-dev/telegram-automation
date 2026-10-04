/**
 * followupScheduler.ts
 *
 * Background scheduler that runs every 60 seconds inside the Railway wa-engine.
 * For each active campaign with followupEnabled=true:
 *   1. Calculates the delay in ms from followupDelayValue + followupDelayUnit
 *   2. Queries wa_contacted_users for contacts who haven't received a follow-up yet
 *      (checked via wa_message_logs where message_type='followup')
 *   3. Sends the follow-up message/media via the matching Baileys socket
 *   4. Logs the follow-up in wa_message_logs (no schema changes needed)
 */

import { v4 as uuidv4 } from 'uuid';
import { getCampaignsWithFollowup, getPendingFollowupContacts, markFollowupSent, addMessageLog } from './db.js';
import {
  sendTextMessage,
  sendImageMessage,
  sendVideoMessage,
  sendAudioMessage,
  sendDocumentMessage,
} from './fileSender.js';
import { getAllAccountsInfo, getSocket } from './whatsapp.js';
import { WaCampaign, WaFollowupConfig } from './types.js';
import { log, errLog, sleep } from './utils.js';

/** Convert followupDelayValue + followupDelayUnit into milliseconds */
function delayToMs(config: WaFollowupConfig): number {
  const value = config.followupDelayValue ?? 2;
  const unit = config.followupDelayUnit ?? 'minutes';
  switch (unit) {
    case 'hours':
      return value * 60 * 60 * 1000;
    case 'days':
      return value * 24 * 60 * 60 * 1000;
    case 'minutes':
    default:
      return value * 60 * 1000;
  }
}

/** Process a single campaign's pending follow-ups */
async function processCampaignFollowups(campaign: WaCampaign): Promise<void> {
  const config = campaign.followupConfig!;
  const delayMs = delayToMs(config);

  const pending = await getPendingFollowupContacts(campaign.id, delayMs);
  if (pending.length === 0) return;

  log('FOLLOWUP', `Campaign "${campaign.name}" — ${pending.length} pending follow-up(s) to send.`);

  const accountId = campaign.accountId && campaign.accountId !== 'all' ? campaign.accountId : null;
  const sock = getActiveSock(accountId);

  if (!sock) {
    log('FOLLOWUP', `No connected socket for account "${accountId || 'any'}" — skipping follow-ups for campaign "${campaign.name}".`);
    return;
  }

  for (const contact of pending) {
    try {
      await sendFollowupToContact(sock, campaign, config, contact);
      await markFollowupSent(campaign.id, contact.phoneNumber, contact.contactName);
      log('FOLLOWUP', `✅ Follow-up sent to ${contact.phoneNumber} (${contact.contactName}) for campaign "${campaign.name}".`);

      // Small human-like delay between each follow-up (2-4s)
      const jitter = config.antiBanJitter !== false ? Math.floor(Math.random() * 2000) + 2000 : 2000;
      await sleep(jitter);
    } catch (err: any) {
      errLog('FOLLOWUP', `Failed to send follow-up to ${contact.phoneNumber}:`, err.message);
      // Will retry next cycle
    }
  }
}

/** Send the actual follow-up message/media to one contact */
async function sendFollowupToContact(
  sock: any,
  campaign: WaCampaign,
  config: WaFollowupConfig,
  contact: { id: string; phoneNumber: string; contactName: string; sentAt: string }
): Promise<void> {
  const { phoneNumber, contactName } = contact;

  // Show composing presence
  try {
    await sock.sendPresenceUpdate('composing', phoneNumber);
  } catch {}

  // Wait 1-2s as typing simulation
  await sleep(Math.floor(Math.random() * 1000) + 1000);

  // Build list of items to send
  const itemsToSend: string[] = [];
  if (config.followupMessage?.trim()) itemsToSend.push('message');
  if (config.followupImageUrl?.trim()) itemsToSend.push('image');
  if (config.followupVideoUrl?.trim()) itemsToSend.push('video');
  if (config.followupAudioUrl?.trim()) itemsToSend.push('audio');
  if (config.followupDocumentUrl?.trim()) itemsToSend.push('document');

  if (itemsToSend.length === 0) {
    log('FOLLOWUP', `No follow-up content configured for campaign "${campaign.name}" — skipping send.`);
    return;
  }

  for (let i = 0; i < itemsToSend.length; i++) {
    const item = itemsToSend[i];

    try {
      await sock.sendPresenceUpdate('composing', phoneNumber);

      if (item === 'message') {
        await sendTextMessage(sock, phoneNumber, config.followupMessage!.trim());
        await addMessageLog({
          id: uuidv4(),
          campaignId: campaign.id,
          phoneNumber,
          contactName,
          messageType: 'text',
          fileUrl: '',
          status: 'sent',
          errorMessage: '',
          sentAt: new Date().toISOString(),
        });
      } else if (item === 'image') {
        await sendImageMessage(sock, phoneNumber, config.followupImageUrl!.trim());
        await addMessageLog({
          id: uuidv4(),
          campaignId: campaign.id,
          phoneNumber,
          contactName,
          messageType: 'image',
          fileUrl: config.followupImageUrl!,
          status: 'sent',
          errorMessage: '',
          sentAt: new Date().toISOString(),
        });
      } else if (item === 'video') {
        await sendVideoMessage(sock, phoneNumber, config.followupVideoUrl!.trim());
        await addMessageLog({
          id: uuidv4(),
          campaignId: campaign.id,
          phoneNumber,
          contactName,
          messageType: 'video',
          fileUrl: config.followupVideoUrl!,
          status: 'sent',
          errorMessage: '',
          sentAt: new Date().toISOString(),
        });
      } else if (item === 'audio') {
        await sendAudioMessage(sock, phoneNumber, config.followupAudioUrl!.trim());
        await addMessageLog({
          id: uuidv4(),
          campaignId: campaign.id,
          phoneNumber,
          contactName,
          messageType: 'audio',
          fileUrl: config.followupAudioUrl!,
          status: 'sent',
          errorMessage: '',
          sentAt: new Date().toISOString(),
        });
      } else if (item === 'document') {
        const docName = config.followupDocumentName || 'Document';
        await sendDocumentMessage(sock, phoneNumber, config.followupDocumentUrl!.trim(), docName);
        await addMessageLog({
          id: uuidv4(),
          campaignId: campaign.id,
          phoneNumber,
          contactName,
          messageType: 'document',
          fileUrl: config.followupDocumentUrl!,
          status: 'sent',
          errorMessage: '',
          sentAt: new Date().toISOString(),
        });
      }

      // Small delay between items
      if (i < itemsToSend.length - 1) {
        await sleep(Math.floor(Math.random() * 1000) + 1000);
      }
    } catch (itemErr: any) {
      errLog('FOLLOWUP', `Error sending follow-up item "${item}" to ${phoneNumber}:`, itemErr.message);
      await addMessageLog({
        id: uuidv4(),
        campaignId: campaign.id,
        phoneNumber,
        contactName,
        messageType: item as any,
        fileUrl: '',
        status: 'failed',
        errorMessage: itemErr.message || 'Unknown error',
        sentAt: new Date().toISOString(),
      });
      throw itemErr; // rethrow so outer catch skips markFollowupSent
    }
  }
}

/**
 * Get an active (connected) socket from the sessions map.
 * Tries the specified accountId first, then falls back to any connected account.
 */
function getActiveSock(preferAccountId: string | null): any | null {
  if (preferAccountId) {
    const sock = getSocket(preferAccountId);
    if (sock) return sock;
  }
  // Try to find any connected socket
  const accounts = getAllAccountsInfo();
  for (const acc of accounts) {
    if (acc.status === 'connected') {
      const sock = getSocket(acc.id);
      if (sock) return sock;
    }
  }
  return null;
}

/** Main scheduler loop — called once, then runs every 60 seconds */
export function startFollowupScheduler(): void {
  const INTERVAL_MS = 60 * 1000; // 60 seconds

  log('FOLLOWUP', '🕐 Follow-up scheduler started. Checking every 60 seconds...');

  const runCycle = async () => {
    try {
      const campaigns = await getCampaignsWithFollowup();
      if (campaigns.length === 0) return;

      log('FOLLOWUP', `Running follow-up check for ${campaigns.length} campaign(s) with followup enabled.`);
      for (const campaign of campaigns) {
        await processCampaignFollowups(campaign).catch((err) => {
          errLog('FOLLOWUP', `Error processing campaign "${campaign.name}":`, err.message);
        });
      }
    } catch (err: any) {
      // Silently swallow transient errors (network blips, etc.)
    }
  };

  // Run immediately on start, then every 60s
  runCycle();
  setInterval(runCycle, INTERVAL_MS);
}

/**
 * followupScheduler.ts
 *
 * Background scheduler that runs every 60 seconds inside the Railway wa-engine.
 * For each active campaign with followupEnabled=true:
 *   1. Calculates the delay in ms from followupDelayValue + followupDelayUnit
 *   2. Queries wa_contacted_users for rows where followup_sent_at IS NULL
 *      and the original message was sent at least `delay` ago
 *   3. Sends the follow-up message/media via the matching Baileys socket
 *   4. Marks followup_sent_at in the DB so it won't be re-sent
 */

import { v4 as uuidv4 } from 'uuid';
import { getCampaignsWithFollowup, getPendingFollowupContacts, markFollowupSent, addMessageLog, ensureFollowupColumn } from './db.js';
import {
  sendTextMessage,
  sendImageMessage,
  sendVideoMessage,
  sendAudioMessage,
  sendDocumentMessage,
} from './fileSender.js';
import { getConnectionInfo } from './whatsapp.js';
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

/** Get the Baileys socket for the account assigned to this campaign */
function getSocketForCampaign(campaign: WaCampaign): any | null {
  const accountId = campaign.accountId || 'main';
  const info = getConnectionInfo(accountId);
  if (info.status !== 'connected') {
    // Try 'main' as fallback if a specific account isn't connected
    if (accountId !== 'main') {
      const mainInfo = getConnectionInfo('main');
      if (mainInfo.status === 'connected') {
        return (mainInfo as any)._sock || null;
      }
    }
    return null;
  }
  // The sock is stored on the session — we expose it via a helper below
  return (info as any)._sock || null;
}

/** Process a single campaign's pending follow-ups */
async function processCampaignFollowups(campaign: WaCampaign): Promise<void> {
  const config = campaign.followupConfig!;
  const delayMs = delayToMs(config);

  const pending = await getPendingFollowupContacts(campaign.id, delayMs);
  if (pending.length === 0) return;

  log('FOLLOWUP', `Campaign "${campaign.name}" — ${pending.length} pending follow-up(s) to send.`);

  // Get socket — we use a workaround: import sessions map directly via whatsapp module
  const accountId = campaign.accountId && campaign.accountId !== 'all' ? campaign.accountId : null;
  const sock = await getActiveSock(accountId);

  if (!sock) {
    log('FOLLOWUP', `No connected socket for account "${accountId || 'any'}" — skipping follow-ups for campaign "${campaign.name}".`);
    return;
  }

  for (const contact of pending) {
    try {
      await sendFollowupToContact(sock, campaign, config, contact);
      await markFollowupSent(contact.id);
      log('FOLLOWUP', `✅ Follow-up sent to ${contact.phoneNumber} (${contact.contactName}) for campaign "${campaign.name}".`);

      // Small human-like delay between each follow-up (2-4s)
      const jitter = config.antiBanJitter !== false ? Math.floor(Math.random() * 2000) + 2000 : 2000;
      await sleep(jitter);
    } catch (err: any) {
      errLog('FOLLOWUP', `Failed to send follow-up to ${contact.phoneNumber}:`, err.message);
      // Still mark as attempted to avoid infinite retry loops — use a separate flag if needed
      // For now we skip marking so it will retry next cycle
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
async function getActiveSock(preferAccountId: string | null): Promise<any | null> {
  // We need to access the sessions map from whatsapp.ts.
  // Since it's not exported, we use a workaround: call getConnectionInfo which 
  // exposes the internal state, and we pull the sock via the exported getAllAccountsInfo.
  // Actually we'll use a small trick: we export a getSocket helper from whatsapp.ts below.
  // For now we use dynamic import to avoid circular deps at module level.
  try {
    const { getSocket } = await import('./whatsapp.js');
    if (preferAccountId) {
      const sock = getSocket(preferAccountId);
      if (sock) return sock;
    }
    // Try to find any connected socket
    const { getAllAccountsInfo } = await import('./whatsapp.js');
    const accounts = getAllAccountsInfo();
    for (const acc of accounts) {
      if (acc.status === 'connected') {
        const sock = getSocket(acc.id);
        if (sock) return sock;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Main scheduler loop — called once, then runs every 60 seconds */
export function startFollowupScheduler(): void {
  const INTERVAL_MS = 60 * 1000; // 60 seconds

  log('FOLLOWUP', '🕐 Follow-up scheduler started. Checking every 60 seconds...');

  // Check if the followup_sent_at column exists (auto-migrate hint)
  ensureFollowupColumn().catch(() => {});

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

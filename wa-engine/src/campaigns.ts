import { v4 as uuidv4 } from 'uuid';
import {
  getActiveCampaigns,
  isAlreadyContacted,
  markAsContacted,
  addMessageLog,
  incrementCampaignSentCount,
} from './db.js';
import {
  sendTextMessage,
  sendImageMessage,
  sendVideoMessage,
  sendAudioMessage,
  sendDocumentMessage,
} from './fileSender.js';
import { WaCampaign } from './types.js';
import { log, errLog, sleep } from './utils.js';

function cleanForMatching(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[?!.,;:_~#*+\-\[\]\(\)\/\\"'`|—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function matchCampaign(messageText: string, accountId?: string): Promise<WaCampaign | null> {
  const allActive = await getActiveCampaigns();
  if (allActive.length === 0) return null;

  // Filter campaigns assigned to this account (or assigned to 'all')
  const activeCampaigns = allActive.filter(
    (c) => !c.accountId || c.accountId === 'all' || !accountId || c.accountId === accountId
  );
  if (activeCampaigns.length === 0) return null;

  const rawText = (messageText || '').trim();
  if (!rawText) return null;

  const cleanedText = cleanForMatching(rawText);
  if (!cleanedText) return null;

  // 1. Strict Exact Keyword Matching (only triggers when message matches the specified keyword)
  for (const campaign of activeCampaigns) {
    if (!campaign.keywords || !campaign.keywords.trim()) continue;

    const keywords = campaign.keywords
      .split(',')
      .map((k) => cleanForMatching(k))
      .filter(Boolean);

    const words = cleanedText.split(' ');
    for (const kw of keywords) {
      const isMatch =
        cleanedText === kw ||
        words.includes(kw) ||
        (kw.length >= 3 && cleanedText.includes(kw));

      if (isMatch) {
        log('CAMPAIGN', `[Acc: ${accountId || 'all'}] Matched keyword "${kw}" for campaign: "${campaign.name}" (incoming: "${messageText}")`);
        return campaign;
      }
    }
  }

  // 2. Fallback to default campaign if set
  const defaultCamp = activeCampaigns.find((c) => c.isDefault && (!c.keywords || !c.keywords.trim()));
  if (defaultCamp) {
    log('CAMPAIGN', `[Acc: ${accountId || 'all'}] Using default fallback campaign: "${defaultCamp.name}"`);
    return defaultCamp;
  }

  log('CAMPAIGN', `[Acc: ${accountId || 'all'}] Message "${messageText}" does not match any keyword. No auto-reply.`);
  return null;
}

// Track last used variant index per campaign for round-robin switching
const lastVariantIndexMap = new Map<string, number>();

// Track previous delays to ensure each random millisecond differs from the last
let lastFirstDelayMs = 0;
let lastSubsequentDelayMs = 0;

function getRandomDelay(minMs: number, maxMs: number, previousDelay: number): number {
  let delay: number;
  let attempts = 0;
  do {
    delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    attempts++;
  } while (delay === previousDelay && attempts < 10);
  return delay;
}

export async function processIncomingMessage(
  sock: any,
  sender: string,
  pushName: string,
  messageText: string,
  accountId?: string,
  messageKey?: any
): Promise<void> {
  try {
    const campaign = await matchCampaign(messageText, accountId);
    if (!campaign) {
      log('CAMPAIGN', `[Acc: ${accountId || 'all'}] No matching campaign keyword for message: "${messageText}". Ignoring.`);
      return;
    }

    log('CAMPAIGN', `🚀 [Acc: ${accountId || 'all'}] Triggered by keyword! Preparing delivery for ${sender} (${pushName}) -> Campaign: "${campaign.name}"`);

    // 1. Mark incoming message as read (blue ticks in WhatsApp)
    if (messageKey) {
      try {
        await sock.readMessages([messageKey]);
        log('CAMPAIGN', `Marked incoming message from ${sender} as READ.`);
      } catch (readErr: any) {
        // Continue even if read receipt fails
      }
    }

    // Set human-like typing presence
    try {
      await sock.sendPresenceUpdate('composing', sender);
    } catch (presErr: any) {
      // Ignore presence error
    }

    // 2. Select Active Variant (Variation Switching System)
    let activeVariants = (campaign.variants || []).filter((v) => v.isActive);

    // If no variants defined or all disabled, fallback to campaign's top-level info
    if (activeVariants.length === 0) {
      activeVariants = [
        {
          id: 'var_default',
          name: 'Main Variation',
          isActive: true,
          welcomeMessage: campaign.welcomeMessage || '',
          imageUrl: campaign.imageUrl || '',
          audioUrl: campaign.audioUrl || '',
          videoUrl: campaign.videoUrl || '',
          documentUrl: campaign.documentUrl || '',
          documentName: campaign.documentName || '',
        },
      ];
    }

    // Rotate or randomly switch between active variations
    let selectedVariant = activeVariants[0];
    if (activeVariants.length > 1) {
      const lastIndex = lastVariantIndexMap.get(campaign.id) ?? -1;
      const nextIndex = (lastIndex + 1) % activeVariants.length;
      lastVariantIndexMap.set(campaign.id, nextIndex);
      selectedVariant = activeVariants[nextIndex];
      log(
        'CAMPAIGN',
        `🔀 [Variation Switching] Selected "${selectedVariant.name}" (${nextIndex + 1} of ${activeVariants.length} active variations) for ${sender}`
      );
    } else {
      log('CAMPAIGN', `ℹ️ [Variation] Using "${selectedVariant.name}" for ${sender}`);
    }

    const orderList = campaign.sendOrder
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    // Filter which items in the send order actually have content in this variant
    const itemsToSend: string[] = [];
    for (const item of orderList) {
      if (item === 'message' && selectedVariant.welcomeMessage && selectedVariant.welcomeMessage.trim()) {
        itemsToSend.push('message');
      } else if (item === 'image' && selectedVariant.imageUrl && selectedVariant.imageUrl.trim()) {
        itemsToSend.push('image');
      } else if (item === 'video' && selectedVariant.videoUrl && selectedVariant.videoUrl.trim()) {
        itemsToSend.push('video');
      } else if (item === 'audio' && selectedVariant.audioUrl && selectedVariant.audioUrl.trim()) {
        itemsToSend.push('audio');
      } else if (item === 'document' && selectedVariant.documentUrl && selectedVariant.documentUrl.trim()) {
        itemsToSend.push('document');
      }
    }

    if (itemsToSend.length === 0) {
      log('CAMPAIGN', `Selected variation "${selectedVariant.name}" has no media or text content to send.`);
      return;
    }

    // 3. First Message Delay: 3 to 4 seconds in random milliseconds (after read)
    const firstDelay = getRandomDelay(3000, 4000, lastFirstDelayMs);
    lastFirstDelayMs = firstDelay;
    log('CAMPAIGN', `⏳ Waiting ${(firstDelay / 1000).toFixed(3)}s (${firstDelay}ms) before sending 1st item to ${sender}...`);
    await sleep(firstDelay);

    let allSuccessful = true;

    for (let i = 0; i < itemsToSend.length; i++) {
      const item = itemsToSend[i];

      // Keep typing presence alive
      try {
        await sock.sendPresenceUpdate('composing', sender);
      } catch (e) {}

      try {
        if (item === 'message') {
          await sendTextMessage(sock, sender, selectedVariant.welcomeMessage.trim());
          await addMessageLog({
            id: uuidv4(),
            campaignId: campaign.id,
            phoneNumber: sender,
            contactName: pushName,
            messageType: 'text',
            fileUrl: '',
            status: 'sent',
            errorMessage: '',
            sentAt: new Date().toISOString(),
          });
        } else if (item === 'image') {
          await sendImageMessage(sock, sender, selectedVariant.imageUrl.trim());
          const cleanLogUrl = selectedVariant.imageUrl.startsWith('data:') ? 'photo.jpg' : selectedVariant.imageUrl.trim();
          await addMessageLog({
            id: uuidv4(),
            campaignId: campaign.id,
            phoneNumber: sender,
            contactName: pushName,
            messageType: 'image',
            fileUrl: cleanLogUrl,
            status: 'sent',
            errorMessage: '',
            sentAt: new Date().toISOString(),
          });
        } else if (item === 'video') {
          await sendVideoMessage(sock, sender, selectedVariant.videoUrl.trim());
          const cleanLogUrl = selectedVariant.videoUrl.startsWith('data:') ? 'video.mp4' : selectedVariant.videoUrl.trim();
          await addMessageLog({
            id: uuidv4(),
            campaignId: campaign.id,
            phoneNumber: sender,
            contactName: pushName,
            messageType: 'video',
            fileUrl: cleanLogUrl,
            status: 'sent',
            errorMessage: '',
            sentAt: new Date().toISOString(),
          });
        } else if (item === 'audio') {
          await sendAudioMessage(sock, sender, selectedVariant.audioUrl.trim());
          const cleanLogUrl = selectedVariant.audioUrl.startsWith('data:') ? 'voice_note.mp3' : selectedVariant.audioUrl.trim();
          await addMessageLog({
            id: uuidv4(),
            campaignId: campaign.id,
            phoneNumber: sender,
            contactName: pushName,
            messageType: 'audio',
            fileUrl: cleanLogUrl,
            status: 'sent',
            errorMessage: '',
            sentAt: new Date().toISOString(),
          });
        } else if (item === 'document') {
          const docName = selectedVariant.documentName || 'Document';
          await sendDocumentMessage(sock, sender, selectedVariant.documentUrl.trim(), docName);
          const cleanLogUrl = selectedVariant.documentUrl.startsWith('data:') ? docName : selectedVariant.documentUrl.trim();
          await addMessageLog({
            id: uuidv4(),
            campaignId: campaign.id,
            phoneNumber: sender,
            contactName: pushName,
            messageType: 'document',
            fileUrl: cleanLogUrl,
            status: 'sent',
            errorMessage: '',
            sentAt: new Date().toISOString(),
          });
        }

        // 4. Delay Before Next Item: 1 to 2 seconds in random milliseconds (non-matching)
        if (i < itemsToSend.length - 1) {
          const nextDelay = getRandomDelay(1000, 2000, lastSubsequentDelayMs);
          lastSubsequentDelayMs = nextDelay;
          log('CAMPAIGN', `⏳ Waiting ${(nextDelay / 1000).toFixed(3)}s (${nextDelay}ms) before item ${i + 2}...`);
          await sleep(nextDelay);
        }
      } catch (itemErr: any) {
        errLog('CAMPAIGN', `Error sending item "${item}":`, itemErr.message);
        allSuccessful = false;
        await addMessageLog({
          id: uuidv4(),
          campaignId: campaign.id,
          phoneNumber: sender,
          contactName: pushName,
          messageType: item as any,
          fileUrl: '',
          status: 'failed',
          errorMessage: itemErr.message || 'Unknown error',
          sentAt: new Date().toISOString(),
        });
      }
    }

    // Mark user as contacted
    await markAsContacted({
      id: uuidv4(),
      campaignId: campaign.id,
      phoneNumber: sender,
      contactName: pushName,
      sentAt: new Date().toISOString(),
      status: allSuccessful ? 'sent' : 'failed',
    });

    // Increment sent count
    await incrementCampaignSentCount(campaign.id);

    log('CAMPAIGN', `✅ Delivery completed for ${sender}. Marked as contacted.`);
  } catch (err: any) {
    errLog('CAMPAIGN', 'Exception in processIncomingMessage:', err.message);
  }
}

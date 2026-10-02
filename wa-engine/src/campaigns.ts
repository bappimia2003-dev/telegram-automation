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

export async function matchCampaign(messageText: string): Promise<WaCampaign | null> {
  const activeCampaigns = await getActiveCampaigns();
  if (activeCampaigns.length === 0) return null;

  const normalizedText = (messageText || '').toLowerCase().trim();

  // 1. Try keyword matching
  if (normalizedText) {
    for (const campaign of activeCampaigns) {
      if (!campaign.keywords || !campaign.keywords.trim()) continue;

      const keywords = campaign.keywords
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);

      for (const kw of keywords) {
        if (normalizedText.includes(kw)) {
          log('CAMPAIGN', `Matched keyword "${kw}" for campaign: "${campaign.name}"`);
          return campaign;
        }
      }
    }
  }

  // 2. Fallback to default campaign if set
  const defaultCamp = activeCampaigns.find((c) => c.isDefault);
  if (defaultCamp) {
    log('CAMPAIGN', `No keyword match. Using default campaign: "${defaultCamp.name}"`);
    return defaultCamp;
  }

  // 3. Fallback to the first active campaign if only 1 active
  if (activeCampaigns.length === 1) {
    log('CAMPAIGN', `Only 1 active campaign available: "${activeCampaigns[0].name}"`);
    return activeCampaigns[0];
  }

  return null;
}

export async function processIncomingMessage(
  sock: any,
  sender: string,
  pushName: string,
  messageText: string
): Promise<void> {
  try {
    const campaign = await matchCampaign(messageText);
    if (!campaign) {
      log('CAMPAIGN', `No matching campaign found for message: "${messageText}". Ignoring.`);
      return;
    }

    // Check one-time contact guarantee
    const alreadyContacted = await isAlreadyContacted(campaign.id, sender);
    if (alreadyContacted) {
      log('CAMPAIGN', `Sender ${sender} already received campaign "${campaign.name}". Skipping.`);
      return;
    }

    log('CAMPAIGN', `🚀 Starting auto-delivery for ${sender} (${pushName}) -> Campaign: "${campaign.name}"`);

    const orderList = campaign.sendOrder
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    let allSuccessful = true;

    for (const item of orderList) {
      try {
        let sent = false;

        if (item === 'message' && campaign.welcomeMessage && campaign.welcomeMessage.trim()) {
          await sendTextMessage(sock, sender, campaign.welcomeMessage.trim());
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
          sent = true;
        } else if (item === 'image' && campaign.imageUrl && campaign.imageUrl.trim()) {
          await sendImageMessage(sock, sender, campaign.imageUrl.trim());
          await addMessageLog({
            id: uuidv4(),
            campaignId: campaign.id,
            phoneNumber: sender,
            contactName: pushName,
            messageType: 'image',
            fileUrl: campaign.imageUrl.trim(),
            status: 'sent',
            errorMessage: '',
            sentAt: new Date().toISOString(),
          });
          sent = true;
        } else if (item === 'video' && campaign.videoUrl && campaign.videoUrl.trim()) {
          await sendVideoMessage(sock, sender, campaign.videoUrl.trim());
          await addMessageLog({
            id: uuidv4(),
            campaignId: campaign.id,
            phoneNumber: sender,
            contactName: pushName,
            messageType: 'video',
            fileUrl: campaign.videoUrl.trim(),
            status: 'sent',
            errorMessage: '',
            sentAt: new Date().toISOString(),
          });
          sent = true;
        } else if (item === 'audio' && campaign.audioUrl && campaign.audioUrl.trim()) {
          await sendAudioMessage(sock, sender, campaign.audioUrl.trim());
          await addMessageLog({
            id: uuidv4(),
            campaignId: campaign.id,
            phoneNumber: sender,
            contactName: pushName,
            messageType: 'audio',
            fileUrl: campaign.audioUrl.trim(),
            status: 'sent',
            errorMessage: '',
            sentAt: new Date().toISOString(),
          });
          sent = true;
        } else if (item === 'document' && campaign.documentUrl && campaign.documentUrl.trim()) {
          await sendDocumentMessage(sock, sender, campaign.documentUrl.trim(), campaign.documentName || 'Document');
          await addMessageLog({
            id: uuidv4(),
            campaignId: campaign.id,
            phoneNumber: sender,
            contactName: pushName,
            messageType: 'document',
            fileUrl: campaign.documentUrl.trim(),
            status: 'sent',
            errorMessage: '',
            sentAt: new Date().toISOString(),
          });
          sent = true;
        }

        if (sent && campaign.delayBetweenSends > 0) {
          log('CAMPAIGN', `Waiting ${campaign.delayBetweenSends}s before next item...`);
          await sleep(campaign.delayBetweenSends * 1000);
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

    // Mark user as contacted (One-time guarantee!)
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

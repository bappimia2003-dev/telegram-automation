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
    .replace(/[?!.,;:_~#*+\-\[\]\(\)\/\\"]/g, ' ')
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

  // 1. Smart Keyword Matching (punctuation-resilient, whitespace-normalized)
  for (const campaign of activeCampaigns) {
    if (!campaign.keywords || !campaign.keywords.trim()) continue;

    const keywords = campaign.keywords
      .split(',')
      .map((k) => cleanForMatching(k))
      .filter(Boolean);

    for (const kw of keywords) {
      if (cleanedText.includes(kw) || kw.includes(cleanedText)) {
        log('CAMPAIGN', `[Acc: ${accountId || 'all'}] Matched keyword "${kw}" for campaign: "${campaign.name}" (incoming: "${messageText}")`);
        return campaign;
      }
    }
  }

  // 2. Fallback to default campaign if set
  const defaultCamp = activeCampaigns.find((c) => c.isDefault);
  if (defaultCamp) {
    log('CAMPAIGN', `[Acc: ${accountId || 'all'}] Using default fallback campaign: "${defaultCamp.name}"`);
    return defaultCamp;
  }

  log('CAMPAIGN', `[Acc: ${accountId || 'all'}] Message "${messageText}" does not match any keyword. No auto-reply.`);
  return null;
}

export async function processIncomingMessage(
  sock: any,
  sender: string,
  pushName: string,
  messageText: string,
  accountId?: string
): Promise<void> {
  try {
    const campaign = await matchCampaign(messageText, accountId);
    if (!campaign) {
      log('CAMPAIGN', `[Acc: ${accountId || 'all'}] No matching campaign keyword for message: "${messageText}". Ignoring.`);
      return;
    }

    log('CAMPAIGN', `🚀 [Acc: ${accountId || 'all'}] Triggered by keyword! Starting delivery for ${sender} (${pushName}) -> Campaign: "${campaign.name}"`);

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
          const cleanLogUrl = campaign.imageUrl.startsWith('data:') ? 'photo.jpg' : campaign.imageUrl.trim();
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
          sent = true;
        } else if (item === 'video' && campaign.videoUrl && campaign.videoUrl.trim()) {
          await sendVideoMessage(sock, sender, campaign.videoUrl.trim());
          const cleanLogUrl = campaign.videoUrl.startsWith('data:') ? 'video.mp4' : campaign.videoUrl.trim();
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
          sent = true;
        } else if (item === 'audio' && campaign.audioUrl && campaign.audioUrl.trim()) {
          await sendAudioMessage(sock, sender, campaign.audioUrl.trim());
          const cleanLogUrl = campaign.audioUrl.startsWith('data:') ? 'voice_note.mp3' : campaign.audioUrl.trim();
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
          sent = true;
        } else if (item === 'document' && campaign.documentUrl && campaign.documentUrl.trim()) {
          const docName = campaign.documentName || 'Document';
          await sendDocumentMessage(sock, sender, campaign.documentUrl.trim(), docName);
          const cleanLogUrl = campaign.documentUrl.startsWith('data:') ? docName : campaign.documentUrl.trim();
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

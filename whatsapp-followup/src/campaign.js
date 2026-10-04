import {
  db,
  getSetting,
  getCampaignEligibleLeads,
  logCampaignSent,
  logMessage,
  recordMediaUsage,
} from './database.js';
import {
  isWithinWorkingHours,
  canSendDailyMessage,
  getRandomInt,
  sleep,
  interMessageDelay,
} from './antiban.js';
import { generateDynamicMessage } from './gemini.js';
import { sendTextMessage, sendImageMessage, sendAudioMessage } from './whatsapp.js';

let activeCampaign = null;
let campaignTimer = null;

export function getActiveCampaignInfo() {
  if (!activeCampaign) {
    return { isRunning: false, campaign: null };
  }
  return {
    isRunning: activeCampaign.status === 'running',
    campaign: activeCampaign,
  };
}

export function startOfferCampaign({
  name = 'Offer Campaign',
  selectedFiles = [], // array of { type, filepath, id }
  minDelayMinutes = 45,
  maxDelayMinutes = 90,
  minPeople = 3,
  maxPeople = 5,
  durationHours = 6,
}) {
  if (activeCampaign && activeCampaign.status === 'running') {
    throw new Error('A campaign is already currently running.');
  }

  const campaignId = `camp_${Date.now()}`;
  const now = new Date();
  const endsAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

  activeCampaign = {
    id: campaignId,
    name,
    selectedFiles,
    minDelayMinutes: Number(minDelayMinutes),
    maxDelayMinutes: Number(maxDelayMinutes),
    minPeople: Number(minPeople),
    maxPeople: Number(maxPeople),
    durationHours: Number(durationHours),
    startedAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
    status: 'running',
    totalSent: 0,
    batchesCompleted: 0,
  };

  db.prepare(`
    INSERT INTO campaigns (id, name, status, config, created_at, updated_at)
    VALUES (?, ?, 'running', ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `).run(campaignId, name, JSON.stringify(activeCampaign));

  console.log(`[Campaign] Started offer campaign "${name}" (ID: ${campaignId}). Duration: ${durationHours}h`);

  // Launch campaign worker in background
  runCampaignLoop(activeCampaign).catch((err) => {
    console.error('[Campaign] Worker encountered error:', err.message);
  });

  return activeCampaign;
}

export function stopOfferCampaign() {
  if (campaignTimer) {
    clearTimeout(campaignTimer);
    campaignTimer = null;
  }
  if (activeCampaign) {
    activeCampaign.status = 'stopped';
    db.prepare(`UPDATE campaigns SET status = 'stopped', updated_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(activeCampaign.id);
    console.log(`[Campaign] Campaign ${activeCampaign.id} stopped.`);
    const copy = { ...activeCampaign };
    activeCampaign = null;
    return copy;
  }
  return null;
}

async function runCampaignLoop(campaign) {
  const endTime = new Date(campaign.endsAt).getTime();

  while (Date.now() < endTime && activeCampaign && activeCampaign.status === 'running') {
    // 1. Check Working Hours & Quota
    if (!isWithinWorkingHours() || !canSendDailyMessage()) {
      console.log('[Campaign] Currently outside working hours or daily limit reached. Sleeping 15 mins...');
      await sleep(15 * 60 * 1000);
      continue;
    }

    // 2. Determine random batch size (e.g. 3 to 5 people)
    const batchSize = getRandomInt(campaign.minPeople, campaign.maxPeople);

    // 3. Query eligible leads who haven't received this campaign offer yet
    const leads = getCampaignEligibleLeads(campaign.id, batchSize);
    console.log(`[Campaign] Batch starting: Selected ${leads.length} leads (target was ${batchSize})`);

    if (leads.length === 0) {
      console.log('[Campaign] No more eligible leads left for this campaign.');
      break;
    }

    // 4. Send to each lead with anti-ban jitter
    for (const lead of leads) {
      if (!activeCampaign || activeCampaign.status !== 'running') break;

      await dispatchCampaignToLead(lead, campaign.selectedFiles, campaign.id);
      campaign.totalSent++;

      // Inter-message jitter (15-45 sec)
      await interMessageDelay(15, 30);
    }

    campaign.batchesCompleted++;

    // Update DB
    db.prepare(`UPDATE campaigns SET config = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(JSON.stringify(campaign), campaign.id);

    // 5. Calculate randomized interval before next batch (e.g. 45 to 90 minutes)
    const nextIntervalMinutes = getRandomInt(campaign.minDelayMinutes, campaign.maxDelayMinutes);
    console.log(`[Campaign] Batch completed. Waiting ${nextIntervalMinutes} minutes before next batch...`);

    // Sleep in chunks so stop/pause can react
    const waitMs = nextIntervalMinutes * 60 * 1000;
    const checkStepMs = 5000;
    let elapsed = 0;
    while (elapsed < waitMs && activeCampaign && activeCampaign.status === 'running') {
      await sleep(checkStepMs);
      elapsed += checkStepMs;
    }
  }

  console.log(`[Campaign] Campaign finished or ended.`);
  stopOfferCampaign();
}

/**
 * Dispatch selected media (image/audio/text) to a single lead
 */
async function dispatchCampaignToLead(lead, selectedFiles, campaignId) {
  const gender = lead.gender || 'apni';
  const phone = lead.phone;

  console.log(`[Campaign] Dispatching offer to ${lead.name || 'Customer'} (${phone})...`);

  // Default offer text if no text file selected
  let baseText = 'আমাদের বিশেষ অফার চলছে! আজই অর্ডার কনফার্ম করলে পাচ্ছেন আকর্ষণীয় ছাড় ও ফ্রি ডেলিভারি।';

  // Check selected files
  const textFiles = selectedFiles.filter((f) => f.type === 'text');
  const imageFiles = selectedFiles.filter((f) => f.type === 'image');
  const audioFiles = selectedFiles.filter((f) => f.type === 'audio');

  if (textFiles.length > 0) {
    const randomText = textFiles[getRandomInt(0, textFiles.length - 1)];
    baseText = randomText.content || baseText;
    if (randomText.id) recordMediaUsage(randomText.id);
  }

  // Generate dynamic Banglish variation with Gemini
  const finalMessage = await generateDynamicMessage(baseText, gender, lead.product);

  try {
    // If image selected, send image + caption
    if (imageFiles.length > 0) {
      const img = imageFiles[getRandomInt(0, imageFiles.length - 1)];
      await sendImageMessage(phone, img.filepath, finalMessage);
      recordMediaUsage(img.id);
      logMessage(lead.id, 'bot', finalMessage, 'image', img.filepath);
      logCampaignSent(campaignId, phone, img.filename);
    } else {
      await sendTextMessage(phone, finalMessage);
      logMessage(lead.id, 'bot', finalMessage, 'text');
      logCampaignSent(campaignId, phone, 'text_offer');
    }

    // If audio is also selected, send follow-up voice note after 4 seconds
    if (audioFiles.length > 0) {
      await sleep(4000);
      const audio = audioFiles[getRandomInt(0, audioFiles.length - 1)];
      await sendAudioMessage(phone, audio.filepath);
      recordMediaUsage(audio.id);
      logMessage(lead.id, 'bot', '[Offer Voice Note]', 'audio', audio.filepath);
    }

    // Update lead's last_sent_at
    db.prepare(`UPDATE leads SET last_sent_at = datetime('now', 'localtime') WHERE id = ?`).run(lead.id);
  } catch (err) {
    console.error(`[Campaign] Failed sending to ${phone}:`, err.message);
  }
}

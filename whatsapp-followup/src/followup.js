import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  getLeadByPhone,
  createOrUpdateLead,
  updateLeadStatus,
  updateLeadPromiseDate,
  updateLeadFollowUp,
  logMessage,
  getSetting,
  getMediaVault,
  recordMediaUsage,
} from './database.js';
import { detectGenderAndIntent, generateDynamicMessage } from './gemini.js';
import { isWithinWorkingHours, canSendDailyMessage } from './antiban.js';
import { sendTextMessage, sendImageMessage, sendAudioMessage } from './whatsapp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const textsDir = path.resolve(__dirname, '../media/texts');

function readTemplate(filename) {
  const filePath = path.join(textsDir, filename);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return '';
}

/**
 * Handle incoming message from customer
 */
export async function handleInboundMessage({ sock, phone, pushName, text, hasAudio, hasImage }) {
  console.log(`[FollowUp] Inbound message from ${pushName || 'Customer'} (${phone}): "${text || '[Media]'}"`);

  let lead = getLeadByPhone(phone);
  const isNew = !lead;

  // 1. Analyze gender & intent
  const analysis = await detectGenderAndIntent(pushName, text);
  const detectedGender = analysis.gender || 'apni';

  // 2. Create or retrieve lead
  lead = createOrUpdateLead({
    phone,
    name: pushName,
    gender: detectedGender,
    product: 'general',
  });

  // Log incoming message
  const mediaType = hasAudio ? 'audio' : hasImage ? 'image' : 'text';
  logMessage(lead.id, 'customer', text || `[Received ${mediaType}]`, mediaType);

  // 3. Check for Promise Date (e.g. "shukrobar nibo", "kal call diyen")
  if (analysis.promiseDate) {
    console.log(`[FollowUp] Customer specified promise date: ${analysis.promiseDate}`);
    updateLeadPromiseDate(phone, analysis.promiseDate, `Customer promised to buy on ${analysis.promiseDate}`);
    // AI does NOT reply to customer message! Follow-up reminder will fire on scheduled date.
    return;
  }

  // 4. If existing customer replied with active intent -> MANUAL TAKEOVER!
  if (!isNew) {
    if (analysis.status === 'declined') {
      console.log(`[FollowUp] Customer declined. Archiving lead ${phone}...`);
      updateLeadStatus(phone, 'archived', 'Customer declined');
      return;
    }

    console.log(`[FollowUp] 🚨 Existing customer ${phone} replied! Engaging MANUAL TAKEOVER. AI auto-followup paused. No reply sent.`);
    updateLeadStatus(phone, 'manual_takeover', 'Customer actively responded. Manual takeover active.');
    return;
  }

  // 5. If new customer and auto_followup is ON:
  // AI does NOT reply to customer's incoming message!
  // It only registers the lead and schedules Step 1 follow-up for later according to plan.
  const autoFollowupEnabled = getSetting('auto_followup') === '1' || getSetting('auto_followup') === true;
  if (isNew && autoFollowupEnabled) {
    // Schedule Step 1 for follow-up according to plan (not an instant reply)
    const delayMinutes = Number(getSetting('min_delay_minutes', '45')) || 45;
    const nextDate = new Date(Date.now() + delayMinutes * 60 * 1000);
    const nextDateStr = nextDate.toISOString().replace('T', ' ').substring(0, 19);
    updateLeadFollowUp(lead.phone, 1, nextDateStr);
    console.log(`[FollowUp] Lead ${lead.phone} registered. Follow-up Step 1 scheduled at ${nextDateStr}. NO immediate reply sent.`);
  }
}

/**
 * Step 0: Immediate Initial Greeting & Product Info
 */
async function sendInitialStep0(lead, gender) {
  if (!isWithinWorkingHours() || !canSendDailyMessage()) {
    console.log('[FollowUp] Skipping Step 0: outside working hours or daily quota reached.');
    return;
  }

  const rawTemplate = readTemplate('step0_intro.txt') || 'আসসালামু আলাইকুম {honorific}! আমাদের প্রোডাক্ট বিস্তারিত দেখুন।';
  const dynamicText = await generateDynamicMessage(rawTemplate, gender, lead.product);

  // Check if we have an introductory image
  const images = getMediaVault('image');
  let sentImage = false;

  try {
    if (images.length > 0) {
      const img = images[0];
      await sendImageMessage(lead.phone, img.filepath, dynamicText);
      recordMediaUsage(img.id);
      logMessage(lead.id, 'bot', dynamicText, 'image', img.filepath);
      sentImage = true;
    } else {
      await sendTextMessage(lead.phone, dynamicText);
      logMessage(lead.id, 'bot', dynamicText, 'text');
    }

    // Schedule Step 1 for 2 minutes from now
    const nextDate = new Date(Date.now() + 2 * 60 * 1000);
    const nextDateStr = nextDate.toISOString().replace('T', ' ').substring(0, 19);
    updateLeadFollowUp(lead.phone, 1, nextDateStr);
    console.log(`[FollowUp] Step 0 sent to ${lead.phone}. Step 1 scheduled at ${nextDateStr}`);
  } catch (err) {
    console.error(`[FollowUp] Failed sending Step 0 to ${lead.phone}:`, err.message);
  }
}

/**
 * Execute Follow-up Step
 */
export async function executeFollowupStep(lead) {
  // Guard checks
  if (lead.status === 'manual_takeover' || lead.status === 'closed' || lead.status === 'archived') {
    return;
  }
  if (!isWithinWorkingHours() || !canSendDailyMessage()) {
    return;
  }

  const step = lead.follow_up_step;
  const gender = lead.gender || 'apni';
  const phone = lead.phone;

  console.log(`[FollowUp] Executing step ${step} for ${phone}...`);

  try {
    if (step === 1) {
      // Step 1: 2-minute soft check
      const raw = readTemplate('step1_check.txt') || '{honorific} কি বিস্তারিত দেখেছেন? কোনো প্রশ্ন থাকলে বলুন।';
      const msg = await generateDynamicMessage(raw, gender, lead.product);
      await sendTextMessage(phone, msg);
      logMessage(lead.id, 'bot', msg, 'text');

      // Schedule Step 2 for 3 hours later
      const nextDate = new Date(Date.now() + 3 * 60 * 60 * 1000);
      updateLeadFollowUp(phone, 2, nextDate.toISOString().replace('T', ' ').substring(0, 19));
    } else if (step === 2) {
      // Step 2: 3-hour voice note (Audio) or soft text
      const audios = getMediaVault('audio');
      if (audios.length > 0) {
        const audio = audios[0];
        await sendAudioMessage(phone, audio.filepath);
        recordMediaUsage(audio.id);
        logMessage(lead.id, 'bot', '[Voice Note Follow-up]', 'audio', audio.filepath);
      } else {
        const raw = readTemplate('step2_soft.txt') || '{honorific}, প্রোডাক্টটি কিন্তু খুব দ্রুত স্টক আউট হচ্ছে।';
        const msg = await generateDynamicMessage(raw, gender, lead.product);
        await sendTextMessage(phone, msg);
        logMessage(lead.id, 'bot', msg, 'text');
      }

      // Schedule Step 3 for tomorrow 10:30 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 30, 0, 0);
      updateLeadFollowUp(phone, 3, tomorrow.toISOString().replace('T', ' ').substring(0, 19));
    } else if (step === 3) {
      // Step 3: Next day image + value message
      const images = getMediaVault('image');
      const raw = readTemplate('step3_value.txt') || '{honorific}, আশা করি ভালো আছেন। আজকেও আপনার জন্য স্টক রাখা আছে।';
      const msg = await generateDynamicMessage(raw, gender, lead.product);

      if (images.length > 1) {
        const img = images[1];
        await sendImageMessage(phone, img.filepath, msg);
        recordMediaUsage(img.id);
        logMessage(lead.id, 'bot', msg, 'image', img.filepath);
      } else {
        await sendTextMessage(phone, msg);
        logMessage(lead.id, 'bot', msg, 'text');
      }

      // Schedule Step 4 for 2 days later at 5:00 PM
      const afterTwoDays = new Date();
      afterTwoDays.setDate(afterTwoDays.getDate() + 2);
      afterTwoDays.setHours(17, 0, 0, 0);
      updateLeadFollowUp(phone, 4, afterTwoDays.toISOString().replace('T', ' ').substring(0, 19));
    } else if (step >= 4) {
      // Step 4: Final polite closing
      const raw = readTemplate('step4_final.txt') || '{honorific}, আমরা স্টক ক্লোজ করতে যাচ্ছি। আপনার দিনটি শুভ হোক!';
      const msg = await generateDynamicMessage(raw, gender, lead.product);
      await sendTextMessage(phone, msg);
      logMessage(lead.id, 'bot', msg, 'text');

      // End follow-up sequence -> Archive
      updateLeadStatus(phone, 'archived', 'Completed 4-step follow-up without reply');
      console.log(`[FollowUp] Lead ${phone} reached final step and is now archived.`);
    }
  } catch (err) {
    console.error(`[FollowUp] Error executing step ${step} for ${phone}:`, err.message);
  }
}

/**
 * Execute Promise Reminder for leads who said "shukrobar nibo" etc.
 */
export async function executePromiseReminder(lead) {
  if (!isWithinWorkingHours() || !canSendDailyMessage()) return;

  const gender = lead.gender || 'apni';
  const raw = readTemplate('promise_reminder.txt') || 'আসসালামু আলাইকুম {honorific}! আপনি আজকে যোগাযোগ করতে বলেছিলেন।';
  const msg = await generateDynamicMessage(raw, gender, lead.product);

  try {
    await sendTextMessage(lead.phone, msg);
    logMessage(lead.id, 'bot', msg, 'text');
    console.log(`[FollowUp] Sent promise reminder to ${lead.phone}`);
    // Update status to in_followup or wait for reply
    updateLeadStatus(lead.phone, 'in_followup', 'Promise reminder sent');
  } catch (err) {
    console.error(`[FollowUp] Error sending promise reminder to ${lead.phone}:`, err.message);
  }
}

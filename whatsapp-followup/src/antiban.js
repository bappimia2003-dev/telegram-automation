import { getSetting, db } from './database.js';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Check if the current time falls within working hours (e.g. 09:00 - 22:00)
 */
export function isWithinWorkingHours() {
  const startStr = getSetting('working_hours_start', '09:00');
  const endStr = getSetting('working_hours_end', '22:00');

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);

  const startTotal = startH * 60 + (startM || 0);
  const endTotal = endH * 60 + (endM || 0);

  return currentMinutes >= startTotal && currentMinutes <= endTotal;
}

/**
 * Check if daily message quota has been exceeded
 */
export function canSendDailyMessage() {
  const maxDaily = Number(getSetting('max_daily_messages', '30'));
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM message_history 
    WHERE sender = 'bot' AND date(created_at) = date('now', 'localtime')
  `).get();

  return (row?.count || 0) < maxDaily;
}

/**
 * Simulate human presence & typing before dispatching
 */
export async function simulatePresence(sock, jid, mediaType = 'text') {
  const antibanEnabled = getSetting('antiban') === '1' || getSetting('antiban') === true;
  if (!antibanEnabled) {
    await sleep(500);
    return;
  }

  try {
    // 1. Mark presence as available
    await sock.sendPresenceUpdate('available');
    await sleep(getRandomInt(1000, 2000));

    // 2. Typing or recording indicator
    if (mediaType === 'audio') {
      await sock.sendPresenceUpdate('recording', jid);
      await sleep(getRandomInt(2500, 4500));
    } else {
      await sock.sendPresenceUpdate('composing', jid);
      await sleep(getRandomInt(3000, 6000));
    }

    // 3. Clear presence
    await sock.sendPresenceUpdate('paused', jid);
  } catch (err) {
    console.warn('[AntiBan] Presence update warning:', err.message);
  }
}

/**
 * Random jitter delay between messages
 */
export async function interMessageDelay(minSec = 15, maxSec = 45) {
  const antibanEnabled = getSetting('antiban') === '1' || getSetting('antiban') === true;
  if (!antibanEnabled) {
    await sleep(500);
    return;
  }
  const delayMs = getRandomInt(minSec * 1000, maxSec * 1000);
  console.log(`[AntiBan] Inter-message jitter: waiting ${(delayMs / 1000).toFixed(1)}s...`);
  await sleep(delayMs);
}

import cron from 'node-cron';
import {
  getSetting,
  setSetting,
  getPendingFollowups,
  getPromisedFollowups,
  performRollingCleanup,
} from './database.js';
import { executeFollowupStep, executePromiseReminder } from './followup.js';
import { isWithinWorkingHours } from './antiban.js';

export function initScheduler() {
  console.log('[Scheduler] Initializing automated background workers...');

  // Immediate check on startup for rolling 30-day cleanup
  try {
    const autoCleanup = getSetting('auto_cleanup') === '1' || getSetting('auto_cleanup') === true;
    if (autoCleanup) {
      const rollingDays = Number(getSetting('rolling_days', '30'));
      performRollingCleanup(rollingDays);
    }
  } catch (err) {
    console.error('[Scheduler] Initial rolling cleanup error:', err.message);
  }

  // 1. Check pending follow-ups every 1 minute
  cron.schedule('* * * * *', async () => {
    const autoFollowup = getSetting('auto_followup') === '1' || getSetting('auto_followup') === true;
    if (!autoFollowup) return;
    if (!isWithinWorkingHours()) return;

    // Check if total duration in days has expired
    const totalDays = Number(getSetting('total_duration_days', '30')) || 0;
    const startedDateStr = getSetting('started_date');
    if (totalDays > 0 && startedDateStr) {
      const started = new Date(startedDateStr).getTime();
      const elapsedDays = Math.floor((Date.now() - started) / (24 * 60 * 60 * 1000));
      if (elapsedDays >= totalDays) {
        console.log(`[Scheduler] ⏰ Follow-up duration completed (${elapsedDays}/${totalDays} days). Auto-pausing.`);
        setSetting('auto_followup', '0');
        return;
      }
    }

    try {
      const pendingLeads = getPendingFollowups();
      if (pendingLeads.length > 0) {
        console.log(`[Scheduler] Found ${pendingLeads.length} pending follow-up leads.`);
        for (const lead of pendingLeads) {
          await executeFollowupStep(lead);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error checking pending follow-ups:', err.message);
    }
  });

  // 2. Check Promise Date Reminders every hour during working hours
  cron.schedule('0 * * * *', async () => {
    if (!isWithinWorkingHours()) return;

    try {
      const promisedLeads = getPromisedFollowups();
      if (promisedLeads.length > 0) {
        console.log(`[Scheduler] Found ${promisedLeads.length} leads with promised reminder today.`);
        for (const lead of promisedLeads) {
          await executePromiseReminder(lead);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error processing promised reminders:', err.message);
    }
  });

  // 3. Daily Rolling 30-Day Database Cleanup (Every midnight at 00:05 AM)
  cron.schedule('5 0 * * *', () => {
    const autoCleanup = getSetting('auto_cleanup') === '1' || getSetting('auto_cleanup') === true;
    if (!autoCleanup) return;

    const rollingDays = Number(getSetting('rolling_days', '30'));
    console.log(`[Scheduler] 🧹 Running daily rolling cleanup (Window: ${rollingDays} days)...`);
    try {
      const result = performRollingCleanup(rollingDays);
      console.log(`[Scheduler] Cleanup finished: Deleted ${result.deletedMessages} old messages, ${result.deletedCampaignLogs} campaign logs, and ${result.deletedArchivedLeads} archived leads.`);
    } catch (err) {
      console.error('[Scheduler] Error during rolling cleanup:', err.message);
    }
  });

  console.log('[Scheduler] Cron jobs successfully scheduled.');
}
